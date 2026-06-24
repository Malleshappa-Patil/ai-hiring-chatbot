"""Interviews API: schedule, list, update status."""
import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from backend.database.session import get_db
from backend.database.models import Interview, Candidate, User
from backend.api.dependencies import get_current_user
from backend.models.request_models import ScheduleInterviewRequest
from backend.models.response_models import InterviewResponse
from backend.services.notification_service import email_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/interviews")


@router.get("/", response_model=list[InterviewResponse])
async def list_interviews(
    job_id: Optional[str] = Query(None),
    candidate_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Interview).order_by(desc(Interview.scheduled_at))
    if job_id:
        query = query.where(Interview.job_id == job_id)
    if candidate_id:
        query = query.where(Interview.candidate_id == candidate_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{interview_id}", response_model=InterviewResponse)
async def get_interview(
    interview_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Interview).where(Interview.id == interview_id))
    interview = result.scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return interview


@router.post("/", response_model=InterviewResponse, status_code=201)
async def schedule_interview(
    payload: ScheduleInterviewRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Schedule an interview and notify the candidate via email."""
    # Validate candidate exists
    result = await db.execute(select(Candidate).where(Candidate.id == payload.candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Parse scheduled_at
    try:
        scheduled_at = datetime.fromisoformat(payload.scheduled_at.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid datetime format. Use ISO 8601.")

    # Create interview record
    interview = Interview(
        candidate_id=payload.candidate_id,
        job_id=payload.job_id,
        scheduled_at=scheduled_at,
        duration_minutes=payload.duration_minutes,
        interviewer=payload.interviewer,
        interview_type=payload.interview_type,
        status="scheduled",
        meeting_link=f"https://meet.hiring-platform.com/interview/{payload.candidate_id}",  # Mock link
    )
    db.add(interview)

    # Update candidate status
    candidate.status = "interview_scheduled"
    await db.commit()
    await db.refresh(interview)

    # Send notification email
    await email_service.send_interview_invitation(
        candidate_email=candidate.email,
        candidate_name=candidate.name,
        job_title=f"Position #{payload.job_id}",
        scheduled_at=scheduled_at.strftime("%B %d, %Y at %H:%M UTC"),
        interviewer=payload.interviewer,
        meeting_link=interview.meeting_link,
    )

    logger.info(f"Interview scheduled for candidate {candidate.email} on {scheduled_at}")
    return interview


@router.patch("/{interview_id}/status", response_model=InterviewResponse)
async def update_interview_status(
    interview_id: str,
    status: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    valid_statuses = ["scheduled", "completed", "cancelled", "rescheduled"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {valid_statuses}")

    result = await db.execute(select(Interview).where(Interview.id == interview_id))
    interview = result.scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    interview.status = status

    # Update candidate status on completion
    if status == "completed":
        candidate_result = await db.execute(
            select(Candidate).where(Candidate.id == interview.candidate_id)
        )
        candidate = candidate_result.scalar_one_or_none()
        if candidate:
            candidate.status = "interviewed"

    await db.commit()
    await db.refresh(interview)
    return interview
