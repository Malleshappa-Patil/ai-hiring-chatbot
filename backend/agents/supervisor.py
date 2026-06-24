"""
Supervisor Agent for the Hiring Workflow.
Routes the workflow to the correct specialized agent based on the current plan and state.
"""
from typing import Literal
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from backend.config import settings
from backend.workflows.state import HiringState

# Initialize the Gemini model for the supervisor
llm = ChatGoogleGenerativeAI(
    model=settings.GEMINI_MODEL,
    temperature=0.1,  # Low temperature for routing reliability
    google_api_key=settings.GOOGLE_API_KEY
)

SUPERVISOR_PROMPT = """You are the Supervisor Agent for an enterprise AI Hiring Platform.
Your job is to manage the workflow for filling the job requisition: {goal}.

Current workflow state:
- Job ID: {job_id}
- Current step index: {step_index}
- Total plan steps: {plan_length}
- Plan: {plan}
- Agent statuses: {statuses}

Your task is to determine the next agent to invoke.
1. If there is no plan, return 'planning'.
2. If the plan is finished (step index >= plan length), return 'end'.
3. Otherwise, look at the current step in the plan and return the corresponding agent name.

Available agent names:
- planning (Creates the execution plan)
- jd_generation (Generates the Job Description)
- sourcing (Publishes job and finds candidates)
- screening (Evaluates resumes)
- interview (Schedules and conducts interviews)
- onboarding (Manages post-hire tasks)
- end (Finishes the workflow)

Respond ONLY with the name of the next agent (e.g., 'jd_generation', 'end'). Do not include any other text.
"""

def supervisor_node(state: HiringState) -> dict:
    """The supervisor node that decides the next step."""
    plan = state.get("plan", [])
    step_index = state.get("current_step_index", 0)
    
    # If there's no plan, we must plan first.
    if not plan:
        return {"next_action": "planning", "agent_statuses": {"supervisor": "running"}}
        
    # If we've executed all steps in the plan, we're done.
    if step_index >= len(plan):
        return {"next_action": "end", "agent_statuses": {"supervisor": "completed"}}
        
    # Ask Gemini to decide the next agent based on the plan
    prompt = SUPERVISOR_PROMPT.format(
        goal=state.get("goal", "Hire a candidate"),
        job_id=state.get("job_id", "unknown"),
        step_index=step_index,
        plan_length=len(plan),
        plan=plan,
        statuses=state.get("agent_statuses", {})
    )
    
    response = llm.invoke([SystemMessage(content=prompt), HumanMessage(content="What is the next agent?")])
    next_action = response.content.strip().lower()
    
    # Ensure next_action is valid
    valid_actions = ["planning", "jd_generation", "sourcing", "screening", "interview", "onboarding", "end"]
    if next_action not in valid_actions:
        next_action = "end"
        
    return {"next_action": next_action, "agent_statuses": {"supervisor": "running"}}
