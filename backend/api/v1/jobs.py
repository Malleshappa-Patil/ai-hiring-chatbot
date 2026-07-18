"""Jobs API: CRUD + JD generation and approval workflow."""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from backend.database.session import get_db
from backend.database.models import Job, JobDescription, User, Candidate
from backend.api.dependencies import get_current_user, require_hiring_manager_or_above
from backend.models.request_models import CreateJobRequest, RejectJDRequest, EditJDRequest
from backend.models.response_models import JobResponse, JobDescriptionResponse, PaginatedResponse
from backend.services.workflow_service import workflow_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/jobs")


# ── Public Jobs (no auth) ─────────────────────────────────────────
@router.get("/public")
async def list_jobs_public(
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns all jobs without requiring authentication.
    Used by the HireBoard candidate-facing platform to display
    jobs created in the main platform.
    """
    query = select(Job).order_by(desc(Job.created_at))
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0

    result = await db.execute(
        query.offset((page - 1) * page_size).limit(page_size)
    )
    jobs = result.scalars().all()

    items = []
    for j in jobs:
        items.append({
            "id":               j.id,
            "title":            j.title,
            "department":       j.department,
            "location":         j.location,
            "job_type":         j.job_type,
            "experience_level": j.experience_level,
            "hiring_goal":      j.hiring_goal,
            "status":           j.status,
            "created_at":       j.created_at.isoformat() if j.created_at else None,
        })

    return {
        "items": items,
        "total": total,
        "page":  page,
        "page_size": page_size,
    }


# ── List Jobs ─────────────────────────────────────────────────────
@router.get("/", response_model=PaginatedResponse)
async def list_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Job)
    if status:
        query = query.where(Job.status == status)
    
    # Count total
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0

    # Paginate
    result = await db.execute(
        query.order_by(desc(Job.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    jobs = result.scalars().all()

    if not jobs:
        return {
            "items": [],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": max(1, -(-total // page_size)),
        }

    job_ids = [j.id for j in jobs]

    # Aggregate hired counts (selected + onboarding) per job
    hired_result = await db.execute(
        select(Candidate.job_id, func.count(Candidate.id).label("cnt"))
        .where(Candidate.job_id.in_(job_ids))
        .where(Candidate.status.in_(["selected", "onboarding"]))
        .group_by(Candidate.job_id)
    )
    hired_map = {row.job_id: row.cnt for row in hired_result}

    # Aggregate rejected counts per job
    rejected_result = await db.execute(
        select(Candidate.job_id, func.count(Candidate.id).label("cnt"))
        .where(Candidate.job_id.in_(job_ids))
        .where(Candidate.status == "rejected")
        .group_by(Candidate.job_id)
    )
    rejected_map = {row.job_id: row.cnt for row in rejected_result}

    items = []
    for j in jobs:
        resp = JobResponse.model_validate(j)
        resp.hired_count = hired_map.get(j.id, 0)
        resp.rejected_count = rejected_map.get(j.id, 0)
        items.append(resp)

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, -(-total // page_size)),
    }


# ── Get Single Job ─────────────────────────────────────────────────
@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    resp = JobResponse.model_validate(job)

    hired_res = await db.execute(
        select(func.count(Candidate.id))
        .where(Candidate.job_id == job_id)
        .where(Candidate.status.in_(["selected", "onboarding"]))
    )
    resp.hired_count = hired_res.scalar() or 0

    rejected_res = await db.execute(
        select(func.count(Candidate.id))
        .where(Candidate.job_id == job_id)
        .where(Candidate.status == "rejected")
    )
    resp.rejected_count = rejected_res.scalar() or 0

    return resp


# ── Create Job ─────────────────────────────────────────────────────
@router.post("/", response_model=JobResponse, status_code=201)
async def create_job(
    payload: CreateJobRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = Job(
        title=payload.title,
        department=payload.department,
        location=payload.location,
        job_type=payload.job_type,
        experience_level=payload.experience_level,
        hiring_goal=payload.hiring_goal,
        target_candidate_count=payload.target_candidate_count,
        status="draft",
        created_by=current_user.id,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Auto-trigger workflow
    await workflow_service.start_workflow(
        db=db,
        job_id=job.id,
        goal=payload.hiring_goal,
        user_id=current_user.id,
    )
    logger.info(f"Job {job.id} created and workflow triggered by {current_user.email}")
    return job


# ── Get JD ────────────────────────────────────────────────────────
@router.get("/{job_id}/jd", response_model=JobDescriptionResponse)
async def get_jd(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(JobDescription)
        .where(JobDescription.job_id == job_id)
        .order_by(desc(JobDescription.version))
    )
    jd = result.scalars().first()
    if not jd:
        raise HTTPException(status_code=404, detail="No JD found for this job yet")
    return jd


# ── Approve JD ────────────────────────────────────────────────────
@router.post("/{job_id}/jd/approve", response_model=JobDescriptionResponse)
async def approve_jd(
    job_id: str,
    current_user: User = Depends(require_hiring_manager_or_above),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime

    result = await db.execute(
        select(JobDescription)
        .where(JobDescription.job_id == job_id)
        .order_by(desc(JobDescription.version))
    )
    jd = result.scalars().first()
    if not jd:
        raise HTTPException(status_code=404, detail="No JD found")
    if jd.status == "approved":
        raise HTTPException(status_code=400, detail="JD already approved")

    jd.status = "approved"
    jd.approved_by = current_user.id
    jd.approved_at = datetime.utcnow()

    # Advance job and workflow
    job_result = await db.execute(select(Job).where(Job.id == job_id))
    job = job_result.scalar_one_or_none()
    if job:
        job.status = "approved"
    await db.commit()

    # Advance workflow to sourcing stage and kick off sourcing simulation
    workflow = await workflow_service.get_workflow_status(db, job_id)
    if workflow:
        await workflow_service.advance_stage(
            db, workflow.id, "sourcing",
            {"human_approval": "completed", "sourcing": "running"}
        )
        # Start the sourcing background task so it doesn't hang forever
        await workflow_service.start_sourcing(db, job_id, workflow.id)

    logger.info(f"JD approved for job {job_id} by {current_user.email}")
    await db.refresh(jd)
    return jd


# ── Reject JD ─────────────────────────────────────────────────────
@router.post("/{job_id}/jd/reject", response_model=JobDescriptionResponse)
async def reject_jd(
    job_id: str,
    payload: RejectJDRequest,
    current_user: User = Depends(require_hiring_manager_or_above),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(JobDescription)
        .where(JobDescription.job_id == job_id)
        .order_by(desc(JobDescription.version))
    )
    jd = result.scalars().first()
    if not jd:
        raise HTTPException(status_code=404, detail="No JD found")

    jd.status = "rejected"
    jd.rejection_reason = payload.reason
    await db.commit()
    await db.refresh(jd)

    # Advance stage back to jd_generation AND kick off actual regeneration
    workflow = await workflow_service.get_workflow_status(db, job_id)
    if workflow:
        await workflow_service.advance_stage(
            db, workflow.id, "jd_generation",
            {"human_approval": "idle", "jd_generation": "running"}
        )
        # This fires the background task that creates a new JD version
        await workflow_service.regenerate_jd(
            db, job_id, workflow.id, reason=payload.reason
        )

    logger.info(f"JD rejected for job {job_id}: {payload.reason}")
    return jd


# ── Edit JD ───────────────────────────────────────────────────────
@router.put("/{job_id}/jd", response_model=JobDescriptionResponse)
async def edit_jd(
    job_id: str,
    payload: EditJDRequest,
    current_user: User = Depends(require_hiring_manager_or_above),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(JobDescription)
        .where(JobDescription.job_id == job_id)
        .order_by(desc(JobDescription.version))
    )
    jd = result.scalars().first()
    if not jd:
        raise HTTPException(status_code=404, detail="No JD found")

    # Create a new version with the edited content
    new_jd = JobDescription(
        job_id=job_id,
        content=payload.content,
        version=jd.version + 1,
        status="pending_approval",
    )
    db.add(new_jd)
    await db.commit()
    await db.refresh(new_jd)
    return new_jd


# ── Delete Job ────────────────────────────────────────────────────
@router.delete("/{job_id}", status_code=204)
async def delete_job(
    job_id: str,
    current_user: User = Depends(require_hiring_manager_or_above),
    db: AsyncSession = Depends(get_db),
):
    from backend.database.models import (
        JobDescription, WorkflowState, Candidate, Analytics,
        AgentLog, Resume, CandidateScore, Interview, OnboardingTask
    )
    
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Manually delete related records in correct dependency order
    # 1. Workflow states and agent logs
    wf_result = await db.execute(select(WorkflowState.id).where(WorkflowState.job_id == job_id))
    wf_ids = [r[0] for r in wf_result.all()]
    if wf_ids:
        await db.execute(AgentLog.__table__.delete().where(AgentLog.workflow_id.in_(wf_ids)))
    
    # 2. Candidates and related scores, resumes, interviews, onboarding tasks
    cand_result = await db.execute(select(Candidate.id).where(Candidate.job_id == job_id))
    cand_ids = [r[0] for r in cand_result.all()]
    if cand_ids:
        await db.execute(Resume.__table__.delete().where(Resume.candidate_id.in_(cand_ids)))
        await db.execute(CandidateScore.__table__.delete().where(CandidateScore.candidate_id.in_(cand_ids)))
        await db.execute(Interview.__table__.delete().where(Interview.candidate_id.in_(cand_ids)))
        await db.execute(OnboardingTask.__table__.delete().where(OnboardingTask.candidate_id.in_(cand_ids)))

    # Also delete any candidate scores or interviews directly referencing job_id
    await db.execute(CandidateScore.__table__.delete().where(CandidateScore.job_id == job_id))
    await db.execute(Interview.__table__.delete().where(Interview.job_id == job_id))
    
    # 3. Direct child tables
    await db.execute(JobDescription.__table__.delete().where(JobDescription.job_id == job_id))
    await db.execute(WorkflowState.__table__.delete().where(WorkflowState.job_id == job_id))
    await db.execute(Candidate.__table__.delete().where(Candidate.job_id == job_id))
    await db.execute(Analytics.__table__.delete().where(Analytics.job_id == job_id))
    
    await db.delete(job)
    await db.commit()

    # ── Also remove from HireBoard (localhost:8001) ───────────────
    try:
        import urllib.request as _req
        hb_req = _req.Request(
            f"http://localhost:8001/jobs/{job_id}",
            method="DELETE",
        )
        with _req.urlopen(hb_req, timeout=2):
            pass
        logger.info(f"[Jobs] ✅ Job {job_id} removed from HireBoard")
    except Exception as e:
        logger.warning(f"[Jobs] ⚠️  Could not remove job {job_id} from HireBoard: {e}")

    return None


