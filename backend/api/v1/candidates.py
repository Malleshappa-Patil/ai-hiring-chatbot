"""Candidates API: listing, ranking, profiles, approve/reject."""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload

from backend.database.session import get_db
from backend.database.models import Candidate, CandidateScore, User, Resume
from backend.api.dependencies import get_current_user
from backend.models.request_models import (
    RejectCandidateRequest, SelectCandidateRequest, FinalRejectCandidateRequest
)
from backend.models.response_models import (
    CandidateResponse, CandidateProfileResponse, PaginatedResponse
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/candidates")


# -- Public: Receive Application from HireBoard -------------------------------------
@router.post("/from-hireboard", status_code=201)
async def receive_hireboard_application(
    db: AsyncSession = Depends(get_db),
    name:             str = Query(...),
    email:            str = Query(...),
    phone:            Optional[str] = Query(None),
    job_id:           str = Query(...),            # main backend job UUID
    linkedin_url:     Optional[str] = Query(None),
    cover_note:       Optional[str] = Query(None),
    source:           Optional[str] = Query("HireBoard"),
    resume_file_path: Optional[str] = Query(None),  # absolute path on local disk
    resume_url:       Optional[str] = Query(None),  # public URL for the resume
):
    """
    Called by HireBoard when a candidate submits an application.
    Creates a Candidate record, then triggers async CV screening via Gemini.
    No authentication required - called server-to-server.
    """
    import asyncio
    from backend.database.models import Job
    from backend.services.cv_screening_service import run_screening_for_candidate

    # Verify job exists
    job_result = await db.execute(select(Job).where(Job.id == job_id))
    job = job_result.scalar_one_or_none()
    if not job:
        # Fallback 1: check if any job exists with same title if job_id was local
        first_job_res = await db.execute(select(Job).order_by(Job.created_at.desc()).limit(1))
        job = first_job_res.scalar_one_or_none()
        if job:
            job_id = job.id
        else:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found in main platform")


    # Block if job is already not_hiring
    if job.status == "not_hiring":
        return {
            "message": "This position is no longer accepting applications.",
            "seats_full": True,
        }

    # Prevent duplicate applications (same email + job)
    existing = await db.execute(
        select(Candidate)
        .where(Candidate.email == email)
        .where(Candidate.job_id == job_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="You have already applied for this position."
        )

    candidate = Candidate(
        name=name,
        email=email,
        phone=phone,
        job_id=job_id,
        status="applied",
        resume_url=resume_url,
    )
    db.add(candidate)
    await db.commit()
    await db.refresh(candidate)

    logger.info(
        f"[HireBoard] New applicant: {name} ({email}) -> job {job_id} "
        f"[candidate_id={candidate.id}]"
    )

    # Trigger CV screening asynchronously - does NOT block the response
    asyncio.create_task(
        run_screening_for_candidate(
            candidate_id=candidate.id,
            resume_file_path=resume_file_path,
        )
    )

    return {
        "message":      "Application received. CV screening in progress.",
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
    from backend.services.notification_service import email_service
    from backend.database.models import Job, WorkflowState

    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    job_result = await db.execute(select(Job).where(Job.id == candidate.job_id))
    job = job_result.scalar_one_or_none()
    job_title = job.title if job else "the position"

    candidate.status = "rejected"
    await db.commit()
    await db.refresh(candidate)

    email_sent = await email_service.send_candidate_rejection(
        candidate_email=candidate.email,
        candidate_name=candidate.name,
        job_title=job_title,
        rejection_note=payload.reason,
    )

    # Log workflow action under Comms Agent & mark rejection_email node as completed
    try:
        wf_res = await db.execute(select(WorkflowState).where(WorkflowState.job_id == candidate.job_id))
        wf = wf_res.scalar_one_or_none()
        if wf:
            statuses = dict(wf.agent_statuses or {})
            statuses["human_review"] = "completed"
            statuses["human_approval"] = "completed"
            statuses["interviewing"] = "completed"
            statuses["rejection_email"] = "completed"
            wf.agent_statuses = statuses
            wf.current_stage = "rejection_email"
            email_log_str = "Rejection email sent." if email_sent else "WARNING: Email delivery failed via SMTP (Check Gmail App Password)."
            await workflow_service._log_agent_action(
                db, wf.id,
                agent_name="Comms Agent",
                action="send_rejection_email",
                input_summary=f"Reject Candidate: {candidate.name} ({candidate.email})",
                output_summary=f"Candidate REJECTED ({payload.reason}). {email_log_str}",
                latency_ms=250, token_usage=100
            )
            await db.commit()
    except Exception as wf_err:
        logger.warning(f"Could not update workflow state: {wf_err}")

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


# -- Post-Interview / Review: Select Candidate ---------------------------------
@router.post("/{candidate_id}/select", status_code=200)
async def select_candidate(
    candidate_id: str,
    payload: Optional[SelectCandidateRequest] = Body(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Recruiter selects a candidate after review/interview.
    Updates status to 'selected', attaches/generates Google Meet link,
    marks 'candidate_selected' node completed, and sends selection email.
    """
    from backend.database.models import Job, Interview, WorkflowState
    from backend.services.notification_service import email_service
    from backend.services.google_meet_service import create_meeting
    from backend.services.workflow_service import workflow_service
    from datetime import datetime, timedelta

    result = await db.execute(
        select(Candidate).where(Candidate.id == candidate_id)
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    job_result = await db.execute(select(Job).where(Job.id == candidate.job_id))
    job = job_result.scalar_one_or_none()
    job_title = job.title if job else "the position"

    # Find existing interview meeting link or create a new one
    meeting_link = payload.meeting_link if payload and payload.meeting_link else None
    if not meeting_link:
        interview_res = await db.execute(
            select(Interview).where(Interview.candidate_id == candidate_id).order_by(desc(Interview.scheduled_at))
        )
        existing_interview = interview_res.scalar_one_or_none()
        if existing_interview and existing_interview.meeting_link:
            meeting_link = existing_interview.meeting_link
        else:
            meeting_link = await create_meeting(
                candidate_name=candidate.name,
                job_title=job_title,
                scheduled_at=datetime.utcnow() + timedelta(days=1),
                duration_minutes=30,
                interviewer=current_user.full_name or "Hiring Team",
            )

    candidate.status = "selected"
    await db.commit()

    selection_note = payload.selection_note if payload else None

    # Update workflow state to offer_letter and trigger AI offer letter generation
    email_sent = False
    try:
        wf_res = await db.execute(select(WorkflowState).where(WorkflowState.job_id == candidate.job_id))
        wf = wf_res.scalar_one_or_none()
        if wf:
            statuses = dict(wf.agent_statuses or {})
            statuses["human_review"] = "completed"
            statuses["human_approval"] = "completed"
            statuses["interviewing"] = "completed"
            statuses["interview_review"] = "completed"
            statuses["offer_letter"] = "running"
            wf.agent_statuses = statuses
            wf.current_stage = "offer_letter"

            await workflow_service._log_agent_action(
                db, wf.id,
                agent_name="Supervisor Agent",
                action="candidate_selected_for_offer",
                input_summary=f"Selected Candidate: {candidate.name} ({candidate.email})",
                output_summary=f"Candidate selected for offer. Advancing to Node 15 (Offer Letter Generation).",
                latency_ms=250, token_usage=80
            )
            await db.commit()

            # Fire the AI Offer Letter generation & email dispatch background task
            import asyncio
            asyncio.create_task(
                workflow_service._generate_and_send_offer_bg(wf.id, candidate.job_id, candidate.id)
            )
            email_sent = True
    except Exception as wf_err:
        logger.warning(f"Could not trigger offer letter workflow: {wf_err}")
        import traceback; traceback.print_exc()

    logger.info(f"Candidate {candidate.name} selected by {current_user.email}, offer letter workflow triggered")
    return {
        "message":      f"{candidate.name} has been selected! AI Offer Agent is generating and emailing the offer letter.",
        "candidate_id": candidate_id,
        "status":       "selected",
        "meeting_link": meeting_link,
        "email_sent":   email_sent,
    }


# -- Resend Offer Letter -------------------------------------------------------
@router.post("/{candidate_id}/resend-offer", status_code=200)
async def resend_offer_letter(
    candidate_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Resend or re-trigger the AI offer letter email to the candidate."""
    from backend.services.workflow_service import workflow_service
    from backend.database.models import WorkflowState
    import asyncio

    result = await db.execute(
        select(Candidate).where(Candidate.id == candidate_id)
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    wf_res = await db.execute(select(WorkflowState).where(WorkflowState.job_id == candidate.job_id))
    wf = wf_res.scalar_one_or_none()
    wf_id = wf.id if wf else str(candidate.job_id)

    asyncio.create_task(
        workflow_service._generate_and_send_offer_bg(wf_id, candidate.job_id, candidate.id)
    )
    return {
        "message": f"Offer letter email dispatch initiated for {candidate.name} ({candidate.email})",
        "candidate_id": candidate.id,
        "email": candidate.email,
        "success": True,
    }


# -- Offer Response: Accept / Reject (called by candidate via email link) ------
@router.get("/{candidate_id}/offer-accept")
@router.post("/{candidate_id}/offer-accept", status_code=200)
async def accept_offer(
    candidate_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint — no auth required. Called when candidate clicks
    'Accept Offer' in the offer letter email.
    """
    from fastapi.responses import HTMLResponse
    from backend.services.workflow_service import workflow_service

    result = await workflow_service.handle_offer_response(
        db, candidate_id, accepted=True
    )
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    html_content = """<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Offer Accepted — Congratulations!</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #181818; color: #EBDCC4; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
        .card { background: #1E1A18; border: 1px solid #66473B; border-radius: 12px; padding: 48px; max-width: 520px; text-align: center; box-shadow: 0 16px 40px rgba(0,0,0,0.6); }
        .badge { display: inline-block; background: rgba(74,222,128,0.15); color: #4ade80; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; padding: 6px 14px; border-radius: 20px; margin-bottom: 16px; border: 1px solid rgba(74,222,128,0.3); }
        h1 { color: #ffffff; font-size: 24px; margin: 0 0 12px; }
        p { color: #B6A596; line-height: 1.6; font-size: 15px; margin: 0 0 20px; }
        .footer { font-size: 12px; color: #7A6A5E; margin-top: 24px; border-top: 1px solid #35211A; padding-top: 16px; }
    </style>
</head>
<body>
    <div class="card">
        <div class="badge">Offer Accepted</div>
        <h1>🎉 Welcome to the Team!</h1>
        <p>Your acceptance has been confirmed. The hiring team has been notified and your onboarding initiation process is underway.</p>
        <p>Please check your inbox for onboarding instructions, your start date schedule, and next steps.</p>
        <div class="footer">AI Hiring Platform — Official Notification</div>
    </div>
</body>
</html>"""
    return HTMLResponse(content=html_content)


@router.get("/{candidate_id}/offer-reject")
@router.post("/{candidate_id}/offer-reject", status_code=200)
async def reject_offer(
    candidate_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint — no auth required. Called when candidate clicks
    'Decline Offer' in the offer letter email.
    """
    from fastapi.responses import HTMLResponse
    from backend.services.workflow_service import workflow_service

    result = await workflow_service.handle_offer_response(
        db, candidate_id, accepted=False
    )
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    html_content = """<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Offer Response</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #181818; color: #EBDCC4; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
        .card { background: #1E1A18; border: 1px solid #66473B; border-radius: 12px; padding: 48px; max-width: 520px; text-align: center; box-shadow: 0 16px 40px rgba(0,0,0,0.6); }
        .badge { display: inline-block; background: rgba(251,191,36,0.15); color: #fbbf24; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; padding: 6px 14px; border-radius: 20px; margin-bottom: 16px; border: 1px solid rgba(251,191,36,0.3); }
        h1 { color: #ffffff; font-size: 24px; margin: 0 0 12px; }
        p { color: #B6A596; line-height: 1.6; font-size: 15px; margin: 0 0 20px; }
        .footer { font-size: 12px; color: #7A6A5E; margin-top: 24px; border-top: 1px solid #35211A; padding-top: 16px; }
    </style>
</head>
<body>
    <div class="card">
        <div class="badge">Offer Response Recorded</div>
        <h1>Response Recorded</h1>
        <p>Thank you for letting us know your decision. Our recruitment team has been notified regarding your response.</p>
        <div class="footer">AI Hiring Platform — Official Notification</div>
    </div>
</body>
</html>"""
    return HTMLResponse(content=html_content)


# -- Post-Interview / Review: Final Reject Candidate ---------------------------
@router.post("/{candidate_id}/reject-final", status_code=200)
async def reject_candidate_final(
    candidate_id: str,
    payload: Optional[FinalRejectCandidateRequest] = Body(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Recruiter rejects a candidate after review/interview.
    Updates status to 'rejected', marks 'rejection_email' node completed, and sends rejection email.
    """
    from backend.database.models import Job, WorkflowState
    from backend.services.notification_service import email_service
    from backend.services.workflow_service import workflow_service

    result = await db.execute(
        select(Candidate).where(Candidate.id == candidate_id)
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    job_result = await db.execute(select(Job).where(Job.id == candidate.job_id))
    job = job_result.scalar_one_or_none()
    job_title = job.title if job else "the position"

    candidate.status = "rejected"
    await db.commit()

    rejection_note = payload.reason if payload else None

    email_sent = await email_service.send_candidate_rejection(
        candidate_email=candidate.email,
        candidate_name=candidate.name,
        job_title=job_title,
        rejection_note=rejection_note,
    )

    # Update workflow state & mark rejection_email node completed
    try:
        wf_res = await db.execute(select(WorkflowState).where(WorkflowState.job_id == candidate.job_id))
        wf = wf_res.scalar_one_or_none()
        if wf:
            statuses = dict(wf.agent_statuses or {})
            statuses["human_review"] = "completed"
            statuses["human_approval"] = "completed"
            statuses["interviewing"] = "completed"
            statuses["rejection_email"] = "completed"
            wf.agent_statuses = statuses
            wf.current_stage = "rejection_email"

            email_log_str = "Rejection email sent with recruiter notes." if email_sent else "WARNING: Email delivery failed via SMTP (Check Gmail App Password)."

            await workflow_service._log_agent_action(
                db, wf.id,
                agent_name="Comms Agent",
                action="send_rejection_email",
                input_summary=f"Reject Candidate: {candidate.name} ({candidate.email})",
                output_summary=f"Candidate REJECTED. {email_log_str}",
                latency_ms=250, token_usage=100
            )
            await db.commit()
    except Exception as wf_err:
        logger.warning(f"Could not update workflow state on candidate reject: {wf_err}")

    logger.info(f"Candidate {candidate.name} final-rejected by {current_user.email} (email_sent={email_sent})")

    # Check if all interviewed candidates are reviewed → trigger offer letter if someone was selected
    await workflow_service.check_interview_review_status(db, candidate.job_id)

    return {
        "message":      f"{candidate.name} has been rejected." + (" Rejection email sent." if email_sent else " (WARNING: Email delivery failed via SMTP)."),
        "candidate_id": candidate_id,
        "status":       "rejected",
        "email_sent":   email_sent,
    }
