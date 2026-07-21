"""
SQLAlchemy ORM models for the AI Hiring Platform.
Defines all 11 database tables.
"""
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    String, Text, Integer, Float, Boolean, DateTime,
    ForeignKey, JSON, Enum as SAEnum
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from backend.database.session import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


# ── Users ─────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    company_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default="company-001")
    company_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, default="TechCorp Inc.")
    role: Mapped[str] = mapped_column(SAEnum("recruiter", "hiring_manager", "admin", name="user_role"), default="recruiter")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    jobs: Mapped[list["Job"]] = relationship("Job", back_populates="creator")


# ── Jobs ──────────────────────────────────────────────────────────
class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    company_id: Mapped[str] = mapped_column(String(50), default="company-001")
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    location: Mapped[str] = mapped_column(String(100), nullable=False)
    job_type: Mapped[str] = mapped_column(SAEnum("full_time", "part_time", "contract", "remote", name="job_type"), default="full_time")
    experience_level: Mapped[str] = mapped_column(String(100), nullable=False)
    hiring_goal: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="draft")
    target_candidate_count: Mapped[Optional[int]] = mapped_column(Integer, default=3, nullable=True)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


    # Relationships
    creator: Mapped["User"] = relationship("User", back_populates="jobs")
    job_descriptions: Mapped[list["JobDescription"]] = relationship("JobDescription", back_populates="job")
    candidates: Mapped[list["Candidate"]] = relationship("Candidate", back_populates="job")
    workflow_states: Mapped[list["WorkflowState"]] = relationship("WorkflowState", back_populates="job")


# ── Job Descriptions ──────────────────────────────────────────────
class JobDescription(Base):
    __tablename__ = "job_descriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("jobs.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(30), default="draft")
    approved_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    job: Mapped["Job"] = relationship("Job", back_populates="job_descriptions")


# ── Candidates ────────────────────────────────────────────────────
class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("jobs.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="applied")
    resume_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    job: Mapped["Job"] = relationship("Job", back_populates="candidates")
    resume: Mapped[Optional["Resume"]] = relationship("Resume", back_populates="candidate", uselist=False)
    score: Mapped[Optional["CandidateScore"]] = relationship("CandidateScore", back_populates="candidate", uselist=False)
    interviews: Mapped[list["Interview"]] = relationship("Interview", back_populates="candidate")
    onboarding_tasks: Mapped[list["OnboardingTask"]] = relationship("OnboardingTask", back_populates="candidate")


# ── Resumes ───────────────────────────────────────────────────────
class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    candidate_id: Mapped[str] = mapped_column(String(36), ForeignKey("candidates.id"), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    parsed_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="resume")


# ── Candidate Scores ──────────────────────────────────────────────
class CandidateScore(Base):
    __tablename__ = "candidate_scores"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    candidate_id: Mapped[str] = mapped_column(String(36), ForeignKey("candidates.id"), nullable=False)
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("jobs.id"), nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    category: Mapped[str] = mapped_column(SAEnum("strong_match", "partial_match", "weak_match", name="match_category"), nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    skills_matched: Mapped[list] = mapped_column(JSON, default=list)
    skills_missing: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="score")


# ── Interviews ────────────────────────────────────────────────────
class Interview(Base):
    __tablename__ = "interviews"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    candidate_id: Mapped[str] = mapped_column(String(36), ForeignKey("candidates.id"), nullable=False)
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("jobs.id"), nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    interviewer: Mapped[str] = mapped_column(String(255), nullable=False)
    interview_type: Mapped[str] = mapped_column(SAEnum("technical", "hr", "cultural_fit", "final", name="interview_type"), default="technical")
    status: Mapped[str] = mapped_column(SAEnum("scheduled", "completed", "cancelled", "rescheduled", name="interview_status"), default="scheduled")
    meeting_link: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    calendar_event_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="interviews")


# ── Workflow States ───────────────────────────────────────────────
class WorkflowState(Base):
    __tablename__ = "workflow_states"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("jobs.id"), nullable=False)
    current_stage: Mapped[str] = mapped_column(String(50), default="not_started")
    agent_statuses: Mapped[dict] = mapped_column(JSON, default=dict)
    state_data: Mapped[dict] = mapped_column(JSON, default=dict)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    job: Mapped["Job"] = relationship("Job", back_populates="workflow_states")


# ── Agent Logs ────────────────────────────────────────────────────
class AgentLog(Base):
    __tablename__ = "agent_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    workflow_id: Mapped[str] = mapped_column(String(36), ForeignKey("workflow_states.id"), nullable=False)
    agent_name: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[str] = mapped_column(String(255), nullable=False)
    input_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    output_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    token_usage: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(SAEnum("success", "failure", name="log_status"), default="success")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ── Onboarding Tasks ──────────────────────────────────────────────
class OnboardingTask(Base):
    __tablename__ = "onboarding_tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    candidate_id: Mapped[str] = mapped_column(String(36), ForeignKey("candidates.id"), nullable=False)
    task_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    assigned_to: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(SAEnum("pending", "in_progress", "completed", name="task_status"), default="pending")
    due_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="onboarding_tasks")


# ── Analytics ─────────────────────────────────────────────────────
class Analytics(Base):
    __tablename__ = "analytics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    job_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("jobs.id"), nullable=True)
    metric_name: Mapped[str] = mapped_column(String(100), nullable=False)
    metric_value: Mapped[float] = mapped_column(Float, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
