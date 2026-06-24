"""
Job Description Generation Agent.
Generates an optimized Job Description and pauses for human approval.
"""
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from pydantic import BaseModel, Field
from backend.config import settings
from backend.workflows.state import HiringState

llm = ChatGoogleGenerativeAI(
    model=settings.GEMINI_MODEL,
    temperature=0.4,
    google_api_key=settings.GOOGLE_API_KEY
)

JD_PROMPT = """You are an expert technical recruiter and copywriter.
Generate a professional, compelling Job Description for the following goal: {goal}.

Include:
1. Job Title
2. About the Role
3. Key Responsibilities
4. Requirements (Required Skills & Nice to Haves)
5. What We Offer

Make it engaging and formatted in clear Markdown.
"""

def jd_generation_node(state: HiringState) -> dict:
    """The JD Generation node that creates the initial job description."""
    goal = state.get("goal", "")
    job_id = state.get("job_id", "")
    
    # Check if we already generated a JD (this prevents loops if we re-enter)
    if "jd_content" in state.get("data", {}):
        return {
            "current_step_index": state.get("current_step_index", 0) + 1,
            "agent_statuses": {"jd_generation": "completed"}
        }

    prompt = JD_PROMPT.format(goal=goal)
    response = llm.invoke([SystemMessage(content=prompt)])
    
    jd_content = response.content.strip()
    
    # Store JD in state data
    data_update = {"jd_content": jd_content}
    
    # In a real app, we'd save this to DB here. For now, we simulate.
    return {
        "data": data_update,
        "current_step_index": state.get("current_step_index", 0) + 1,
        "agent_statuses": {"jd_generation": "completed"},
        # Setting next_action to human_approval will cause an interrupt
        "next_action": "human_approval"
    }
