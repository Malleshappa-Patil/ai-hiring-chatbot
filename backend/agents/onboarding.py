"""
Onboarding Agent for the Hiring Workflow.
Triggers IT/HR tasks when a candidate is hired.
"""
from backend.workflows.state import HiringState

def onboarding_node(state: HiringState) -> dict:
    """The Onboarding node that triggers post-hire tasks."""
    return {
        "current_step_index": state.get("current_step_index", 0) + 1,
        "agent_statuses": {"onboarding": "completed"}
    }
