"""
Database seed script.
Creates an admin user, sample jobs, candidates, and demo data.
Run: python -m backend.scripts.seed
"""
import asyncio
import sys
import os
import uuid
from datetime import datetime, timedelta

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database.session import AsyncSessionLocal, init_db
from backend.database.models import (
    User, Job, JobDescription, Candidate, CandidateScore,
    Interview, WorkflowState, AgentLog, OnboardingTask, Analytics
)
from backend.auth.password import hash_password


async def seed():
    print("🌱 Seeding database...")
    await init_db()

    async with AsyncSessionLocal() as db:
        # ── Users ──────────────────────────────────────────────────
        users_data = [
            {
                "email": "admin@hiring.com",
                "password": "admin123",
                "full_name": "Platform Admin",
                "role": "admin",
            },
            {
                "email": "recruiter@hiring.com",
                "password": "recruiter123",
                "full_name": "Sarah Recruiter",
                "role": "recruiter",
            },
            {
                "email": "manager@hiring.com",
                "password": "manager123",
                "full_name": "John Manager",
                "role": "hiring_manager",
            },
        ]

        created_users = {}
        for u in users_data:
            from sqlalchemy import select
            existing = await db.execute(select(User).where(User.email == u["email"]))
            if existing.scalar_one_or_none():
                print(f"  ⏭  User {u['email']} already exists")
                result = await db.execute(select(User).where(User.email == u["email"]))
                created_users[u["role"]] = result.scalar_one()
                continue
            user = User(
                email=u["email"],
                hashed_password=hash_password(u["password"]),
                full_name=u["full_name"],
                role=u["role"],
                is_active=True,
            )
            db.add(user)
            created_users[u["role"]] = user
            print(f"  ✅ Created user: {u['email']} ({u['role']})")

        await db.flush()

        # ── Jobs ───────────────────────────────────────────────────
        admin = created_users.get("admin")
        if not admin:
            from sqlalchemy import select
            r = await db.execute(select(User).where(User.email == "admin@hiring.com"))
            admin = r.scalar_one()

        jobs_data = [
            {
                "title": "Senior Backend Engineer",
                "department": "Engineering",
                "location": "Remote",
                "job_type": "full_time",
                "experience_level": "5+ years",
                "hiring_goal": "Hire a Senior Backend Engineer for our core platform team",
                "status": "screening",
            },
            {
                "title": "Product Manager",
                "department": "Product",
                "location": "Bangalore, India",
                "job_type": "full_time",
                "experience_level": "4+ years",
                "hiring_goal": "Hire a Product Manager to lead our mobile app product line",
                "status": "published",
            },
            {
                "title": "ML Engineer",
                "department": "AI/ML",
                "location": "Remote",
                "job_type": "full_time",
                "experience_level": "3+ years",
                "hiring_goal": "Hire an ML Engineer to build recommendation systems",
                "status": "pending_approval",
            },
        ]

        created_jobs = []
        for j_data in jobs_data:
            from sqlalchemy import select
            existing = await db.execute(select(Job).where(Job.title == j_data["title"]))
            if existing.scalar_one_or_none():
                print(f"  ⏭  Job '{j_data['title']}' already exists")
                r = await db.execute(select(Job).where(Job.title == j_data["title"]))
                created_jobs.append(r.scalar_one())
                continue
            job = Job(created_by=admin.id, **j_data)
            db.add(job)
            created_jobs.append(job)
            print(f"  ✅ Created job: {j_data['title']}")

        await db.flush()

        # ── Job Descriptions ───────────────────────────────────────
        if created_jobs:
            first_job = created_jobs[0]
            from sqlalchemy import select
            existing_jd = await db.execute(
                select(JobDescription).where(JobDescription.job_id == first_job.id)
            )
            if not existing_jd.scalar_one_or_none():
                jd = JobDescription(
                    job_id=first_job.id,
                    content="""# Senior Backend Engineer

**Department:** Engineering | **Location:** Remote | **Type:** Full-Time

## About the Role

We are looking for an experienced Senior Backend Engineer to join our core platform team.
You will design and build scalable, high-performance systems that power our products.

## Key Responsibilities
- Architect and develop RESTful APIs and microservices
- Design robust database schemas and optimize query performance
- Lead technical discussions and mentor junior engineers
- Implement CI/CD pipelines and DevOps best practices
- Collaborate with product and frontend teams

## Requirements
- 5+ years of backend development experience
- Proficiency in Python, Go, or Node.js
- Strong knowledge of PostgreSQL, Redis, and message queues
- Experience with Docker, Kubernetes, and cloud platforms (AWS/GCP)
- Excellent understanding of system design and distributed systems

## Nice to Have
- Experience with LangChain, LangGraph, or AI/ML pipelines
- Open source contributions
- Prior startup experience

## What We Offer
- Competitive salary + equity
- Fully remote with flexible hours
- Annual learning budget of $2000
- Top-tier health insurance
""",
                    version=1,
                    status="approved",
                    approved_by=admin.id,
                    approved_at=datetime.utcnow(),
                )
                db.add(jd)
                print(f"  ✅ Created approved JD for: {first_job.title}")

        # ── Candidates ─────────────────────────────────────────────
        if created_jobs:
            first_job = created_jobs[0]
            candidates_data = [
                {
                    "name": "Arjun Sharma",
                    "email": "arjun@example.com",
                    "phone": "+91-9876543210",
                    "status": "shortlisted",
                    "score": 87.5,
                    "category": "strong_match",
                    "explanation": "Excellent match with 6 years of Python/FastAPI experience. Strong system design background. Has worked on high-scale distributed systems. Missing Kubernetes expertise but has Docker proficiency.",
                    "skills_matched": ["Python", "FastAPI", "PostgreSQL", "Redis", "Docker", "System Design"],
                    "skills_missing": ["Kubernetes"],
                },
                {
                    "name": "Priya Patel",
                    "email": "priya@example.com",
                    "phone": "+91-8765432109",
                    "status": "interview_scheduled",
                    "score": 79.0,
                    "category": "strong_match",
                    "explanation": "Strong backend developer with 5 years experience. Good database optimization skills. Has experience with microservices but limited cloud exposure.",
                    "skills_matched": ["Python", "Django", "PostgreSQL", "Microservices"],
                    "skills_missing": ["Redis", "AWS/GCP", "Kubernetes"],
                },
                {
                    "name": "Rahul Verma",
                    "email": "rahul@example.com",
                    "phone": "+91-7654321098",
                    "status": "screening",
                    "score": 64.0,
                    "category": "partial_match",
                    "explanation": "Solid developer with 4 years experience but primarily in frontend. Backend skills are present but not at the senior level required.",
                    "skills_matched": ["Python", "REST APIs"],
                    "skills_missing": ["PostgreSQL", "Redis", "Docker", "System Design"],
                },
                {
                    "name": "Sneha Gupta",
                    "email": "sneha@example.com",
                    "phone": "+91-6543210987",
                    "status": "applied",
                    "score": 42.0,
                    "category": "weak_match",
                    "explanation": "Junior developer with 1.5 years experience. Lacks the 5+ years requirement significantly. Could be a fit for a junior role.",
                    "skills_matched": ["Python"],
                    "skills_missing": ["FastAPI", "PostgreSQL", "Redis", "Docker", "System Design", "Microservices"],
                },
            ]

            for c_data in candidates_data:
                from sqlalchemy import select
                existing = await db.execute(
                    select(Candidate).where(Candidate.email == c_data["email"])
                )
                if existing.scalar_one_or_none():
                    print(f"  ⏭  Candidate {c_data['email']} already exists")
                    continue

                candidate = Candidate(
                    name=c_data["name"],
                    email=c_data["email"],
                    phone=c_data["phone"],
                    job_id=first_job.id,
                    status=c_data["status"],
                )
                db.add(candidate)
                await db.flush()

                score = CandidateScore(
                    candidate_id=candidate.id,
                    job_id=first_job.id,
                    score=c_data["score"],
                    category=c_data["category"],
                    explanation=c_data["explanation"],
                    skills_matched=c_data["skills_matched"],
                    skills_missing=c_data["skills_missing"],
                )
                db.add(score)
                print(f"  ✅ Created candidate: {c_data['name']} (score: {c_data['score']})")

        await db.flush()

        # ── Workflow State ─────────────────────────────────────────
        if created_jobs:
            first_job = created_jobs[0]
            from sqlalchemy import select
            existing_wf = await db.execute(
                select(WorkflowState).where(WorkflowState.job_id == first_job.id)
            )
            if not existing_wf.scalar_one_or_none():
                wf = WorkflowState(
                    job_id=first_job.id,
                    current_stage="screening",
                    agent_statuses={
                        "supervisor": "completed",
                        "planning": "completed",
                        "jd_generation": "completed",
                        "human_approval": "completed",
                        "sourcing": "completed",
                        "monitoring": "completed",
                        "screening": "running",
                        "interview": "idle",
                        "onboarding": "idle",
                    },
                    state_data={"goal": "Hire a Senior Backend Engineer", "applicant_count": 4},
                )
                db.add(wf)
                await db.flush()

                # Agent logs
                log_entries = [
                    ("Supervisor Agent", "workflow_initiated", "Goal: Hire a Senior Backend Engineer",
                     "Workflow started, delegating to Planning Agent", 142, 0),
                    ("Planning Agent", "create_execution_plan", "Goal: Hire Senior Backend Engineer",
                     "Plan: JD → Approval → Sourcing → Screening → Interview → Onboarding", 1240, 512),
                    ("JD Agent", "generate_job_description", "Role: Senior Backend Engineer, Dept: Engineering",
                     "JD generated (v1). Pending recruiter approval.", 3890, 1024),
                    ("JD Agent", "jd_approved", "JD v1 approved by John Manager",
                     "JD approved. Proceeding to sourcing phase.", 45, 0),
                    ("Sourcing Agent", "publish_job", "Publishing to LinkedIn, Naukri, Indeed",
                     "Job published to 3 platforms. Tracking applicant flow.", 2100, 256),
                    ("Monitoring Agent", "check_applicant_count", "Current applicants: 4",
                     "Applicant count sufficient. Proceeding to screening.", 890, 128),
                    ("Resume Screening Agent", "screen_resumes", "4 resumes submitted",
                     "Screened 4 resumes: 2 strong match, 1 partial, 1 weak. Ranking generated.", 8920, 2048),
                ]
                for agent, action, inp, out, latency, tokens in log_entries:
                    log = AgentLog(
                        workflow_id=wf.id,
                        agent_name=agent,
                        action=action,
                        input_summary=inp,
                        output_summary=out,
                        latency_ms=latency,
                        token_usage=tokens,
                        status="success",
                    )
                    db.add(log)
                print(f"  ✅ Created workflow state + {len(log_entries)} agent logs")

        # ── Analytics seed data ────────────────────────────────────
        from sqlalchemy import select as sa_select
        existing_analytics = await db.execute(sa_select(Analytics).limit(1))
        if not existing_analytics.scalar_one_or_none():
            analytics_entries = [
                ("applications_count", 4.0),
                ("shortlisted_count", 2.0),
                ("interview_scheduled_count", 1.0),
                ("avg_score", 68.1),
                ("time_to_first_application_days", 2.0),
            ]
            for name, val in analytics_entries:
                db.add(Analytics(
                    job_id=created_jobs[0].id if created_jobs else None,
                    metric_name=name,
                    metric_value=val,
                ))
            print(f"  ✅ Created {len(analytics_entries)} analytics entries")

        await db.commit()

    print("\n✅ Seeding complete!")
    print("\n🔑 Demo Credentials:")
    print("   Admin:          admin@hiring.com      / admin123")
    print("   Recruiter:      recruiter@hiring.com   / recruiter123")
    print("   Hiring Manager: manager@hiring.com     / manager123")
    print("\n🚀 Start the server: uvicorn backend.main:app --reload")
    print("📖 API docs:         http://localhost:8000/docs")


if __name__ == "__main__":
    asyncio.run(seed())
