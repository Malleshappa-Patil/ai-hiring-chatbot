"""
LangGraph state definitions for the Hiring Workflow.
"""
from typing import TypedDict, Annotated, Sequence, Optional
from operator import add
from langchain_core.messages import BaseMessage


def merge_dicts(a: dict, b: dict) -> dict:
    """Merge two dictionaries, updating the first with the second."""
    res = a.copy() if a else {}
    if b:
        res.update(b)
    return res


class HiringState(TypedDict):
    """
    State dictionary passed between LangGraph agents.
    """
    messages: Annotated[Sequence[BaseMessage], add]
    job_id: str
    goal: str
    next_action: str
    agent_statuses: Annotated[dict, merge_dicts]
    plan: list[str]
    current_step_index: int
    data: Annotated[dict, merge_dicts]  # Flexible data store for intermediate results
    error: Optional[str]
