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

