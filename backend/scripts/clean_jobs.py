import asyncio
import sys
import os

# Add parent directory to path to allow importing backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database.session import AsyncSessionLocal
from backend.database.models import (
    Job, JobDescription, WorkflowState, Candidate, Analytics,
    AgentLog, Resume, CandidateScore, Interview, OnboardingTask
)
from sqlalchemy import select

async def clean_all_jobs():
    async with AsyncSessionLocal() as db:
        print("Fetching all jobs...")
        result = await db.execute(select(Job))
        jobs = result.scalars().all()
        print(f"Found {len(jobs)} jobs to delete.")
        
        for job in jobs:
            print(f"Deleting Job: {job.title} ({job.id})...")
            # 1. Workflow states and agent logs
            wf_result = await db.execute(select(WorkflowState.id).where(WorkflowState.job_id == job.id))
            wf_ids = [r[0] for r in wf_result.all()]
            if wf_ids:
                print(f"  Deleting AgentLogs for workflows: {wf_ids}")
                await db.execute(AgentLog.__table__.delete().where(AgentLog.workflow_id.in_(wf_ids)))
            
            # 2. Candidates and related scores, resumes, interviews, onboarding tasks
            cand_result = await db.execute(select(Candidate.id).where(Candidate.job_id == job.id))
            cand_ids = [r[0] for r in cand_result.all()]
            if cand_ids:
                print(f"  Deleting Candidate records for candidates: {cand_ids}")
                await db.execute(Resume.__table__.delete().where(Resume.candidate_id.in_(cand_ids)))
                await db.execute(CandidateScore.__table__.delete().where(CandidateScore.candidate_id.in_(cand_ids)))
                await db.execute(Interview.__table__.delete().where(Interview.candidate_id.in_(cand_ids)))
                await db.execute(OnboardingTask.__table__.delete().where(OnboardingTask.candidate_id.in_(cand_ids)))

            # Delete any candidate scores or interviews directly referencing job_id
            await db.execute(CandidateScore.__table__.delete().where(CandidateScore.job_id == job.id))
            await db.execute(Interview.__table__.delete().where(Interview.job_id == job.id))
            
            # 3. Direct child tables
            await db.execute(JobDescription.__table__.delete().where(JobDescription.job_id == job.id))
            await db.execute(WorkflowState.__table__.delete().where(WorkflowState.job_id == job.id))
            await db.execute(Candidate.__table__.delete().where(Candidate.job_id == job.id))
            await db.execute(Analytics.__table__.delete().where(Analytics.job_id == job.id))
            
            await db.delete(job)
            
        await db.commit()
        print("All jobs deleted successfully!")

if __name__ == "__main__":
    asyncio.run(clean_all_jobs())
