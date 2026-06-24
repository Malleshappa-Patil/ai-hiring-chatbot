"""
PostgreSQL long-term memory queries.
Stores historical hiring information, analytics, and recruiter preferences.
"""
import logging
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc

from backend.database.models import (
    Job, JobDescription, Candidate, CandidateScore,
    Interview, WorkflowState, AgentLog, Analytics, OnboardingTask
)

logger = logging.getLogger(__name__)


class LongTermMemory:
    """PostgreSQL-backed long-term memory for historical hiring data."""

    # ── Hiring History ─────────────────────────────────────────────
    async def get_job_history(self, db: AsyncSession, limit: int = 20) -> list[Job]:
        """Retrieve past completed/closed jobs."""
        result = await db.execute(
            select(Job)
            .where(Job.status.in_(["closed", "completed"]))
            .order_by(desc(Job.created_at))
            .limit(limit)
        )
        return result.scalars().all()

    async def get_approved_jds(self, db: AsyncSession, title_like: str = "") -> list[JobDescription]:
        """Retrieve previously approved JDs for RAG context."""
        query = select(JobDescription).where(JobDescription.status == "approved")
        if title_like:
            query = query.join(Job).where(Job.title.ilike(f"%{title_like}%"))
        result = await db.execute(query.order_by(desc(JobDescription.approved_at)).limit(10))
        return result.scalars().all()

    async def get_candidate_outcomes(self, db: AsyncSession, job_id: str) -> list[Candidate]:
        """Get all candidates and their outcomes for a job."""
        result = await db.execute(
            select(Candidate)
            .where(Candidate.job_id == job_id)
            .order_by(desc(Candidate.created_at))
        )
        return result.scalars().all()

    # ── Analytics Storage ──────────────────────────────────────────
    async def record_metric(
        self, db: AsyncSession, metric_name: str, metric_value: float,
        job_id: Optional[str] = None
    ) -> None:
        """Record a hiring metric data point."""
        entry = Analytics(
            job_id=job_id,
            metric_name=metric_name,
            metric_value=metric_value,
        )
        db.add(entry)
        await db.commit()

    async def get_dashboard_metrics(self, db: AsyncSession) -> dict:
        """Aggregate dashboard metrics from live DB data."""
        # Active jobs count
        active_jobs_result = await db.execute(
            select(func.count(Job.id)).where(Job.status.notin_(["closed", "draft"]))
        )
        active_jobs = active_jobs_result.scalar() or 0

        # Total candidates
        total_candidates_result = await db.execute(select(func.count(Candidate.id)))
        total_candidates = total_candidates_result.scalar() or 0

        # Interviews this week
        week_start = datetime.utcnow() - timedelta(days=7)
        interviews_result = await db.execute(
            select(func.count(Interview.id)).where(Interview.scheduled_at >= week_start)
        )
        interviews_this_week = interviews_result.scalar() or 0

        # Offers made (candidates in selected/onboarding)
        offers_result = await db.execute(
            select(func.count(Candidate.id)).where(
                Candidate.status.in_(["selected", "onboarding"])
            )
        )
        offers_made = offers_result.scalar() or 0

        # Average score (as proxy for screening pass rate)
        score_result = await db.execute(
            select(func.avg(CandidateScore.score))
        )
        avg_score = score_result.scalar() or 0.0

        # Screening pass rate: strong_match / total screened
        total_screened_result = await db.execute(select(func.count(CandidateScore.id)))
        strong_match_result = await db.execute(
            select(func.count(CandidateScore.id)).where(CandidateScore.category == "strong_match")
        )
        total_screened = total_screened_result.scalar() or 1
        strong_match = strong_match_result.scalar() or 0
        pass_rate = round((strong_match / max(total_screened, 1)) * 100, 1)

        return {
            "active_jobs": active_jobs,
            "total_candidates": total_candidates,
            "interviews_this_week": interviews_this_week,
            "offers_made": offers_made,
            "avg_time_to_hire_days": 21.5,  # Will be computed from real data in Phase 3
            "screening_pass_rate": pass_rate,
        }

    async def get_hiring_funnel(self, db: AsyncSession, job_id: Optional[str] = None) -> list[dict]:
        """Get funnel metrics showing candidates at each stage."""
        stages = [
            ("Applied", ["applied", "screening", "shortlisted", "interview_scheduled", "interviewed", "selected", "onboarding", "rejected"]),
            ("Screening", ["screening", "shortlisted", "interview_scheduled", "interviewed", "selected", "onboarding", "rejected"]),
            ("Shortlisted", ["shortlisted", "interview_scheduled", "interviewed", "selected", "onboarding"]),
            ("Interview Scheduled", ["interview_scheduled", "interviewed", "selected", "onboarding"]),
            ("Interviewed", ["interviewed", "selected", "onboarding"]),
            ("Selected", ["selected", "onboarding"]),
            ("Onboarding", ["onboarding"]),
        ]
        funnel = []
        prev_count = None
        for idx, (label, statuses) in enumerate(stages):
            query = select(func.count(Candidate.id)).where(Candidate.status.in_(statuses))
            if job_id:
                query = query.where(Candidate.job_id == job_id)
            result = await db.execute(query)
            count = result.scalar() or 0
            
            if prev_count and prev_count > 0:
                conversion_rate = round((count / prev_count) * 100, 1)
            else:
                conversion_rate = 100.0 if (idx == 0 and count > 0) else 0.0
                
            funnel.append({"stage": label, "count": count, "conversion_rate": conversion_rate})
            if count > 0:
                prev_count = count
        return funnel

    async def get_hiring_trends(self, db: AsyncSession, months: int = 6) -> list[dict]:
        """Monthly hiring trends: applications, shortlisted, hired."""
        trends = []
        for i in range(months - 1, -1, -1):
            month_start = (datetime.utcnow().replace(day=1) - timedelta(days=i * 30))
            month_end = month_start.replace(day=28) + timedelta(days=4)
            month_end = month_end.replace(day=1)

            apps = await db.execute(
                select(func.count(Candidate.id)).where(
                    and_(Candidate.created_at >= month_start, Candidate.created_at < month_end)
                )
            )
            short = await db.execute(
                select(func.count(Candidate.id)).where(
                    and_(
                        Candidate.status.in_(["shortlisted", "interview_scheduled", "interviewed", "selected", "onboarding"]),
                        Candidate.created_at >= month_start, Candidate.created_at < month_end,
                    )
                )
            )
            hired = await db.execute(
                select(func.count(Candidate.id)).where(
                    and_(
                        Candidate.status.in_(["selected", "onboarding"]),
                        Candidate.created_at >= month_start, Candidate.created_at < month_end,
                    )
                )
            )
            trends.append({
                "month": month_start.strftime("%b %Y"),
                "applications": apps.scalar() or 0,
                "shortlisted": short.scalar() or 0,
                "hired": hired.scalar() or 0,
            })
        return trends


# Singleton
long_term = LongTermMemory()
