"""Pydantic response schemas."""
from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


# ── Auth ─────────────────────────────────────────────────────────
class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Jobs ─────────────────────────────────────────────────────────
class JobResponse(BaseModel):
    id: str
    title: str
    department: str
    location: str
    job_type: str
    experience_level: str
    status: str
    hiring_goal: str
    target_candidate_count: Optional[int] = 3
    created_by: str
    created_at: datetime
    updated_at: datetime
    hired_count: int = 0
    rejected_count: int = 0

    class Config:
        from_attributes = True


class JobDescriptionResponse(BaseModel):
    id: str
    job_id: str
    content: str
    version: int
    status: str
    approved_by: Optional[str]
    approved_at: Optional[datetime]
    rejection_reason: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Candidates ───────────────────────────────────────────────────
class CandidateResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str]
    job_id: str
    status: str
    resume_url: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class CandidateScoreResponse(BaseModel):
    id: str
    score: float
    category: str
    explanation: str
    skills_matched: list[str]
    skills_missing: list[str]
    created_at: datetime

    class Config:
        from_attributes = True


class CandidateProfileResponse(CandidateResponse):
    score: Optional[CandidateScoreResponse] = None


# ── Workflow ─────────────────────────────────────────────────────
class WorkflowStateResponse(BaseModel):
    id: str
    job_id: str
    current_stage: str
    agent_statuses: dict
    started_at: datetime
    updated_at: datetime
    error: Optional[str]

    class Config:
        from_attributes = True


class AgentLogResponse(BaseModel):
    id: str
    workflow_id: str
    agent_name: str
    action: str
    input_summary: Optional[str]
    output_summary: Optional[str]
    latency_ms: int
    token_usage: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Interviews ───────────────────────────────────────────────────
class InterviewResponse(BaseModel):
    id: str
    candidate_id: str
    job_id: str
    scheduled_at: datetime
    duration_minutes: int
    interviewer: str
    interview_type: str
    status: str
    meeting_link: Optional[str]
    calendar_event_id: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Onboarding ───────────────────────────────────────────────────
class OnboardingTaskResponse(BaseModel):
    id: str
    candidate_id: str
    task_name: str
    description: Optional[str]
    assigned_to: str
    status: str
    due_date: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── Analytics ────────────────────────────────────────────────────
class DashboardMetricsResponse(BaseModel):
    active_jobs: int
    total_candidates: int
    interviews_this_week: int
    offers_made: int
    avg_time_to_hire_days: float
    screening_pass_rate: float


class FunnelDataResponse(BaseModel):
    stage: str
    count: int
    conversion_rate: float


class HiringTrendResponse(BaseModel):
    month: str
    applications: int
    shortlisted: int
    hired: int


# ── Pagination ────────────────────────────────────────────────────
class PaginatedResponse(BaseModel):
    items: list[Any]
    total: int
    page: int
    page_size: int
    total_pages: int
