"""
Planning Agent for the Hiring Workflow.
Responsible for breaking down the hiring goal into a sequence of steps.
"""
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from pydantic import BaseModel, Field
from backend.config import settings
from backend.workflows.state import HiringState

llm = ChatGoogleGenerativeAI(
    model=settings.GEMINI_MODEL,
    temperature=0.2,
    google_api_key=settings.GOOGLE_API_KEY
)

class HiringPlan(BaseModel):
    steps: list[str] = Field(description="List of agent names to execute in order. Valid agents: jd_generation, sourcing, screening, interview, onboarding")

PLANNING_PROMPT = """You are the Planning Agent for an enterprise AI Hiring Platform.
Your job is to create an execution plan for filling the job requisition: {goal}.

You must break this down into a sequential list of steps using ONLY the available agents.
Available agents:
- jd_generation: Generates the Job Description (almost always the first step)
- sourcing: Publishes the job and finds candidates
- screening: Evaluates resumes and ranks candidates
- interview: Schedules and conducts interviews
- onboarding: Manages post-hire tasks (final step)

Respond with a JSON object conforming to the HiringPlan schema.
Typical plan: ["jd_generation", "sourcing", "screening", "interview", "onboarding"]
"""

def planning_node(state: HiringState) -> dict:
    """The planning node that generates the sequence of agents."""
    goal = state.get("goal", "Hire a candidate")
    
    prompt = PLANNING_PROMPT.format(goal=goal)
    
    # Use Structured Output to enforce the schema
    structured_llm = llm.with_structured_output(HiringPlan)
    
    try:
        plan_result = structured_llm.invoke([SystemMessage(content=prompt), HumanMessage(content="Create the plan.")])
        plan = plan_result.steps
    except Exception as e:
        # Fallback to standard plan if structured output fails
        plan = ["jd_generation", "sourcing", "screening", "interview", "onboarding"]
        
    return {
        "plan": plan, 
        "current_step_index": 0,
        "agent_statuses": {"planning": "completed"}
    }
