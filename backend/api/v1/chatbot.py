"""
AI Chatbot API Router — The conversational interface for the AI Hiring Chatbot.

The chatbot guides HR/Recruiters through a step-by-step hiring request collection,
then triggers the full agentic workflow (agentic-workflow.md).

Endpoints:
- POST /chatbot/start        — Start a new chatbot session
- POST /chatbot/message      — Send a message and get AI response
- GET  /chatbot/session/{id} — Get session history
- POST /chatbot/approve-jd   — Approve or reject the generated JD
"""
import uuid
import json
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage

from backend.config import settings

router = APIRouter(prefix="/chatbot", tags=["AI Chatbot"])

# In-memory session store (in production, use Redis)
_sessions: dict = {}

# Initialize LLM for chatbot
llm = ChatGoogleGenerativeAI(
    model=settings.GEMINI_MODEL,
    temperature=0.4,
    google_api_key=settings.GOOGLE_API_KEY
)

# ── Pydantic Models ────────────────────────────────────────────────────────────

class StartSessionResponse(BaseModel):
    session_id: str
    welcome_message: str
    step: str


class ChatMessageRequest(BaseModel):
    session_id: str
    message: str


class ChatMessageResponse(BaseModel):
    session_id: str
    bot_message: str
    step: str
    hiring_request: Optional[dict] = None
    workflow_triggered: bool = False
    workflow_session_id: Optional[str] = None


class JDApprovalRequest(BaseModel):
    session_id: str
    approved: bool
    feedback: Optional[str] = None


# ── Chatbot Steps ──────────────────────────────────────────────────────────────

STEPS = [
    "greeting",
    "collect_job_title_and_skills",  # Combined: job title + skills + technologies
    "collect_experience",
    "collect_department",
    "collect_location",
    "collect_budget",
    "collect_candidates_needed",
    "collect_additional_requirements",
    "confirmation",
    "jd_generation",
    "jd_review",
    "workflow_running",
    "complete"
]

SYSTEM_PROMPT = """You are an expert AI Hiring Assistant at a tech company.
Your role is to guide HR professionals and recruiters through setting up a complete hiring request.

Current conversation context:
{context}

Current step: {step}
Collected information so far: {collected_data}

Guidelines:
- Be professional yet friendly and encouraging
- Keep responses concise (2-4 sentences)
- Guide the user naturally to provide the specific information needed for the current step
- If information is unclear, ask for clarification politely
- Validate and acknowledge what the user provides
- For the job_title_and_skills step: ask for job title AND the specific technologies/skills/stack required (e.g., "Python, FastAPI, PostgreSQL, AWS") AND number of candidates needed to hire
- Extract structured information from natural language responses
- When confirming, summarize all collected data clearly

Step instructions:
- greeting: Introduce yourself and ask what position they want to fill
- collect_job_title_and_skills: Ask for job title + required skills/technologies + candidates needed count in one natural question
- collect_experience: Ask for years of experience required
- collect_department: Ask which department this role is in
- collect_location: Ask about location/remote policy
- collect_budget: Ask about salary budget/range
- collect_additional_requirements: Ask for any other specific requirements
- confirmation: Show a complete summary and ask for confirmation
- jd_generation: Tell them JD is being generated
- jd_review: Present the JD for review
- workflow_running: Inform the workflow has started
"""


def _extract_data_from_message(step: str, message: str, session: dict) -> dict:
    """Use LLM to extract structured data from user's natural language input."""
    extract_prompt = f"""Extract the following from this message: "{message}"

Current step: {step}

For step "collect_job_title_and_skills":
Extract: job_title, skills_required (as list), candidates_needed (as integer)
Example output: {{"job_title": "Senior Backend Engineer", "skills_required": ["Python", "FastAPI", "PostgreSQL", "AWS", "Docker"], "candidates_needed": 3}}

For step "collect_experience":
Extract: experience_years (as string like "3-5 years" or "5+ years")
Example output: {{"experience_years": "3-5 years"}}

For step "collect_department":
Extract: department (as string)
Example output: {{"department": "Engineering"}}

For step "collect_location":
Extract: location (as string)
Example output: {{"location": "Remote / Bangalore"}}

For step "collect_budget":
Extract: budget (as string)
Example output: {{"budget": "₹15-25 LPA"}}

For step "collect_candidates_needed":
Extract: candidates_needed (as integer)
Example output: {{"candidates_needed": 2}}

For step "collect_additional_requirements":
Extract: additional_requirements (as string)
Example output: {{"additional_requirements": "Preference for open source contributors"}}

Return ONLY the JSON object. No other text.
"""
    try:
        response = llm.invoke([SystemMessage(content=extract_prompt)])
        content = response.content.strip()
        # Extract JSON
        import re
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
    except Exception as e:
        print(f"[Chatbot] Data extraction error: {e}")
    return {}


def _get_next_step(current_step: str, session: dict) -> str:
    """Get the next step in the conversation flow."""
    step_order = [
        "greeting",
        "collect_job_title_and_skills",
        "collect_experience",
        "collect_department",
        "collect_location",
        "collect_budget",
        "collect_additional_requirements",
        "confirmation",
        "jd_generation",
        "jd_review",
        "workflow_running",
        "complete"
    ]
    try:
        idx = step_order.index(current_step)
        return step_order[idx + 1] if idx + 1 < len(step_order) else "complete"
    except ValueError:
        return "complete"


def _generate_bot_response(session: dict, user_message: str) -> str:
    """Generate a natural chatbot response based on current step and context."""
    step = session.get("step", "greeting")
    collected = session.get("hiring_request", {})

    context = "\n".join([
        f"{m['role'].upper()}: {m['content']}"
        for m in session.get("messages", [])[-6:]  # Last 6 messages for context
    ])

    # Build prompt manually — do NOT use .format() here because json.dumps()
    # produces curly braces {} which Python's str.format() mistakes for placeholders,
    # causing a KeyError. Use string concatenation instead.
    collected_data_str = json.dumps(collected, indent=2)
    prompt = (
        "You are an expert AI Hiring Assistant at a tech company.\n"
        "Your role is to guide HR professionals and recruiters through setting up a complete hiring request.\n\n"
        "Current conversation context:\n"
        + context + "\n\n"
        "Current step: " + step + "\n"
        "Collected information so far:\n" + collected_data_str + "\n\n"
        "Guidelines:\n"
        "- Be professional yet friendly and encouraging\n"
        "- Keep responses concise (2-4 sentences)\n"
        "- Guide the user naturally to provide the specific information needed for the current step\n"
        "- If information is unclear, ask for clarification politely\n"
        "- Validate and acknowledge what the user provides\n"
        "- For the job_title_and_skills step: ask for job title AND the specific technologies/skills/stack required AND number of candidates needed\n"
        "- Extract structured information from natural language responses\n"
        "- When confirming, summarize all collected data clearly\n\n"
        "Step instructions:\n"
        "- collect_job_title_and_skills: Acknowledge the job title and skills provided, then ask for years of experience required\n"
        "- collect_experience: Ask which department this role is in\n"
        "- collect_department: Ask about location/remote policy\n"
        "- collect_location: Ask about salary budget/range\n"
        "- collect_budget: Ask for any other specific requirements or press enter to skip\n"
        "- collect_additional_requirements: Tell them you have everything and will show a summary\n"
        "- confirmation: Show a complete summary and ask for confirmation\n"
        "- jd_generation: Tell them JD is being generated\n"
        "- jd_review: Present the JD for review and ask to approve or request changes\n"
        "- workflow_running: Inform the workflow has started\n"
    )

    try:
        response = llm.invoke([
            SystemMessage(content=prompt),
            HumanMessage(content=user_message)
        ])
        return response.content.strip()
    except Exception as e:
        print(f"[Chatbot] LLM error: {e}")
        return f"I encountered an error: {str(e)}. Please check the backend logs."


# ── API Endpoints ──────────────────────────────────────────────────────────────

@router.post("/start", response_model=StartSessionResponse)
async def start_chatbot_session():
    """Start a new AI Hiring Chatbot session."""
    session_id = str(uuid.uuid4())
    
    welcome_message = (
        "Hi there! Great to connect.\n\n"
        "To kick things off, please tell me what position you're looking to fill today? Also, include the key skills, technologies, and how many candidates you need to hire for this role.\n\n"
        "Role: \n"
        "Number of Positions: \n"
        "Experience: \n"
        "Key Skills: \n"
        "Department: \n"
        "Location:\n"
        "Salary Budget: \n"
        "Additional Requirements: "
    )

    _sessions[session_id] = {
        "session_id": session_id,
        "step": "collect_job_title_and_skills",
        "hiring_request": {},
        "messages": [
            {"role": "assistant", "content": welcome_message, "timestamp": datetime.utcnow().isoformat()}
        ],
        "jd_content": None,
        "workflow_session_id": None,
        "created_at": datetime.utcnow().isoformat(),
    }

    return StartSessionResponse(
        session_id=session_id,
        welcome_message=welcome_message,
        step="collect_job_title_and_skills"
    )


@router.post("/message", response_model=ChatMessageResponse)
async def send_message(request: ChatMessageRequest):
    """
    Send a message to the chatbot and get an AI response.
    The chatbot guides through the hiring request collection step by step.
    """
    session = _sessions.get(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found. Please start a new session.")

    # Add user message to history
    session["messages"].append({
        "role": "user",
        "content": request.message,
        "timestamp": datetime.utcnow().isoformat()
    })

    current_step = session.get("step", "collect_job_title_and_skills")
    workflow_triggered = False
    workflow_session_id = None

    # Check for simple greeting to output template
    msg_clean = request.message.lower().strip().replace(".", "").replace("!", "")
    if current_step == "collect_job_title_and_skills" and msg_clean in ["hi", "hello", "hey", "greetings", "hi there", "hello there"]:
        bot_message = (
            "Hi there! Great to connect.\n\n"
            "To kick things off, please tell me what position you're looking to fill today? Also, include the key skills, technologies, and how many candidates you need to hire for this role.\n\n"
            "Role: \n"
            "Number of Positions: \n"
            "Experience: \n"
            "Key Skills: \n"
            "Department: \n"
            "Location:\n"
            "Salary Budget: \n"
            "Additional Requirements: "
        )
        session["messages"].append({
            "role": "assistant",
            "content": bot_message,
            "timestamp": datetime.utcnow().isoformat()
        })
        return ChatMessageResponse(
            session_id=request.session_id,
            bot_message=bot_message,
            step=current_step,
            hiring_request=session.get("hiring_request"),
            workflow_triggered=False,
            workflow_session_id=None
        )

    # ── Extract data from user message for data-collection steps ──────────────
    data_steps = [
        "collect_job_title_and_skills",
        "collect_experience",
        "collect_department",
        "collect_location",
        "collect_budget",
        "collect_candidates_needed",
        "collect_additional_requirements",
    ]

    if current_step in data_steps:
        extracted = _extract_data_from_message(current_step, request.message, session)
        if extracted:
            session["hiring_request"].update(extracted)

    # ── Handle confirmation step ───────────────────────────────────────────────
    if current_step == "confirmation":
        msg_lower = request.message.lower()
        if any(word in msg_lower for word in ["yes", "confirm", "looks good", "correct", "proceed", "go ahead", "ok", "okay"]):
            # Move to JD generation
            session["step"] = "jd_generation"
            bot_message = (
                "✅ **Hiring request confirmed!**\n\n"
                "I'm now generating a professional Job Description tailored to your requirements. "
                "This will take just a moment... 🤖⚙️"
            )
            session["messages"].append({
                "role": "assistant",
                "content": bot_message,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            # Generate JD
            bot_message = await _generate_jd_in_session(session)
            session["step"] = "jd_review"
        else:
            bot_message = (
                "No problem! Let me know what you'd like to change. "
                "Which part of the hiring request needs updating?"
            )
    
    elif current_step == "jd_review":
        # User is reviewing/approving the JD
        msg_lower = request.message.lower()
        if any(word in msg_lower for word in ["approve", "approved", "looks good", "yes", "go ahead", "post it", "publish"]):
            session["step"] = "workflow_running"
            workflow_triggered = True
            
            # Trigger the actual agentic workflow
            workflow_session_id = await _trigger_hiring_workflow(session)
            session["workflow_session_id"] = workflow_session_id
            
            bot_message = (
                "🎉 **JD Approved! Workflow is now running!**\n\n"
                "I've kicked off the complete hiring pipeline:\n"
                "1. ✅ Job Description approved\n"
                "2. 📢 Posting JD to LinkedIn, Naukri, Wellfound, Indeed & Company Portal\n"
                "3. 👀 Monitoring applications (threshold: 10+ candidates)\n"
                "4. 📋 Will auto-shortlist & rank candidates\n"
                "5. 📅 Schedule & conduct interviews\n"
                "6. 📄 Generate offer letters\n"
                "7. 🎊 Complete onboarding\n\n"
                "You can track the live progress on the **Workflow Monitor** page. "
                "I'll update you here as key milestones are reached! 🚀"
            )
            session["step"] = "complete"
        else:
            # They want changes to the JD
            session["hiring_request"]["jd_feedback"] = request.message
            bot_message = (
                f"Got it! I'll revise the JD based on your feedback: *\"{request.message}\"*\n\n"
                "Regenerating the JD now... 🔄"
            )
            session["messages"].append({
                "role": "assistant",
                "content": bot_message,
                "timestamp": datetime.utcnow().isoformat()
            })
            bot_message = await _generate_jd_in_session(session)
    
    else:
        # Regular data collection or transition
        bot_message = _generate_bot_response(session, request.message)
        
        # Advance step based on what was collected
        if current_step in data_steps and session["hiring_request"]:
            next_step = _get_next_step(current_step, session)
            session["step"] = next_step
            
            # If we reached confirmation, append a summary
            if next_step == "confirmation":
                hr = session["hiring_request"]
                summary = _build_summary(hr)
                bot_message = (
                    f"Great! Here's a summary of your hiring request:\n\n"
                    f"{summary}\n\n"
                    "Does everything look correct? Type **'confirm'** to proceed with JD generation, "
                    "or let me know what needs to be changed."
                )

    # Add bot response to history
    session["messages"].append({
        "role": "assistant",
        "content": bot_message,
        "timestamp": datetime.utcnow().isoformat()
    })

    return ChatMessageResponse(
        session_id=request.session_id,
        bot_message=bot_message,
        step=session.get("step", current_step),
        hiring_request=session.get("hiring_request"),
        workflow_triggered=workflow_triggered,
        workflow_session_id=workflow_session_id
    )


@router.get("/session/{session_id}")
async def get_session(session_id: str):
    """Get chatbot session history."""
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "session_id": session_id,
        "step": session.get("step"),
        "messages": session.get("messages", []),
        "hiring_request": session.get("hiring_request", {}),
        "jd_content": session.get("jd_content"),
        "workflow_session_id": session.get("workflow_session_id"),
    }


@router.post("/approve-jd")
async def approve_jd(request: JDApprovalRequest):
    """Approve or reject the generated JD."""
    session = _sessions.get(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if request.approved:
        session["jd_approved"] = True
        session["step"] = "workflow_running"
        workflow_session_id = await _trigger_hiring_workflow(session)
        session["workflow_session_id"] = workflow_session_id
        return {
            "approved": True,
            "message": "JD approved. Hiring workflow started!",
            "workflow_session_id": workflow_session_id
        }
    else:
        session["jd_approved"] = False
        session["hiring_request"]["jd_feedback"] = request.feedback or "Please improve the JD"
        session["step"] = "jd_generation"
        return {
            "approved": False,
            "message": "JD sent back for revision.",
            "feedback": request.feedback
        }


# ── Helper Functions ───────────────────────────────────────────────────────────

def _build_summary(hr: dict) -> str:
    """Build a markdown summary of the hiring request."""
    skills = hr.get("skills_required", [])
    skills_str = ", ".join(skills) if skills else "Not specified"
    return (
        f"📋 **Hiring Request Summary**\n\n"
        f"- **Job Title**: {hr.get('job_title', 'Not specified')}\n"
        f"- **Department**: {hr.get('department', 'Not specified')}\n"
        f"- **Skills & Technologies**: {skills_str}\n"
        f"- **Experience**: {hr.get('experience_years', 'Not specified')}\n"
        f"- **Location**: {hr.get('location', 'Not specified')}\n"
        f"- **Budget/Salary**: {hr.get('budget', 'Not specified')}\n"
        f"- **Candidates to Hire**: {hr.get('candidates_needed', 'Not specified')}\n"
        f"- **Additional Requirements**: {hr.get('additional_requirements', 'None')}"
    )


async def _generate_jd_in_session(session: dict) -> str:
    """Generate a JD based on the hiring request and return it formatted for chat."""
    hr = session.get("hiring_request", {})
    skills = ", ".join(hr.get("skills_required", []))
    feedback = hr.get("jd_feedback", "")
    
    jd_prompt = f"""Generate a professional Job Description for:
Job Title: {hr.get('job_title', 'Software Engineer')}
Department: {hr.get('department', 'Engineering')}
Required Skills/Technologies: {skills or 'Not specified'}
Experience: {hr.get('experience_years', '3+ years')}
Budget: {hr.get('budget', 'Competitive')}
Location: {hr.get('location', 'Remote')}
Positions Available: {hr.get('candidates_needed', 1)}
Additional Requirements: {hr.get('additional_requirements', 'None')}
{f'Previous Feedback to Address: {feedback}' if feedback else ''}

Create a complete, attractive JD with:
1. Job Title & Overview
2. Key Responsibilities (8-10 points)
3. Required Skills & Technologies (match exactly what was specified)
4. Good to Have Skills
5. Experience Requirements
6. What We Offer (benefits, culture, growth)
7. How to Apply

Format in clean Markdown. Make it compelling and specific to the technologies mentioned.
"""
    
    try:
        response = llm.invoke([SystemMessage(content=jd_prompt)])
        jd_content = response.content.strip()
        session["jd_content"] = jd_content
        
        return (
            f"✨ **Here's your Job Description:**\n\n"
            f"{jd_content}\n\n"
            f"---\n"
            f"👆 Please review the JD above. "
            f"Type **'approve'** to post it on all platforms and start the hiring workflow, "
            f"or tell me what changes you'd like to make."
        )
    except Exception as e:
        return f"Sorry, I encountered an error generating the JD: {str(e)}. Please try again."


async def _trigger_hiring_workflow(session: dict) -> str:
    """Trigger the LangGraph hiring workflow with the collected hiring request."""
    import uuid as _uuid
    workflow_id = str(_uuid.uuid4())[:8].upper()
    
    hr = session.get("hiring_request", {})
    job_title = hr.get("job_title", "Open Position")
    
    try:
        from backend.workflows.graph import hiring_graph
        
        thread_config = {"configurable": {"thread_id": workflow_id}}
        initial_state = {
            "messages": [],
            "job_id": workflow_id,
            "goal": f"Hire {hr.get('candidates_needed', 1)} {job_title}(s) for {hr.get('department', 'the team')}",
            "next_action": "jd_generation",
            "agent_statuses": {"chatbot": "initiated"},
            "plan": [],
            "current_step_index": 0,
            "data": {},
            "hiring_request": hr,
            "jd_content": session.get("jd_content"),
            "jd_approved": True,  # Already approved in chatbot
            "jd_feedback": "",
            "jd_retry_count": 1,
            "posting_status": {},
            "application_count": 0,
            "candidates_needed": hr.get("candidates_needed", 10),
            "sourcing_retry_count": 0,
            "shortlisted_candidates": [],
            "candidate_rankings": {},
            "scheduled_interviews": [],
            "interview_results": {},
            "selected_candidates": [],
            "offer_letters": {},
            "offer_status": {},
            "negotiation_rounds": {},
            "onboarding_tasks": [],
            "onboarding_status": {},
            "chat_session_id": session.get("session_id"),
            "chat_history": session.get("messages", []),
            "error": None,
        }
        
        # Run async in background (non-blocking)
        import asyncio
        asyncio.create_task(
            asyncio.to_thread(
                hiring_graph.invoke,
                initial_state,
                thread_config
            )
        )
        print(f"[Chatbot] ✅ Workflow {workflow_id} triggered for job: {job_title}")
    except Exception as e:
        print(f"[Chatbot] Workflow trigger error: {e}")
    
    return workflow_id
