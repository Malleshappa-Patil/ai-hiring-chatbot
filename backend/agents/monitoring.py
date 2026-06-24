"""
Monitoring Agent for the Hiring Workflow.
Tracks the applicant flow and decides if we need to adjust the sourcing strategy.
"""
from backend.workflows.state import HiringState

def monitoring_node(state: HiringState) -> dict:
    """The Monitoring node that tracks applicant flow."""
    return {
        "current_step_index": state.get("current_step_index", 0) + 1,
        "agent_statuses": {"monitoring": "completed"}
    }
