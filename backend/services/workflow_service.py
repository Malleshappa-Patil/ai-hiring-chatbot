"""
Workflow orchestration service.
Manages LangGraph workflow execution and state tracking.
Phase 2: Stub implementation that tracks state in DB.
Phase 3: Full LangGraph agent graph integration.
"""
import asyncio
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from backend.database.models import WorkflowState, AgentLog, Job, JobDescription
from backend.memory.short_term import memory
from backend.config import settings

logger = logging.getLogger(__name__)

WORKFLOW_STAGES = [
    "supervisor",
    "planning",
    "jd_generation",
    "human_approval",
    "sourcing",
    "monitoring",
    "screening",
    "human_review",
    "interviewing",
    "onboarding",
    "completed",
]


class WorkflowService:
    """
    Manages the lifecycle of hiring workflows.
    
    Phase 2: Orchestrates state transitions manually (DB-driven).
    Phase 3: Will be replaced with LangGraph state machine.
    """

    async def start_workflow(
        self, db: AsyncSession, job_id: str, goal: str, user_id: str
    ) -> WorkflowState:
        """Initiate a new hiring workflow for a job."""
        # Check if workflow already exists for this job
        existing = await db.execute(
            select(WorkflowState).where(WorkflowState.job_id == job_id)
        )
        existing_state = existing.scalar_one_or_none()
        if existing_state and existing_state.current_stage not in ("completed", "failed"):
            logger.info(f"Workflow already running for job {job_id}")
            return existing_state

        # Create new workflow state
        workflow = WorkflowState(
            job_id=job_id,
            current_stage="supervisor",
            agent_statuses={
                "supervisor": "running",
                "planning": "idle",
                "jd_generation": "idle",
                "sourcing": "idle",
                "monitoring": "idle",
                "screening": "idle",
                "interview": "idle",
                "onboarding": "idle",
            },
            state_data={"goal": goal, "created_by": user_id},
        )
        db.add(workflow)

        # Update job status
        job_result = await db.execute(select(Job).where(Job.id == job_id))
        job = job_result.scalar_one_or_none()
        if job:
            job.status = "generating_jd"

        await db.commit()
        await db.refresh(workflow)

        # Cache in Redis
        await memory.set_workflow_state(job_id, {
            "workflow_id": workflow.id,
            "current_stage": workflow.current_stage,
            "goal": goal,
        })

        # Log supervisor action
        await self._log_agent_action(
            db, workflow.id,
            agent_name="Supervisor Agent",
            action="workflow_initiated",
            input_summary=f"Goal: {goal}",
            output_summary=f"Workflow started. Delegating to Planning Agent.",
            latency_ms=150,
            token_usage=0,
        )

        # Simulate planning stage progression in a background task with its own DB session
        # We MUST NOT pass the request-scoped `db` session into the background task
        # because that session will be closed when the request finishes.
        asyncio.create_task(
            self._simulate_jd_generation_bg(workflow.id, job_id, goal)
        )

        logger.info(f"Workflow {workflow.id} started for job {job_id}")
        return workflow

    async def get_workflow_status(
        self, db: AsyncSession, job_id: str
    ) -> Optional[WorkflowState]:
        """Get current workflow state from DB (with Redis cache fallback)."""
        result = await db.execute(
            select(WorkflowState)
            .where(WorkflowState.job_id == job_id)
            .order_by(desc(WorkflowState.started_at))
        )
        return result.scalar_one_or_none()

    async def get_workflow_logs(
        self, db: AsyncSession, job_id: str, limit: int = 50
    ) -> list[AgentLog]:
        """Retrieve agent execution logs for a workflow."""
        # Get workflow id first
        workflow = await self.get_workflow_status(db, job_id)
        if not workflow:
            return []
        result = await db.execute(
            select(AgentLog)
            .where(AgentLog.workflow_id == workflow.id)
            .order_by(AgentLog.created_at)
            .limit(limit)
        )
        return result.scalars().all()

    async def advance_stage(
        self, db: AsyncSession, workflow_id: str, new_stage: str,
        agent_statuses: Optional[dict] = None
    ) -> None:
        """Move the workflow to the next stage."""
        result = await db.execute(
            select(WorkflowState).where(WorkflowState.id == workflow_id)
        )
        workflow = result.scalar_one_or_none()
        if not workflow:
            return
        workflow.current_stage = new_stage
        workflow.updated_at = datetime.utcnow()
        if agent_statuses:
            workflow.agent_statuses = {**workflow.agent_statuses, **agent_statuses}
        await db.commit()

        # Update Redis
        await memory.set_workflow_state(workflow.job_id, {
            "workflow_id": workflow.id,
            "current_stage": new_stage,
        })

    async def _log_agent_action(
        self, db: AsyncSession, workflow_id: str,
        agent_name: str, action: str,
        input_summary: str = "", output_summary: str = "",
        latency_ms: int = 0, token_usage: int = 0, status: str = "success"
    ) -> None:
        log = AgentLog(
            workflow_id=workflow_id,
            agent_name=agent_name,
            action=action,
            input_summary=input_summary,
            output_summary=output_summary,
            latency_ms=latency_ms,
            token_usage=token_usage,
            status=status,
        )
        db.add(log)
        await db.commit()

    async def regenerate_jd(
        self, db: AsyncSession, job_id: str, workflow_id: str, reason: str
    ) -> None:
        """Kick off a background JD regeneration task after a rejection."""
        # Mark job as regenerating
        job_result = await db.execute(select(Job).where(Job.id == job_id))
        job = job_result.scalar_one_or_none()
        if job:
            goal = job.hiring_goal or f"Hire a {job.title}"
        else:
            goal = "Hire a professional"

        asyncio.create_task(
            self._regenerate_jd_bg(workflow_id, job_id, goal, reason)
        )
        logger.info(f"JD regeneration queued for job {job_id}, reason: {reason}")

    async def start_sourcing(
        self, db: AsyncSession, job_id: str, workflow_id: str
    ) -> None:
        """Kick off sourcing simulation after JD approval."""
        asyncio.create_task(
            self._simulate_sourcing_bg(workflow_id, job_id)
        )

    async def _simulate_jd_generation_bg(
        self, workflow_id: str, job_id: str, goal: str
    ) -> None:
        """
        Background task that creates its OWN DB session.
        Uses Google Gemini to generate a real, role-specific JD.
        """
        from backend.database.session import AsyncSessionLocal

        async with AsyncSessionLocal() as db:
            try:
                await asyncio.sleep(2)  # Simulate processing time

                # Advance to planning
                await self.advance_stage(db, workflow_id, "planning", {
                    "supervisor": "completed", "planning": "running"
                })
                await self._log_agent_action(
                    db, workflow_id,
                    agent_name="Planning Agent",
                    action="create_execution_plan",
                    input_summary=f"Goal: {goal}",
                    output_summary="Execution plan created: JD → Approval → Sourcing → Screening → Interview → Onboarding",
                    latency_ms=890, token_usage=450,
                )

                await asyncio.sleep(1)
                await self.advance_stage(db, workflow_id, "jd_generation", {
                    "planning": "completed", "jd_generation": "running"
                })

                # Fetch job and generate JD via Gemini
                job_result = await db.execute(select(Job).where(Job.id == job_id))
                job = job_result.scalar_one_or_none()
                if job:
                    jd_content = await self._generate_ai_jd(job, goal)
                    jd = JobDescription(
                        job_id=job_id,
                        content=jd_content,
                        version=1,
                        status="pending_approval",
                    )
                    db.add(jd)
                    job.status = "pending_approval"
                    await db.commit()

                # Move to human approval
                await self.advance_stage(db, workflow_id, "human_approval", {
                    "jd_generation": "completed", "human_approval": "waiting_approval"
                })
                await self._log_agent_action(
                    db, workflow_id,
                    agent_name="JD Agent",
                    action="generate_job_description",
                    input_summary=f"Job: {job.title if job else 'Unknown'}",
                    output_summary="AI-generated job description ready. Awaiting recruiter approval.",
                    latency_ms=3500, token_usage=1200,
                )
                logger.info(f"Background JD generation complete for job {job_id}")
            except Exception as e:
                logger.error(f"Background JD generation failed for job {job_id}: {e}")
                import traceback; traceback.print_exc()

    async def _regenerate_jd_bg(
        self, workflow_id: str, job_id: str, goal: str, rejection_reason: str
    ) -> None:
        """
        Background task to regenerate a JD after rejection.
        Creates a new, incremented version using Gemini with the rejection reason as feedback.
        """
        from backend.database.session import AsyncSessionLocal
        from sqlalchemy import desc as sql_desc

        async with AsyncSessionLocal() as db:
            try:
                await asyncio.sleep(2)

                # Mark jd_generation as running
                await self.advance_stage(db, workflow_id, "jd_generation", {
                    "human_approval": "idle", "jd_generation": "running"
                })

                # Fetch job details
                job_result = await db.execute(select(Job).where(Job.id == job_id))
                job = job_result.scalar_one_or_none()
                if not job:
                    logger.error(f"Job {job_id} not found during JD regeneration")
                    return

                # Get the current (rejected) version number to increment
                latest_jd = await db.execute(
                    select(JobDescription)
                    .where(JobDescription.job_id == job_id)
                    .order_by(sql_desc(JobDescription.version))
                )
                latest = latest_jd.scalar_one_or_none()
                next_version = (latest.version + 1) if latest else 1

                # Generate a new improved JD via Gemini, incorporating the rejection feedback
                jd_content = await self._generate_ai_jd(
                    job, goal, rejection_feedback=rejection_reason
                )

                # Create new JD version
                new_jd = JobDescription(
                    job_id=job_id,
                    content=jd_content,
                    version=next_version,
                    status="pending_approval",
                )
                db.add(new_jd)
                job.status = "pending_approval"
                await db.commit()

                # Advance to human approval again
                await self.advance_stage(db, workflow_id, "human_approval", {
                    "jd_generation": "completed", "human_approval": "waiting_approval"
                })
                await self._log_agent_action(
                    db, workflow_id,
                    agent_name="JD Agent",
                    action="regenerate_job_description",
                    input_summary=f"Rejection feedback: {rejection_reason}",
                    output_summary=f"JD v{next_version} generated incorporating recruiter feedback. Awaiting approval.",
                    latency_ms=3800, token_usage=1400,
                )
                logger.info(f"JD regeneration v{next_version} complete for job {job_id}")
            except Exception as e:
                logger.error(f"JD regeneration failed for job {job_id}: {e}")
                import traceback; traceback.print_exc()

    async def _simulate_sourcing_bg(
        self, workflow_id: str, job_id: str
    ) -> None:
        """
        Background task to simulate the sourcing stage.
        Sourcing = job posted to boards, candidates start applying.
        After a delay it advances to monitoring.
        """
        from backend.database.session import AsyncSessionLocal

        async with AsyncSessionLocal() as db:
            try:
                await asyncio.sleep(5)  # Simulate job posting delay

                # Update job status to published
                job_result = await db.execute(select(Job).where(Job.id == job_id))
                job = job_result.scalar_one_or_none()
                if job:
                    job.status = "published"
                    await db.commit()

                await self._log_agent_action(
                    db, workflow_id,
                    agent_name="Sourcing Agent",
                    action="publish_job",
                    input_summary=f"Job ID: {job_id}",
                    output_summary="Job published to LinkedIn, Indeed, and Naukri. Monitoring applicant flow.",
                    latency_ms=1800, token_usage=300,
                )

                # Advance to monitoring
                await self.advance_stage(db, workflow_id, "monitoring", {
                    "sourcing": "completed", "monitoring": "running"
                })

                await asyncio.sleep(8)  # Simulate monitoring period

                await self._log_agent_action(
                    db, workflow_id,
                    agent_name="Monitoring Agent",
                    action="monitor_applications",
                    input_summary=f"Job ID: {job_id}",
                    output_summary="Received 12 applications. Threshold met. Advancing to screening.",
                    latency_ms=500, token_usage=100,
                )

                # Advance to screening
                await self.advance_stage(db, workflow_id, "screening", {
                    "monitoring": "completed", "screening": "running"
                })

                # Kick off screening background task so we don't get stuck in screening stage
                asyncio.create_task(
                    self._simulate_screening_bg(workflow_id, job_id)
                )

                logger.info(f"Sourcing simulation complete for job {job_id}")
            except Exception as e:
                logger.error(f"Sourcing simulation failed for job {job_id}: {e}")

    async def _simulate_screening_bg(
        self, workflow_id: str, job_id: str
    ) -> None:
        """
        Background task for the resume screening stage.
        Only processes REAL candidates who applied via HireBoard.
        No dummy/simulated candidates are ever created.
        """
        from backend.database.session import AsyncSessionLocal
        from backend.database.models import Candidate, CandidateScore

        async with AsyncSessionLocal() as db:
            try:
                await asyncio.sleep(6)  # Simulate AI screening time

                # Fetch ONLY real candidates who already applied for this job
                existing_result = await db.execute(
                    select(Candidate).where(Candidate.job_id == job_id)
                )
                real_candidates = existing_result.scalars().all()

                if not real_candidates:
                    # No real applicants yet — just log and advance; do NOT create dummies
                    await self._log_agent_action(
                        db, workflow_id,
                        agent_name="Resume Screening Agent",
                        action="screen_resumes",
                        input_summary=f"Job ID: {job_id}",
                        output_summary="No applicants yet for this role. Waiting for candidates to apply via HireBoard.",
                        latency_ms=500, token_usage=0,
                    )
                    await self.advance_stage(db, workflow_id, "human_review", {
                        "screening": "completed", "human_review": "waiting_approval"
                    })
                    logger.info(f"Screening complete — 0 applicants for job {job_id}")
                    return

                # Mark existing candidates as 'screening' if they are still 'applied'
                for candidate in real_candidates:
                    if candidate.status == "applied":
                        candidate.status = "screening"
                await db.commit()

                # Log screening result
                total = len(real_candidates)
                await self._log_agent_action(
                    db, workflow_id,
                    agent_name="Resume Screening Agent",
                    action="screen_resumes",
                    input_summary=f"{total} real applicant(s) submitted via HireBoard",
                    output_summary=(
                        f"Screening {total} applicant(s). "
                        "Recruiter review is now available in the Candidates panel."
                    ),
                    latency_ms=4200, token_usage=800,
                )

                # Advance to human_review so recruiter can approve/reject
                await self.advance_stage(db, workflow_id, "human_review", {
                    "screening": "completed", "human_review": "waiting_approval"
                })

                logger.info(f"Screening complete for job {job_id} — {total} real candidate(s)")
            except Exception as e:
                logger.error(f"Screening simulation failed for job {job_id}: {e}")



    async def _generate_ai_jd(
        self, job: "Job", goal: str, rejection_feedback: str = ""
    ) -> str:
        """Generate a real job description using Google Gemini."""
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            from langchain_core.messages import HumanMessage
            from backend.config import settings

            llm = ChatGoogleGenerativeAI(
                model=settings.GEMINI_MODEL,
                temperature=0.4,
                google_api_key=settings.GOOGLE_API_KEY,
            )

            feedback_section = ""
            if rejection_feedback:
                feedback_section = f"""

IMPORTANT: The previous version was rejected. Feedback from the recruiter:
"{rejection_feedback}"
Please address this feedback in the new version and make the JD significantly better."""

            prompt = f"""You are an expert HR professional and technical recruiter. Generate a professional,
detailed, and compelling Job Description (JD) for the following role.{feedback_section}

Job Details:
- Title: {job.title}
- Department: {job.department}
- Location: {job.location}
- Employment Type: {job.job_type.replace('_', ' ').title()}
- Experience Required: {job.experience_level}
- Hiring Goal: {goal}

Write a complete JD in Markdown format with these sections:
1. ## About the Role (2-3 paragraphs, specific to the role)
2. ## Key Responsibilities (8-10 bullet points, specific to the job title)
3. ## Required Qualifications (6-8 bullets, specific skills for this exact role)
4. ## Nice to Have (4-5 bullets)
5. ## What We Offer (5-6 bullets with salary, benefits, culture)

Make it specific, engaging, and tailored to {job.experience_level} level for a {job.title} role.
Do NOT use generic placeholder text. Write actual, specific content for this exact role."""

            response = await llm.ainvoke([HumanMessage(content=prompt)])
            header = f"""# {job.title}

**Department:** {job.department} | **Location:** {job.location} | **Type:** {job.job_type.replace('_', ' ').title()} | **Experience:** {job.experience_level}

---

"""
            return header + response.content

        except Exception as e:
            logger.warning(f"Gemini JD generation failed, falling back to template: {e}")
            return self._generate_placeholder_jd(job)

    def _generate_placeholder_jd(self, job: "Job") -> str:
        """
        Phase 2 placeholder JD. Phase 3 will use Google Gemini + RAG.
        """
        return f"""# {job.title}

**Department:** {job.department}
**Location:** {job.location}
**Employment Type:** {job.job_type.replace('_', ' ').title()}
**Experience:** {job.experience_level}

---

## About the Role

We are looking for a talented **{job.title}** to join our {job.department} team. 
This is an exciting opportunity to work on cutting-edge projects and make a 
significant impact on our products and services.

## Key Responsibilities

- Design, develop, and maintain high-quality software solutions
- Collaborate with cross-functional teams to define and implement new features
- Write clean, maintainable, and well-documented code
- Participate in code reviews and provide constructive feedback
- Troubleshoot and resolve complex technical issues
- Mentor junior team members and share knowledge

## Required Qualifications

- {job.experience_level} of relevant professional experience
- Strong problem-solving and analytical skills
- Excellent communication and collaboration abilities
- Bachelor's degree in Computer Science, Engineering, or a related field (or equivalent experience)

## What We Offer

- Competitive salary and equity package
- Comprehensive health, dental, and vision benefits
- Flexible work arrangements ({job.location})
- Professional development budget
- Collaborative and inclusive work culture

---

*This job description was auto-generated by the AI Hiring Platform and is pending recruiter approval.*
"""

    async def check_human_review_status(self, db: AsyncSession, job_id: str) -> None:
        """Check if all candidates for a job are reviewed and advance stage if done."""
        from backend.database.models import Candidate
        
        remaining = await db.execute(
            select(func.count(Candidate.id))
            .where(Candidate.job_id == job_id)
            .where(Candidate.status.in_(["applied", "screening"]))
        )
        remaining_count = remaining.scalar() or 0
        
        if remaining_count == 0:
            workflow = await self.get_workflow_status(db, job_id)
            if workflow and workflow.current_stage == "human_review":
                # Get count of shortlisted candidates
                shortlisted = await db.execute(
                    select(func.count(Candidate.id))
                    .where(Candidate.job_id == job_id)
                    .where(Candidate.status == "shortlisted")
                )
                shortlisted_count = shortlisted.scalar() or 0
                
                if shortlisted_count > 0:
                    # Advance workflow to interviewing
                    await self.advance_stage(
                        db, workflow.id, "interviewing",
                        {"human_review": "completed", "interview": "running"}
                    )
                    
                    # Log action
                    await self._log_agent_action(
                        db, workflow.id,
                        agent_name="Supervisor Agent",
                        action="human_review_completed",
                        input_summary=f"Job ID: {job_id}",
                        output_summary=f"All candidates reviewed. {shortlisted_count} candidate(s) shortlisted. Advancing to interviewing stage.",
                        latency_ms=100, token_usage=0
                    )
                    
                    # Start the interview simulation background task
                    await self.start_interview_simulation(db, job_id, workflow.id)
                else:
                    # Move to failed because no candidate was selected for interview
                    await self.advance_stage(
                        db, workflow.id, "failed",
                        {"human_review": "completed", "interview": "no_candidates_selected"}
                    )
                    
                    # Log action
                    await self._log_agent_action(
                        db, workflow.id,
                        agent_name="Supervisor Agent",
                        action="human_review_completed",
                        input_summary=f"Job ID: {job_id}",
                        output_summary="All candidates reviewed but none were shortlisted. Workflow terminated.",
                        latency_ms=100, token_usage=0,
                        status="success"
                    )


    async def start_interview_simulation(
        self, db: AsyncSession, job_id: str, workflow_id: str
    ) -> None:
        """Kick off interview simulation after human review of candidates."""
        asyncio.create_task(
            self._simulate_interview_bg(workflow_id, job_id)
        )

    async def _simulate_interview_bg(
        self, workflow_id: str, job_id: str
    ) -> None:
        """
        Background task to simulate the interviewing stage.
        Conducts interviews with ALL shortlisted candidates and selects the best one for onboarding.
        """
        from backend.database.session import AsyncSessionLocal
        from backend.database.models import Candidate, CandidateScore, Interview
        from sqlalchemy.orm import selectinload
        from datetime import datetime, timedelta

        async with AsyncSessionLocal() as db:
            try:
                await asyncio.sleep(5)  # Simulate scheduling and conducting interviews

                # Get shortlisted candidates (also check interview_scheduled as a fallback)
                result = await db.execute(
                    select(Candidate)
                    .where(Candidate.job_id == job_id)
                    .where(Candidate.status.in_(["shortlisted", "interview_scheduled"]))
                    .options(selectinload(Candidate.score))
                )
                shortlisted = result.scalars().all()

                if not shortlisted:
                    # Last chance: check if interviews were already created but candidates advanced
                    re_result = await db.execute(
                        select(Candidate)
                        .where(Candidate.job_id == job_id)
                        .where(Candidate.status == "interviewed")
                    )
                    already_interviewed = re_result.scalars().all()
                    if not already_interviewed:
                        await self._log_agent_action(
                            db, workflow_id,
                            agent_name="Interview Agent",
                            action="conduct_interviews",
                            input_summary="No shortlisted candidates",
                            output_summary="No candidates were shortlisted for the interview round. Cannot proceed.",
                            latency_ms=100, token_usage=0,
                            status="success"
                        )
                        # Move directly to no_candidates_selected
                        await self.advance_stage(db, workflow_id, "failed", {
                            "interview": "no_candidates_selected"
                        })
                        return
                    else:
                        shortlisted = already_interviewed

                # Schedule and conduct interviews for ALL shortlisted candidates
                interviewers = ["Priya Sharma", "Rahul Mehta", "John Manager", "Sarah Chen"]
                interview_types = ["technical", "hr", "cultural_fit", "final"]
                for i, candidate in enumerate(shortlisted):
                    candidate.status = "interview_scheduled"
                    interview = Interview(
                        candidate_id=candidate.id,
                        job_id=job_id,
                        scheduled_at=datetime.utcnow() - timedelta(hours=2 + i),
                        duration_minutes=45,
                        interviewer=interviewers[i % len(interviewers)],
                        interview_type=interview_types[i % len(interview_types)],
                        status="scheduled",
                        meeting_link=f"https://meet.google.com/abc-def-{i:03d}"
                    )
                    db.add(interview)

                await db.commit()
                await asyncio.sleep(3)  # Simulate conducting the interviews

                # Mark all as interviewed
                for candidate in shortlisted:
                    candidate.status = "interviewed"
                    # Mark their interview as completed
                    iv_result = await db.execute(
                        select(Interview)
                        .where(Interview.candidate_id == candidate.id)
                        .where(Interview.job_id == job_id)
                    )
                    for iv in iv_result.scalars().all():
                        iv.status = "completed"
                await db.commit()

                # Select the best candidate (highest score wins, or first if scores are tied)
                def get_score(c: Candidate) -> float:
                    if hasattr(c, 'score') and c.score:
                        return c.score.score
                    return 0.0

                best_candidate = max(shortlisted, key=get_score)

                # Mark the best one as selected, others remain as interviewed
                best_candidate.status = "selected"
                await db.commit()

                names = [c.name for c in shortlisted]
                await self._log_agent_action(
                    db, workflow_id,
                    agent_name="Interview Agent",
                    action="conduct_interviews",
                    input_summary=f"{len(shortlisted)} candidate(s): {', '.join(names)}",
                    output_summary=f"Conducted interviews with {len(shortlisted)} candidate(s). {best_candidate.name} scored highest and received an offer.",
                    latency_ms=3500, token_usage=800,
                )

                # Advance to onboarding stage
                await self.advance_stage(db, workflow_id, "onboarding", {
                    "interview": "completed", "onboarding": "running"
                })

                # Kick off onboarding background simulation
                asyncio.create_task(
                    self._simulate_onboarding_bg(workflow_id, job_id)
                )

                logger.info(f"Interview simulation complete for job {job_id}")
            except Exception as e:
                logger.error(f"Interview simulation failed for job {job_id}: {e}")
                import traceback; traceback.print_exc()

    async def _simulate_onboarding_bg(
        self, workflow_id: str, job_id: str
    ) -> None:
        """
        Background task to simulate onboarding.
        Creates onboarding tasks, completes them, and finishes the workflow.
        """
        from backend.database.session import AsyncSessionLocal
        from backend.database.models import Candidate, OnboardingTask
        from datetime import datetime, timedelta

        async with AsyncSessionLocal() as db:
            try:
                await asyncio.sleep(5)  # Simulate onboarding setup

                # Get selected candidate
                result = await db.execute(
                    select(Candidate).where(Candidate.job_id == job_id).where(Candidate.status == "selected")
                )
                candidate = result.scalars().first()
                
                if candidate:
                    candidate.status = "onboarding"
                    
                    # Create onboarding tasks
                    tasks = [
                        OnboardingTask(
                            candidate_id=candidate.id,
                            task_name="Signing offer letter",
                            description="Candidate needs to sign and return the official offer letter.",
                            assigned_to=candidate.name,
                            status="completed",
                            due_date=datetime.utcnow() + timedelta(days=2),
                            completed_at=datetime.utcnow()
                        ),
                        OnboardingTask(
                            candidate_id=candidate.id,
                            task_name="IT Setup & Hardware Provisioning",
                            description="Set up email, Slack, and dispatch company laptop.",
                            assigned_to="IT Operations",
                            status="completed",
                            due_date=datetime.utcnow() + timedelta(days=5),
                            completed_at=datetime.utcnow()
                        )
                    ]
                    for t in tasks:
                        db.add(t)
                    
                    await db.commit()

                    await self._log_agent_action(
                        db, workflow_id,
                        agent_name="Onboarding Agent",
                        action="initialize_onboarding",
                        input_summary=f"Candidate: {candidate.name}",
                        output_summary="Onboarding initialized and IT setup completed. Welcome packet dispatched.",
                        latency_ms=2800, token_usage=500,
                    )
                else:
                    await self._log_agent_action(
                        db, workflow_id,
                        agent_name="Onboarding Agent",
                        action="initialize_onboarding",
                        input_summary="No selected candidate",
                        output_summary="No candidate found in onboarding state.",
                        latency_ms=100, token_usage=0,
                        status="failure"
                    )

                # Advance workflow to completed
                await self.advance_stage(db, workflow_id, "completed", {
                    "onboarding": "completed"
                })

                await self._log_agent_action(
                    db, workflow_id,
                    agent_name="Supervisor Agent",
                    action="workflow_completed",
                    input_summary=f"Job ID: {job_id}",
                    output_summary="Hiring campaign completed successfully. Candidate onboarded.",
                    latency_ms=150, token_usage=0,
                )

                logger.info(f"Onboarding simulation complete for job {job_id}")
            except Exception as e:
                logger.error(f"Onboarding simulation failed for job {job_id}: {e}")


# Singleton
workflow_service = WorkflowService()

