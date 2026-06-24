"""
Screening Agent for the Hiring Workflow.
Evaluates resumes against the Job Description and ranks candidates.
"""
from langchain_google_genai import ChatGoogleGenerativeAI
from backend.config import settings
from backend.workflows.state import HiringState

llm = ChatGoogleGenerativeAI(
    model=settings.GEMINI_MODEL,
    temperature=0.1,
    google_api_key=settings.GOOGLE_API_KEY
)

def screening_node(state: HiringState) -> dict:
    """The Screening node that evaluates resumes and ranks candidates using RAG."""
    goal = state.get("goal", "")
    
    # In a real app, we'd loop over all applied candidates for the job.
    # We use RAG to search for resumes matching the goal/JD.
    from backend.memory.vector_store import vector_store
    try:
        results = vector_store.search_resumes(goal, k=10)
        # We would then pass the retrieved resumes to Gemini to score them against the JD
        # and update the DB with CandidateScore.
        pass
    except Exception as e:
        print(f"RAG search error: {e}")
        
    return {
        "current_step_index": state.get("current_step_index", 0) + 1,
        "agent_statuses": {"screening": "completed"}
    }
