"""
LangGraph state definitions for the Hiring Workflow.
Extended to support the full agentic workflow from agentic-workflow.md.
"""
from typing import TypedDict, Annotated, Sequence, Optional, List, Dict, Any
from operator import add
from langchain_core.messages import BaseMessage


def merge_dicts(a: dict, b: dict) -> dict:
    """Merge two dictionaries, updating the first with the second."""
    res = a.copy() if a else {}
    if b:
        res.update(b)
    return res


class HiringRequest(TypedDict, total=False):
    """Structured hiring request collected from the chatbot."""
    job_title: str
    department: str
    skills_required: List[str]
    experience_years: str
    budget: str
    location: str
    hiring_manager: str
    candidates_needed: int       # How many candidates the company wants to hire
    additional_requirements: str # Any extra context from HR/recruiter


class HiringState(TypedDict):
    """
    State dictionary passed between LangGraph agents.
    Represents the full lifecycle defined in agentic-workflow.md.
    """
    # Core
    messages: Annotated[Sequence[BaseMessage], add]
    job_id: str
    goal: str                          # High-level hiring goal (e.g., "Hire Senior Backend Engineer")
    next_action: str                   # Next agent to invoke
    agent_statuses: Annotated[dict, merge_dicts]
    plan: list[str]
    current_step_index: int
    data: Annotated[dict, merge_dicts] # Flexible data store for intermediate results
    error: Optional[str]

    # Hiring Request (collected via chatbot)
    hiring_request: Annotated[dict, merge_dicts]  # HiringRequest fields

    # JD Workflow
    jd_content: Optional[str]         # Generated Job Description
    jd_approved: Optional[bool]       # Whether HR approved the JD
    jd_feedback: Optional[str]        # HR feedback if rejected
    jd_retry_count: int                # How many times JD was regenerated

    # Posting & Applications
    posting_status: Annotated[dict, merge_dicts]   # Platform → status mapping
    application_count: int             # Number of candidates who applied
    candidates_needed: int             # Target number to hire (from hiring request)
    sourcing_retry_count: int          # How many times JD was reposted

    # Shortlisting
    shortlisted_candidates: Annotated[list, add]   # List of shortlisted candidate dicts
    candidate_rankings: Annotated[dict, merge_dicts] # Candidate ID → score

    # Interview
    scheduled_interviews: Annotated[list, add]     # List of scheduled interview dicts
    interview_results: Annotated[dict, merge_dicts] # Candidate ID → evaluation result
    selected_candidates: Annotated[list, add]      # Final selected candidates

    # Offer & Negotiation
    offer_letters: Annotated[dict, merge_dicts]    # Candidate ID → offer letter content
    offer_status: Annotated[dict, merge_dicts]     # Candidate ID → accepted/rejected/renegotiating
    negotiation_rounds: Annotated[dict, merge_dicts] # Candidate ID → round count

    # Onboarding
    onboarding_tasks: Annotated[list, add]         # List of onboarding task dicts
    onboarding_status: Annotated[dict, merge_dicts] # Employee ID → status

    # Chatbot session
    chat_session_id: Optional[str]
    chat_history: Annotated[list, add]             # List of {role, content} dicts
