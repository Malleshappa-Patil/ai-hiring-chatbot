"""
Sourcing Agent — Step 4 from agentic-workflow.md.
Posts the approved JD to all configured job platforms (mocked).
Platforms: LinkedIn, Naukri, Wellfound, Indeed, Company Career Portal.
"""
import random
from datetime import datetime
from backend.workflows.state import HiringState

# Mock platform posting simulation
PLATFORMS = [
    "LinkedIn",
    "Naukri",
    "Wellfound",
    "Indeed",
    "Company Career Portal"
]


def _mock_post_to_platform(platform: str, jd_content: str, job_title: str) -> dict:
    """
    Simulate posting JD to a job platform.
    Returns a mock result with posting ID and URL.
    """
    mock_id = f"{platform[:3].upper()}-{random.randint(10000, 99999)}"
    return {
        "platform": platform,
        "status": "published",
        "posting_id": mock_id,
        "url": f"https://{platform.lower().replace(' ', '')}.com/jobs/{mock_id}",
        "posted_at": datetime.utcnow().isoformat(),
        "job_title": job_title,
    }


def sourcing_node(state: HiringState) -> dict:
    """
    Sourcing Agent — Step 4 from agentic-workflow.md.
    Posts the approved JD to all job platforms.
    """
    jd_content = state.get("jd_content", "")
    hiring_req = state.get("hiring_request", {})
    job_title = hiring_req.get("job_title", "Open Position")

    print(f"[Sourcing Agent] Posting JD for '{job_title}' to {len(PLATFORMS)} platforms...")

    posting_results = {}
    for platform in PLATFORMS:
        result = _mock_post_to_platform(platform, jd_content, job_title)
        posting_results[platform] = result
        print(f"  ✅ Posted to {platform}: {result['url']}")

    return {
        "posting_status": posting_results,
        "agent_statuses": {"sourcing": "completed"},
        # After posting, we wait (simulated) then monitor applications
        "next_action": "monitoring",
    }
