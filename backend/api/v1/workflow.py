"""Workflow API: start, status, logs, pause, resume."""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.database.session import get_db
from backend.database.models import User, WorkflowState
from backend.api.dependencies import get_current_user
from backend.models.request_models import StartWorkflowRequest
from backend.models.response_models import WorkflowStateResponse, AgentLogResponse
from backend.services.workflow_service import workflow_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/workflow")


@router.post("/start", response_model=WorkflowStateResponse, status_code=201)
async def start_workflow(
    payload: StartWorkflowRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a new hiring workflow for a job."""
    state = await workflow_service.start_workflow(
        db=db,
        job_id=payload.job_id,
        goal=payload.goal,
        user_id=current_user.id,
    )
    return state


@router.get("/{job_id}/status", response_model=WorkflowStateResponse)
async def get_workflow_status(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current stage and agent statuses for a job's workflow."""
    state = await workflow_service.get_workflow_status(db, job_id)
    if not state:
        raise HTTPException(status_code=404, detail="No workflow found for this job")
    return state


@router.get("/{job_id}/logs", response_model=list[AgentLogResponse])
async def get_workflow_logs(
    job_id: str,
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve agent execution logs for a job's workflow."""
    logs = await workflow_service.get_workflow_logs(db, job_id, limit=limit)
    return logs


@router.post("/{job_id}/pause")
async def pause_workflow(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pause an active workflow (human override)."""
    state = await workflow_service.get_workflow_status(db, job_id)
    if not state:
        raise HTTPException(status_code=404, detail="No workflow found")
    if state.current_stage in ("completed", "failed"):
        raise HTTPException(status_code=400, detail="Workflow already finished")
    await workflow_service.advance_stage(db, state.id, "paused")
    return {"message": "Workflow paused", "job_id": job_id}


@router.post("/{job_id}/resume")
async def resume_workflow(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Resume a paused workflow."""
    state = await workflow_service.get_workflow_status(db, job_id)
    if not state:
        raise HTTPException(status_code=404, detail="No workflow found")
    # Resume from after human_approval stage
    await workflow_service.advance_stage(db, state.id, "sourcing")
    return {"message": "Workflow resumed", "job_id": job_id}


@router.post("/{job_id}/retry-interview")
async def retry_interview(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-trigger the interview simulation for a workflow stuck at the interviewing stage."""
    state = await workflow_service.get_workflow_status(db, job_id)
    if not state:
        raise HTTPException(status_code=404, detail="No workflow found for this job")
    if state.current_stage not in ("interviewing", "human_review"):
        raise HTTPException(status_code=400, detail=f"Workflow is in '{state.current_stage}' stage. Only 'interviewing' or 'human_review' stages can be retried.")

    # Ensure stage is set to interviewing with correct status
    await workflow_service.advance_stage(
        db, state.id, "interviewing",
        {"interview": "running"}
    )
    # Re-trigger interview simulation
    await workflow_service.start_interview_simulation(db, job_id, state.id)
    return {"message": "Interview simulation re-triggered", "job_id": job_id}
