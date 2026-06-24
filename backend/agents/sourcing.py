"""
Sourcing Agent for the Hiring Workflow.
Simulates publishing the job to LinkedIn/Indeed and finding initial candidates.
"""
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage
from backend.config import settings
from backend.workflows.state import HiringState

llm = ChatGoogleGenerativeAI(
    model=settings.GEMINI_MODEL,
    temperature=0.2,
    google_api_key=settings.GOOGLE_API_KEY
)

def sourcing_node(state: HiringState) -> dict:
    """The Sourcing node that publishes the job and simulates sourcing."""
    
    # In a real app, this agent would use tools to post to LinkedIn/Indeed APIs.
    # We simulate this behavior for the prototype.
    
    # Advance the step index so supervisor knows we finished
    return {
        "current_step_index": state.get("current_step_index", 0) + 1,
        "agent_statuses": {"sourcing": "completed"}
    }
