"""Pydantic request schemas."""
from pydantic import BaseModel, EmailStr
from typing import Optional, Literal


# ── Auth ─────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    company_name: Optional[str] = None
    role: Literal["recruiter", "hiring_manager", "admin"] = "recruiter"


# ── Jobs ─────────────────────────────────────────────────────────
class CreateJobRequest(BaseModel):
    title: str
    department: str
    location: str
    job_type: Literal["full_time", "part_time", "contract", "remote"] = "full_time"
    experience_level: str
    hiring_goal: str
    target_candidate_count: Optional[int] = 3



class ApproveJDRequest(BaseModel):
    pass


class RejectJDRequest(BaseModel):
    reason: str


class EditJDRequest(BaseModel):
    content: str


# ── Workflow ─────────────────────────────────────────────────────
class StartWorkflowRequest(BaseModel):
    job_id: str
    goal: str


# ── Candidates ───────────────────────────────────────────────────
class RejectCandidateRequest(BaseModel):
    reason: str


# ── Interviews ───────────────────────────────────────────────────
class ScheduleInterviewRequest(BaseModel):
    candidate_id: str
    job_id: str
    scheduled_at: str  # ISO datetime string
    duration_minutes: int = 60
    interviewer: str
    interview_type: Literal["technical", "hr", "cultural_fit", "final"] = "technical"


# ── Onboarding ───────────────────────────────────────────────────
class UpdateTaskRequest(BaseModel):
    status: Literal["pending", "in_progress", "completed"]


# ── Refresh Token ────────────────────────────────────────────────
class RefreshTokenRequest(BaseModel):
    refresh_token: str
