"""
One-time cleanup: delete all dummy/simulated candidates from the DB.
"""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, delete
from backend.database.session import AsyncSessionLocal
from backend.database.models import Candidate, CandidateScore, Resume

DUMMY_EMAILS = {
    "amit.patel@example.com", "neha.sen@example.com", "vikram.m@example.com",
    "rohan.sharma@example.com", "pooja.patel@example.com", "kunal.k@example.com",
    "aisha.iyer@example.com", "siddharth.rao@example.com", "anjali.nair@example.com",
    "kabir.mehta@example.com",
    # dev-test candidates added during testing
    "rahul.sharma@example.com", "priya.nair@example.com",
}

async def cleanup():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Candidate))
        all_candidates = result.scalars().all()

        dummy_ids = [c.id for c in all_candidates if c.email in DUMMY_EMAILS]
        real_cands = [c for c in all_candidates if c.email not in DUMMY_EMAILS]

        print(f"\n{'='*55}")
        print(f"Total candidates in DB : {len(all_candidates)}")
        print(f"Dummy to delete        : {len(dummy_ids)}")
        print(f"Real to keep           : {len(real_cands)}")

        if real_cands:
            print("\nKEEPING real candidates:")
            for c in real_cands:
                print(f"  ✅ {c.name} ({c.email}) — {c.status}")

        if dummy_ids:
            print("\nDELETING dummy candidates:")
            for c in all_candidates:
                if c.id in dummy_ids:
                    print(f"  🗑  {c.name} ({c.email})")

            await db.execute(delete(CandidateScore).where(CandidateScore.candidate_id.in_(dummy_ids)))
            await db.execute(delete(Resume).where(Resume.candidate_id.in_(dummy_ids)))
            await db.execute(delete(Candidate).where(Candidate.id.in_(dummy_ids)))
            await db.commit()
            print(f"\n✅ Deleted {len(dummy_ids)} dummy candidates successfully.")
        else:
            print("\n✅ DB is already clean — no dummy candidates found.")
        print('='*55)

asyncio.run(cleanup())
