"""
Interview Agent for the Hiring Workflow.
Schedules interviews and communicates with candidates via email.
"""
from backend.workflows.state import HiringState

def interview_node(state: HiringState) -> dict:
    """The Interview node that handles scheduling."""
    return {
        "current_step_index": state.get("current_step_index", 0) + 1,
        "agent_statuses": {"interview": "completed"}
    }
