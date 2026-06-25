"""
Job Description Generation Agent.
Step 2 & 3 from agentic-workflow.md:
- Generates JD from the hiring request details
- Supports loop-back on rejection
- Respects HR feedback to improve JD
"""
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage
from backend.config import settings
from backend.workflows.state import HiringState

llm = ChatGoogleGenerativeAI(
    model=settings.GEMINI_MODEL,
    temperature=0.4,
    google_api_key=settings.GOOGLE_API_KEY
)

JD_INITIAL_PROMPT = """You are an expert technical recruiter and copywriter.
Generate a professional, compelling Job Description for the following hiring requirement.

Hiring Details:
- Job Title: {job_title}
- Department: {department}
- Required Skills & Technologies: {skills}
- Experience Required: {experience}
- Budget/Salary Range: {budget}
- Location: {location}
- Hiring Manager: {hiring_manager}
- Number of Positions: {candidates_needed}
- Additional Requirements: {additional_requirements}

Create a complete Job Description that includes:
1. **Job Title & Overview** — Role summary and company context
2. **Key Responsibilities** — Detailed bullet-point list (min 6 points)
3. **Required Skills & Technologies** — Exactly match the specified skills + related technologies
4. **Good to Have Skills** — Complementary skills that add value
5. **Experience Requirements** — Years + type of experience expected
6. **What We Offer** — Compensation, benefits, culture highlights
7. **How to Apply** — Application process

Make it engaging, detailed, and tailored to attract top {job_title} candidates.
Format in clean Markdown.
"""

JD_REVISION_PROMPT = """You are an expert technical recruiter.
The following Job Description was rejected by HR with feedback. Please revise it.

Original JD:
{original_jd}

HR Feedback:
{feedback}

Improve the JD based on the feedback. Keep all good parts and fix the issues mentioned.
Format in clean Markdown.
"""


def jd_generation_node(state: HiringState) -> dict:
    """
    JD Generation Agent — Step 2 & 3 from agentic-workflow.md.
    Generates or revises the JD based on HR feedback.
    """
    hiring_req = state.get("hiring_request", {})
    existing_jd = state.get("jd_content")
    jd_feedback = state.get("jd_feedback", "")
    jd_retry_count = state.get("jd_retry_count", 0)
    max_retries = settings.MAX_JD_RETRIES

    # Safety: stop infinite loops
    if jd_retry_count >= max_retries:
        print(f"[JD Agent] Max retries ({max_retries}) reached. Forcing approval.")
        return {
            "jd_approved": True,
            "agent_statuses": {"jd_generation": "completed"},
        }

    # Revision path — HR rejected the JD with feedback
    if existing_jd and jd_feedback and not state.get("jd_approved"):
        print(f"[JD Agent] Revising JD (attempt {jd_retry_count + 1})")
        prompt = JD_REVISION_PROMPT.format(
            original_jd=existing_jd,
            feedback=jd_feedback,
        )
    else:
        # Initial generation path
        print(f"[JD Agent] Generating initial JD for: {hiring_req.get('job_title', 'Unknown Role')}")
        prompt = JD_INITIAL_PROMPT.format(
            job_title=hiring_req.get("job_title", "Software Engineer"),
            department=hiring_req.get("department", "Engineering"),
            skills=", ".join(hiring_req.get("skills_required", [])) or "Not specified",
            experience=hiring_req.get("experience_years", "3-5 years"),
            budget=hiring_req.get("budget", "Competitive"),
            location=hiring_req.get("location", "Remote/Flexible"),
            hiring_manager=hiring_req.get("hiring_manager", "HR Team"),
            candidates_needed=hiring_req.get("candidates_needed", 1),
            additional_requirements=hiring_req.get("additional_requirements", "None"),
        )

    try:
        response = llm.invoke([SystemMessage(content=prompt)])
        jd_content = response.content.strip()
    except Exception as e:
        print(f"[JD Agent] LLM error: {e}")
        jd_content = f"# Job Description\n\nError generating JD: {e}\n\nPlease try again."

    return {
        "jd_content": jd_content,
        "jd_approved": None,      # Reset — awaiting HR approval
        "jd_feedback": "",        # Clear old feedback
        "jd_retry_count": jd_retry_count + 1,
        "agent_statuses": {"jd_generation": "awaiting_approval"},
        "next_action": "human_approval",  # Trigger HITL pause
    }
