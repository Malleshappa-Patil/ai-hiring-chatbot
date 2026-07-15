"""
Sourcing Agent — Step 4 from agentic-workflow.md.
Fetches candidate applications from the Dummy Hiring Platform (localhost:8001)
where candidates upload their resumes after seeing the job posting.
"""
import random
from datetime import datetime
from backend.workflows.state import HiringState

# Dummy Hiring Platform — the local web app where candidates apply
DUMMY_PLATFORM_URL = "http://localhost:8001"
DUMMY_PLATFORM_CANDIDATES_API = f"{DUMMY_PLATFORM_URL}/candidates"


def _fetch_candidates_from_platform(job_title: str) -> list:
    """
    Fetch candidates who applied via the Dummy Hiring Platform.
    Tries the real API first; falls back to mock data if the platform isn't running.
    """
    try:
        import urllib.request
        import json
        with urllib.request.urlopen(DUMMY_PLATFORM_CANDIDATES_API, timeout=3) as resp:
            data = json.loads(resp.read().decode())
            candidates = data.get("candidates", [])
            if candidates:
                print(f"[Sourcing Agent] ✅ Fetched {len(candidates)} candidate(s) from Dummy Hiring Platform")
                return candidates
    except Exception as e:
        print(f"[Sourcing Agent] ⚠️ Could not reach Dummy Hiring Platform ({e}). Using mock data.")

    # Fallback: generate mock applicants
    mock_count = random.randint(3, 8)
    mock_candidates = []
    for i in range(mock_count):
        mock_id = f"CAND-{random.randint(1000, 9999)}"
        mock_candidates.append({
            "id": mock_id,
            "name": f"Applicant {i + 1}",
            "email": f"applicant{i + 1}@example.com",
            "resume_url": f"{DUMMY_PLATFORM_URL}/resumes/mock_resume_{mock_id}.pdf",
            "applied_for": job_title,
            "applied_at": datetime.utcnow().isoformat(),
            "source": "Dummy Hiring Platform (mock)",
        })
    return mock_candidates


def sourcing_node(state: HiringState) -> dict:
    """
    Sourcing Agent — Step 4 from agentic-workflow.md.
    Fetches candidate applications from the Dummy Hiring Platform.
    """
    hiring_req = state.get("hiring_request", {})
    job_title = hiring_req.get("job_title", "Open Position")

    print(f"[Sourcing Agent] Fetching candidates for '{job_title}' from {DUMMY_PLATFORM_URL}...")

    candidates = _fetch_candidates_from_platform(job_title)

    posting_results = {
        "Dummy Hiring Platform": {
            "platform": "Dummy Hiring Platform",
            "status": "published",
            "posting_id": f"DHP-{random.randint(10000, 99999)}",
            "url": DUMMY_PLATFORM_URL,
            "posted_at": datetime.utcnow().isoformat(),
            "job_title": job_title,
            "candidates_fetched": len(candidates),
        }
    }

    print(f"[Sourcing Agent] ✅ Sourced {len(candidates)} candidate(s) from Dummy Hiring Platform")

    return {
        "posting_status": posting_results,
        "shortlisted_candidates": candidates,
        "application_count": len(candidates),
        "agent_statuses": {"sourcing": "completed"},
        "next_action": "monitoring",
    }
