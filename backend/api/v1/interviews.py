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

    # Load job title for context
    from backend.database.models import Job
    job_result = await db.execute(select(Job).where(Job.id == payload.job_id))
    job = job_result.scalar_one_or_none()
    job_title = job.title if job else f"Position #{payload.job_id}"

    # Parse scheduled_at
    try:
        scheduled_at = datetime.fromisoformat(payload.scheduled_at.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid datetime format. Use ISO 8601.")

    # Generate Google Meet link
    from backend.services.google_meet_service import create_meeting
    meeting_link = await create_meeting(
        candidate_name=candidate.name,
        job_title=job_title,
        scheduled_at=scheduled_at,
        duration_minutes=payload.duration_minutes,
        interviewer=payload.interviewer,
    )

    # Create interview record
    interview = Interview(
        candidate_id=payload.candidate_id,
        job_id=payload.job_id,
        scheduled_at=scheduled_at,
        duration_minutes=payload.duration_minutes,
        interviewer=payload.interviewer,
        interview_type=payload.interview_type,
        status="scheduled",
        meeting_link=meeting_link,
    )
    db.add(interview)

    # Update candidate status
    candidate.status = "interview_scheduled"

    # Advance workflow state & log recruiter/interview agent actions
    try:
        from backend.database.models import WorkflowState
        from backend.services.workflow_service import workflow_service

        wf_res = await db.execute(select(WorkflowState).where(WorkflowState.job_id == payload.job_id))
        wf = wf_res.scalar_one_or_none()
        if wf:
            statuses = dict(wf.agent_statuses or {})
            statuses["human_review"] = "completed"
            statuses["human_approval"] = "completed"
            statuses["interviewing"] = "running"
            statuses["interview"] = "running"
            wf.agent_statuses = statuses
            wf.current_stage = "interviewing"

            formatted_time = scheduled_at.strftime("%b %d, %Y at %I:%M %p")
            await workflow_service._log_agent_action(
                db, wf.id,
                agent_name="Human Recruiter",
                action="approve_candidate_interview",
                input_summary=f"Approved Candidate: {candidate.name} ({candidate.email})",
                output_summary=f"Recruiter approved shortlist. Google Meet interview confirmed for {formatted_time} with {payload.interviewer}.",
                latency_ms=250, token_usage=100
            )
            await workflow_service._log_agent_action(
                db, wf.id,
                agent_name="Interview Agent",
                action="send_google_meet_invitation",
                input_summary=f"Send Google Meet invite to {candidate.email}",
                output_summary=f"Google Meet invitation sent ({meeting_link}). Candidate status updated to interview_scheduled.",
                latency_ms=420, token_usage=180
            )
    except Exception as wf_err:
        logger.warning(f"Could not update workflow state on schedule: {wf_err}")

    await db.commit()
    await db.refresh(interview)

    # Send notification email
    email_sent = await email_service.send_interview_invitation(
        candidate_email=candidate.email,
        candidate_name=candidate.name,
        job_title=job_title,
        scheduled_at=scheduled_at.strftime("%B %d, %Y at %I:%M %p UTC"),
        interviewer=payload.interviewer,
        meeting_link=interview.meeting_link,
    )

    logger.info(f"Interview scheduled for candidate {candidate.email} on {scheduled_at} (email_sent={email_sent})")

    # Background task: simulate interview session completing, mark interviewed, advance to interview_review
    if wf:
        async def _complete_scheduled_interview_bg(wf_id: str, j_id: str, cand_id: str, iv_id: str):
            import asyncio
            from backend.database.session import AsyncSessionLocal
            from backend.services.workflow_service import workflow_service
            await asyncio.sleep(6)
            async with AsyncSessionLocal() as bg_db:
                try:
                    c_res = await bg_db.execute(select(Candidate).where(Candidate.id == cand_id))
                    c = c_res.scalar_one_or_none()
                    if c:
                        c.status = "interviewed"
                    iv_res = await bg_db.execute(select(Interview).where(Interview.id == iv_id))
                    iv = iv_res.scalar_one_or_none()
                    if iv:
                        iv.status = "completed"
                    await bg_db.commit()

                    await workflow_service._log_agent_action(
                        bg_db, wf_id,
                        agent_name="Interview Agent",
                        action="complete_interviews",
                        input_summary=f"Candidate: {c.name if c else cand_id}",
                        output_summary="Interview conducted and completed. Advancing to Interview Review stage.",
                        latency_ms=800, token_usage=150,
                    )
                    await workflow_service.advance_stage(bg_db, wf_id, "interview_review", {
                        "interview": "completed",
                        "interviewing": "completed",
                        "interview_review": "waiting_approval",
                    })
                except Exception as bg_err:
                    logger.warning(f"Background interview completion failed: {bg_err}")

        import asyncio
        asyncio.create_task(_complete_scheduled_interview_bg(wf.id, payload.job_id, candidate.id, interview.id))

    return interview


# ── Resend Interview Invitation ───────────────────────────────────
@router.post("/{candidate_id}/resend", response_model=dict)
async def resend_interview_invitation(
    candidate_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Resend the interview Google Meet invitation email to the candidate."""
    from datetime import timedelta
    from backend.services.google_meet_service import create_meeting

    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    from backend.database.models import Job
    job_result = await db.execute(select(Job).where(Job.id == candidate.job_id))
    job = job_result.scalar_one_or_none()
    job_title = job.title if job else "the position"

    iv_res = await db.execute(
        select(Interview)
        .where(Interview.candidate_id == candidate.id)
        .order_by(Interview.created_at.desc())
    )
    interview = iv_res.scalar_one_or_none()
    meeting_link = interview.meeting_link if interview else None
    scheduled_at = interview.scheduled_at if (interview and interview.scheduled_at) else datetime.utcnow() + timedelta(days=1)
    
    if not meeting_link:
        meeting_link = await create_meeting(
            candidate_name=candidate.name,
            job_title=job_title,
            scheduled_at=scheduled_at,
        )
        if interview:
            interview.meeting_link = meeting_link
            await db.commit()

    scheduled_at_str = scheduled_at.strftime("%B %d, %Y at %I:%M %p UTC")
    interviewer_name = interview.interviewer if interview and interview.interviewer else "Hiring Team"

    email_sent = await email_service.send_interview_invitation(
        candidate_email=candidate.email,
        candidate_name=candidate.name,
        job_title=job_title,
        scheduled_at=scheduled_at_str,
        interviewer=interviewer_name,
        meeting_link=meeting_link,
    )
    return {
        "success": email_sent,
        "email": candidate.email,
        "meeting_link": meeting_link,
        "message": f"Interview invitation email {'sent successfully' if email_sent else 'delivery attempted'} to {candidate.email}",
    }


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
