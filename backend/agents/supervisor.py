"""
Supervisor Agent for the Hiring Workflow.
Routes the workflow to the correct specialized agent based on the current state.
Implements the full decision tree from agentic-workflow.md.
"""
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from backend.config import settings
from backend.workflows.state import HiringState

llm = ChatGoogleGenerativeAI(
    model=settings.GEMINI_MODEL,
    temperature=0.1,
    google_api_key=settings.GOOGLE_API_KEY
)

SUPERVISOR_PROMPT = """You are the Supervisor Agent for an enterprise AI Hiring Platform.
Your job is to determine the EXACT next step in the hiring workflow.

Current State:
- Goal: {goal}
- Job ID: {job_id}
- JD Generated: {jd_generated}
- JD Approved: {jd_approved}
- JD Retry Count: {jd_retry_count}
- Posting Status: {posting_status}
- Application Count: {application_count}
- Candidates Needed: {candidates_needed}
- Shortlisted Count: {shortlisted_count}
- Scheduled Interviews: {scheduled_count}
- Selected Candidates: {selected_count}
- Offer Status: {offer_status}
- Sourcing Retry Count: {sourcing_retry_count}
- Agent Statuses: {statuses}

Workflow rules (follow exactly):
1. If no JD has been generated → return 'jd_generation'
2. If JD was generated but NOT approved → return 'jd_generation' (loop)
3. If JD is approved but not posted → return 'sourcing'
4. If JD is posted and we're waiting → return 'monitoring'
5. If application_count >= candidates_needed threshold (10 or more) → return 'screening'
6. If application_count < threshold and sourcing_retry_count < 3 → return 'jd_optimization'
7. If candidates are shortlisted but interviews not scheduled → return 'interview_scheduling'
8. If interviews are scheduled but results pending → return 'interview_conduct'
9. If interviews done and no selected candidates → return 'communication' (rejection)
10. If selected candidates exist and no offers sent → return 'offer_management'
11. If offers sent and some rejected (renegotiating) → return 'renegotiation'
12. If all offers accepted or process complete → return 'onboarding'
13. If onboarding done → return 'end'

Available agent names: jd_generation, sourcing, monitoring, jd_optimization, screening, 
interview_scheduling, interview_conduct, communication, offer_management, renegotiation, onboarding, end

Respond ONLY with the agent name. No other text.
"""


def supervisor_node(state: HiringState) -> dict:
    """The supervisor node that routes to the correct next agent."""
    
    jd_content = state.get("jd_content")
    jd_approved = state.get("jd_approved")
    posting_status = state.get("posting_status", {})
    application_count = state.get("application_count", 0)
    candidates_needed = state.get("candidates_needed", 10)
    shortlisted = state.get("shortlisted_candidates", [])
    scheduled = state.get("scheduled_interviews", [])
    selected = state.get("selected_candidates", [])
    offer_status = state.get("offer_status", {})
    onboarding_tasks = state.get("onboarding_tasks", [])
    sourcing_retry_count = state.get("sourcing_retry_count", 0)

    prompt = SUPERVISOR_PROMPT.format(
        goal=state.get("goal", "Hire a candidate"),
        job_id=state.get("job_id", "unknown"),
        jd_generated=bool(jd_content),
        jd_approved=jd_approved,
        jd_retry_count=state.get("jd_retry_count", 0),
        posting_status=posting_status,
        application_count=application_count,
        candidates_needed=candidates_needed,
        shortlisted_count=len(shortlisted),
        scheduled_count=len(scheduled),
        selected_count=len(selected),
        offer_status=offer_status,
        sourcing_retry_count=sourcing_retry_count,
        statuses=state.get("agent_statuses", {}),
    )

    try:
        response = llm.invoke([
            SystemMessage(content=prompt),
            HumanMessage(content="What is the next agent to invoke?")
        ])
        next_action = response.content.strip().lower()
    except Exception as e:
        next_action = "end"
        print(f"[Supervisor] LLM error: {e}")

    valid_actions = [
        "jd_generation", "sourcing", "monitoring", "jd_optimization",
        "screening", "interview_scheduling", "interview_conduct",
        "communication", "offer_management", "renegotiation",
        "onboarding", "end"
    ]
    if next_action not in valid_actions:
        next_action = "end"

    print(f"[Supervisor] → Next action: {next_action}")
    return {
        "next_action": next_action,
        "agent_statuses": {"supervisor": "routing"}
    }
