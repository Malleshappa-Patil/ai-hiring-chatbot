"""
LangGraph state machine for the Hiring Workflow.
Defines the nodes, edges, and human-in-the-loop interrupts.
"""
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from backend.workflows.state import HiringState

# Import agents
from backend.agents.supervisor import supervisor_node
from backend.agents.planning import planning_node
from backend.agents.jd_agent import jd_generation_node
from backend.agents.sourcing import sourcing_node
from backend.agents.screening import screening_node
from backend.agents.interview import interview_node
from backend.agents.onboarding import onboarding_node

def create_hiring_graph():
    """Build and compile the LangGraph StateGraph."""
    workflow = StateGraph(HiringState)

    # Add Nodes
    workflow.add_node("supervisor", supervisor_node)
    workflow.add_node("planning", planning_node)
    workflow.add_node("jd_generation", jd_generation_node)
    workflow.add_node("sourcing", sourcing_node)
    workflow.add_node("screening", screening_node)
    workflow.add_node("interview", interview_node)
    workflow.add_node("onboarding", onboarding_node)

    # Set Entry Point
    workflow.set_entry_point("supervisor")

    # Edges from Supervisor
    workflow.add_conditional_edges(
        "supervisor",
        lambda state: state.get("next_action", "end"),
        {
            "planning": "planning",
            "jd_generation": "jd_generation",
            "sourcing": "sourcing",
            "screening": "screening",
            "interview": "interview",
            "onboarding": "onboarding",
            "human_approval": "jd_generation", # Loop back to JD agent after human approval
            "end": END
        }
    )

    # Sub-agents always return to the supervisor
    workflow.add_edge("planning", "supervisor")
    workflow.add_edge("jd_generation", "supervisor")
    workflow.add_edge("sourcing", "supervisor")
    workflow.add_edge("screening", "supervisor")
    workflow.add_edge("interview", "supervisor")
    workflow.add_edge("onboarding", "supervisor")

    # In a production app, we'd use PostgreSQL checkpointing (from Phase 2)
    # For this graph, we use an in-memory checkpointer as a stub.
    # The actual workflow service persists state manually.
    checkpointer = MemorySaver()

    return workflow.compile(
        checkpointer=checkpointer,
        interrupt_before=["sourcing", "interview"]  # HITL: Pause before sourcing (JD approval) and interviewing
    )

# Compile the graph
hiring_graph = create_hiring_graph()
