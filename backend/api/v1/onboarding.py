"""Onboarding API: task management for newly hired candidates."""
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.database.session import get_db
from backend.database.models import OnboardingTask, Candidate, User
from backend.api.dependencies import get_current_user
from backend.models.request_models import UpdateTaskRequest
from backend.models.response_models import OnboardingTaskResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/onboarding")


@router.get("/{candidate_id}/tasks", response_model=list[OnboardingTaskResponse])
async def get_onboarding_tasks(
    candidate_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all onboarding tasks for a candidate."""
    result = await db.execute(
        select(OnboardingTask)
        .where(OnboardingTask.candidate_id == candidate_id)
        .order_by(OnboardingTask.due_date)
    )
    return result.scalars().all()


@router.patch("/tasks/{task_id}", response_model=OnboardingTaskResponse)
async def update_task_status(
    task_id: str,
    payload: UpdateTaskRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the status of an onboarding task."""
    result = await db.execute(select(OnboardingTask).where(OnboardingTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.status = payload.status
    if payload.status == "completed":
        task.completed_at = datetime.utcnow()
    else:
        task.completed_at = None

    await db.commit()
    await db.refresh(task)
    logger.info(f"Onboarding task {task_id} → {payload.status}")
    return task


@router.post("/{candidate_id}/initialize", response_model=list[OnboardingTaskResponse])
async def initialize_onboarding(
    candidate_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create the default onboarding task checklist for a newly hired candidate.
    Phase 3: Onboarding Agent will trigger this automatically.
    """
    # Validate candidate
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    from datetime import timedelta
    now = datetime.utcnow()

    default_tasks = [
        {"name": "Send offer letter",              "owner": "HR",    "days": 1},
        {"name": "Background verification",         "owner": "HR",    "days": 3},
        {"name": "Create employee profile in HRMS", "owner": "HR",    "days": 5},
        {"name": "Laptop & hardware provisioning",  "owner": "IT",    "days": 5},
        {"name": "Create corporate email account",  "owner": "IT",    "days": 5},
        {"name": "Access card & security badge",    "owner": "Admin", "days": 7},
        {"name": "Set up Slack & communication tools", "owner": "IT", "days": 7},
        {"name": "Repository & codebase access",    "owner": "IT",    "days": 7},
        {"name": "First day orientation session",   "owner": "HR",    "days": 10},
        {"name": "Team introductions & buddy setup","owner": "Manager","days": 10},
        {"name": "30-day check-in scheduled",       "owner": "Manager","days": 30},
    ]

    tasks = []
    for t in default_tasks:
        task = OnboardingTask(
            candidate_id=candidate_id,
            task_name=t["name"],
            assigned_to=t["owner"],
            status="pending",
            due_date=now + timedelta(days=t["days"]),
        )
        db.add(task)
        tasks.append(task)

    # Update candidate status
    candidate.status = "onboarding"
    await db.commit()

    return tasks
