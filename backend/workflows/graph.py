"""
LangGraph workflow graph for the AI Hiring Chatbot.
Implements the full agentic-workflow.md pipeline with 18 steps.

Flow:
START → supervisor → [jd_generation → sourcing → monitoring ⇄ jd_optimization →
        screening → interview_scheduling → interview_conduct → communication →
        offer_management → renegotiation → onboarding] → END
"""
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from backend.workflows.state import HiringState

# Import all agents
from backend.agents.supervisor import supervisor_node
from backend.agents.jd_agent import jd_generation_node
from backend.agents.sourcing import sourcing_node
from backend.agents.monitoring import monitoring_node, jd_optimization_node
from backend.agents.screening import screening_node
from backend.agents.interview import interview_scheduling_node, interview_conduct_node
from backend.agents.communication import communication_node
from backend.agents.offer_management import offer_management_node
from backend.agents.renegotiation import renegotiation_node
from backend.agents.onboarding import onboarding_node


def route_from_supervisor(state: HiringState) -> str:
    """Route from supervisor to the next agent based on next_action."""
    action = state.get("next_action", "end")
    valid = {
        "jd_generation", "sourcing", "monitoring", "jd_optimization",
        "screening", "interview_scheduling", "interview_conduct",
        "communication", "offer_management", "renegotiation",
        "onboarding", "end", "human_approval"
    }
    return action if action in valid else "end"


def route_after_jd(state: HiringState) -> str:
    """After JD generation, check if approved or needs human review."""
    next_action = state.get("next_action", "")
    if next_action == "human_approval":
        return "human_approval"
    jd_approved = state.get("jd_approved")
    if jd_approved:
        return "sourcing"
    return "jd_generation"  # loop back for revision


def route_after_interview_conduct(state: HiringState) -> str:
    """After interview, decide between communication and offer management."""
    data = state.get("data", {})
    rejected = data.get("rejected_candidates", [])
    selected = state.get("selected_candidates", [])
    
    if rejected:
        return "communication"
    if selected:
        return "offer_management"
    return "end"


def route_after_offer(state: HiringState) -> str:
    """After offer management, route to renegotiation or onboarding."""
    offer_status = state.get("offer_status", {})
    if any(v == "renegotiating" for v in offer_status.values()):
        return "renegotiation"
    if any(v == "accepted" for v in offer_status.values()):
        return "onboarding"
    return "end"


def route_after_renegotiation(state: HiringState) -> str:
    """After renegotiation, route to onboarding or end."""
    offer_status = state.get("offer_status", {})
    data = state.get("data", {})
    
    if any(v == "renegotiating" for v in offer_status.values()):
        return "renegotiation"
    
    accepted = [cid for cid, s in offer_status.items() if s == "accepted"]
    if accepted or data.get("accepted_candidates"):
        return "onboarding"
    return "end"


def create_hiring_graph():
    """
    Build and compile the complete LangGraph StateGraph.
    Implements the full 18-step workflow from agentic-workflow.md.
    """
    workflow = StateGraph(HiringState)

    # ── Add All Nodes ─────────────────────────────────────────────────────────
    workflow.add_node("supervisor",            supervisor_node)
    workflow.add_node("jd_generation",         jd_generation_node)
    workflow.add_node("sourcing",              sourcing_node)
    workflow.add_node("monitoring",            monitoring_node)
    workflow.add_node("jd_optimization",       jd_optimization_node)
    workflow.add_node("screening",             screening_node)
    workflow.add_node("interview_scheduling",  interview_scheduling_node)
    workflow.add_node("interview_conduct",     interview_conduct_node)
    workflow.add_node("communication",         communication_node)
    workflow.add_node("offer_management",      offer_management_node)
    workflow.add_node("renegotiation",         renegotiation_node)
    workflow.add_node("onboarding",            onboarding_node)

    # ── Entry Point ────────────────────────────────────────────────────────────
    workflow.set_entry_point("supervisor")

    # ── Supervisor Routes to Any Agent ────────────────────────────────────────
    workflow.add_conditional_edges(
        "supervisor",
        route_from_supervisor,
        {
            "jd_generation":        "jd_generation",
            "sourcing":             "sourcing",
            "monitoring":           "monitoring",
            "jd_optimization":      "jd_optimization",
            "screening":            "screening",
            "interview_scheduling": "interview_scheduling",
            "interview_conduct":    "interview_conduct",
            "communication":        "communication",
            "offer_management":     "offer_management",
            "renegotiation":        "renegotiation",
            "onboarding":           "onboarding",
            "human_approval":       "jd_generation",  # Resume after HITL
            "end":                  END,
        }
    )

    # ── JD Generation → Back to Supervisor (for HITL) ─────────────────────────
    workflow.add_edge("jd_generation", "supervisor")

    # ── Linear Stage Edges ────────────────────────────────────────────────────
    workflow.add_edge("sourcing",             "monitoring")
    workflow.add_edge("jd_optimization",      "monitoring")   # Loop: optimize → monitor

    # ── Monitoring Decision ────────────────────────────────────────────────────
    workflow.add_conditional_edges(
        "monitoring",
        lambda state: state.get("next_action", "jd_optimization"),
        {
            "screening":      "screening",
            "jd_optimization": "jd_optimization",
        }
    )

    workflow.add_edge("screening",             "interview_scheduling")
    workflow.add_edge("interview_scheduling",  "interview_conduct")

    # ── Post-Interview Decision ────────────────────────────────────────────────
    workflow.add_conditional_edges(
        "interview_conduct",
        route_after_interview_conduct,
        {
            "communication":    "communication",
            "offer_management": "offer_management",
            "end":              END,
        }
    )

    workflow.add_conditional_edges(
        "communication",
        lambda state: "offer_management" if state.get("selected_candidates") else "end",
        {
            "offer_management": "offer_management",
            "end":              END,
        }
    )

    # ── Offer → Renegotiation → Onboarding ────────────────────────────────────
    workflow.add_conditional_edges(
        "offer_management",
        route_after_offer,
        {
            "renegotiation": "renegotiation",
            "onboarding":    "onboarding",
            "end":           END,
        }
    )

    workflow.add_conditional_edges(
        "renegotiation",
        route_after_renegotiation,
        {
            "renegotiation": "renegotiation",
            "onboarding":    "onboarding",
            "end":           END,
        }
    )

    workflow.add_edge("onboarding", END)

    # ── Compile with HITL Checkpointing ───────────────────────────────────────
    checkpointer = MemorySaver()

    return workflow.compile(
        checkpointer=checkpointer,
        # HITL: Pause BEFORE sourcing (JD must be approved first)
        interrupt_before=["sourcing"],
    )


# Compile the graph singleton
hiring_graph = create_hiring_graph()
