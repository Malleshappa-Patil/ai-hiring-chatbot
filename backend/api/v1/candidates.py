"""Candidates API: listing, ranking, profiles, approve/reject."""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload

from backend.database.session import get_db
from backend.database.models import Candidate, CandidateScore, User, Resume
from backend.api.dependencies import get_current_user
from backend.models.request_models import RejectCandidateRequest
from backend.models.response_models import (
    CandidateResponse, CandidateProfileResponse, PaginatedResponse
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/candidates")


# ── Public: Receive Application from HireBoard ────────────────────
@router.post("/from-hireboard", status_code=201)
async def receive_hireboard_application(
    db: AsyncSession = Depends(get_db),
    # JSON body fields
    name:         str = Query(...),
    email:        str = Query(...),
    phone:        Optional[str] = Query(None),
    job_id:       str = Query(...),          # main backend job UUID
    linkedin_url: Optional[str] = Query(None),
    cover_note:   Optional[str] = Query(None),
    source:       Optional[str] = Query("HireBoard"),
):
    """
    Called by HireBoard when a candidate submits an application.
    Creates a Candidate record in the main DB so recruiters can see
    the applicant immediately in the Candidates panel.
    No authentication required — called server-to-server.
    """
    from backend.database.models import Job

    # Verify job exists
    job_result = await db.execute(select(Job).where(Job.id == job_id))
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found in main platform")

    # Prevent duplicate applications (same email + job)
    existing = await db.execute(
        select(Candidate)
        .where(Candidate.email == email)
        .where(Candidate.job_id == job_id)
    )
    if existing.scalar_one_or_none():
        return {"message": "Candidate already applied", "duplicate": True}

    candidate = Candidate(
        name=name,
        email=email,
        phone=phone,
        job_id=job_id,
        status="applied",
        resume_url=None,    # Resume file lives on HireBoard; URL set below
    )
    db.add(candidate)
    await db.commit()
    await db.refresh(candidate)

    logger.info(
        f"[HireBoard] New applicant: {name} ({email}) → job {job_id} "
        f"[candidate_id={candidate.id}]"
    )
    return {
        "message":      "Candidate created",
        "candidate_id": candidate.id,
        "job_id":       job_id,
    }


# ── List Candidates ────────────────────────────────────────────────
@router.get("/", response_model=PaginatedResponse)
async def list_candidates(
    job_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Candidate)
    if job_id:
        query = query.where(Candidate.job_id == job_id)
    if status:
        query = query.where(Candidate.status == status)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0

    result = await db.execute(
        query.order_by(desc(Candidate.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    candidates = result.scalars().all()

    return {
        "items": [CandidateResponse.model_validate(c) for c in candidates],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, -(-total // page_size)),
    }


# ── Ranked Candidates for a Job ────────────────────────────────────
@router.get("/ranked/{job_id}")
async def get_ranked_candidates(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return candidates sorted by AI score descending."""
    result = await db.execute(
        select(Candidate)
        .where(Candidate.job_id == job_id)
        .options(selectinload(Candidate.score))
        .order_by(desc(Candidate.created_at))
    )
    candidates = result.scalars().all()

    # Sort by score descending (null scores go last)
    candidates_sorted = sorted(
        candidates,
        key=lambda c: (c.score.score if c.score else -1),
        reverse=True
    )

    profiles = []
    for c in candidates_sorted:
        profile = CandidateProfileResponse.model_validate(c)
        profiles.append(profile)
    return profiles


# ── Get Candidate Profile ─────────────────────────────────────────
@router.get("/{candidate_id}", response_model=CandidateProfileResponse)
async def get_candidate(
    candidate_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Candidate)
        .where(Candidate.id == candidate_id)
        .options(selectinload(Candidate.score))
        .options(selectinload(Candidate.interviews))
        .options(selectinload(Candidate.onboarding_tasks))
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate


# ── Upload Resume + Create Candidate ─────────────────────────────
@router.post("/", response_model=CandidateResponse, status_code=201)
async def create_candidate(
    name: str,
    email: str,
    job_id: str,
    phone: Optional[str] = None,
    resume: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually add a candidate or receive from sourcing agent."""
    candidate = Candidate(
        name=name,
        email=email,
        job_id=job_id,
        phone=phone,
        status="applied",
    )
    db.add(candidate)
    await db.flush()  # Get candidate.id before resume

    if resume:
        import os, aiofiles
        from backend.services.resume_parser import parse_resume
        from backend.memory.vector_store import vector_store

        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)
        file_path = f"{upload_dir}/{candidate.id}_{resume.filename}"
        async with aiofiles.open(file_path, "wb") as f:
            content = await resume.read()
            await f.write(content)
        candidate.resume_url = file_path

        resume_record = Resume(
            candidate_id=candidate.id,
            file_path=file_path,
        )
        db.add(resume_record)

        # Parse resume and add to RAG Vector Store
        try:
            parsed_text = parse_resume(file_path)
            if parsed_text:
                vector_store.add_resume(candidate.id, parsed_text)
        except Exception as e:
            logger.error(f"Failed to parse resume for RAG: {e}")

    await db.commit()
    await db.refresh(candidate)
    return candidate


# ── Approve Candidate (Shortlist) ─────────────────────────────────
@router.post("/{candidate_id}/approve", response_model=CandidateResponse)
async def approve_candidate(
    candidate_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from backend.services.workflow_service import workflow_service

    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    candidate.status = "shortlisted"
    await db.commit()
    await db.refresh(candidate)
    
    # Check if workflow should advance
    await workflow_service.check_human_review_status(db, candidate.job_id)

    logger.info(f"Candidate {candidate_id} shortlisted by {current_user.email}")
    return candidate


# ── Reject Candidate ──────────────────────────────────────────────
@router.post("/{candidate_id}/reject", response_model=CandidateResponse)
async def reject_candidate(
    candidate_id: str,
    payload: RejectCandidateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from backend.services.workflow_service import workflow_service

    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    candidate.status = "rejected"
    await db.commit()
    await db.refresh(candidate)

    # Check if workflow should advance
    await workflow_service.check_human_review_status(db, candidate.job_id)

    logger.info(f"Candidate {candidate_id} rejected: {payload.reason}")
    return candidate


# ── Delete Single Candidate ───────────────────────────────────────
@router.delete("/{candidate_id}", status_code=204)
async def delete_candidate(
    candidate_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a candidate and their score/resume records."""
    from sqlalchemy import delete as sql_delete
    from backend.database.models import CandidateScore, Resume

    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Cascade-delete related records
    await db.execute(sql_delete(CandidateScore).where(CandidateScore.candidate_id == candidate_id))
    await db.execute(sql_delete(Resume).where(Resume.candidate_id == candidate_id))
    await db.delete(candidate)
    await db.commit()
    logger.info(f"Candidate {candidate_id} deleted by {current_user.email}")


# ── Admin: Delete ALL Candidates (cleanup tool) ───────────────────
@router.delete("/admin/purge-all", status_code=200)
async def delete_all_candidates(
    confirm: str = "no",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin-only: wipe ALL candidates. Requires confirm=yes query param.
    Used to clear dummy/simulated data so only real applicants remain.
    """
    from sqlalchemy import delete as sql_delete, text
    from backend.database.models import CandidateScore, Resume, Interview, OnboardingTask

    if current_user.role not in ("admin", "recruiter"):
        raise HTTPException(status_code=403, detail="Admin access required")
    if confirm != "yes":
        raise HTTPException(status_code=400, detail="Pass confirm=yes to delete all candidates")

    try:
        # Delete in FK dependency order
        await db.execute(sql_delete(OnboardingTask))
        await db.execute(sql_delete(Interview))
        await db.execute(sql_delete(CandidateScore))
        await db.execute(sql_delete(Resume))
        result = await db.execute(sql_delete(Candidate))
        await db.commit()

        n = result.rowcount
        logger.warning(f"ALL {n} candidates purged by {current_user.email}")
        return {"deleted": n, "message": f"Deleted {n} candidate(s) from the database."}
    except Exception as e:
        await db.rollback()
        logger.error(f"Purge failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
