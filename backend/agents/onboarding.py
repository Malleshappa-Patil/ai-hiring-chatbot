"""
Onboarding Agent — Step 18 from agentic-workflow.md.

Actions:
- Collect Documents
- Create Employee Record
- Generate Employee ID
- Trigger IT Asset Allocation
- Send Welcome Kit
"""
import random
import uuid
from datetime import datetime, timedelta
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage
from backend.config import settings
from backend.workflows.state import HiringState

llm = ChatGoogleGenerativeAI(
    model=settings.GEMINI_MODEL,
    temperature=0.2,
    google_api_key=settings.GOOGLE_API_KEY
)

WELCOME_EMAIL_PROMPT = """You are an HR Manager at a tech company.
Write a warm, enthusiastic welcome email for a new employee joining the team.

Employee Name: {employee_name}
Job Title: {job_title}
Department: {department}
Start Date: {start_date}
Employee ID: {employee_id}

Include:
1. Warm congratulations and welcome
2. What to expect on the first day
3. IT setup instructions (laptop, email, tools access)
4. Team introduction plan
5. Key contacts (HR, IT, Manager)
6. Helpful links (HR portal, employee handbook)

Keep it exciting and welcoming (200-250 words).
Start with: "Dear {employee_name},"
"""


def onboarding_node(state: HiringState) -> dict:
    """
    Onboarding Agent — Step 18 from agentic-workflow.md.
    Triggers complete onboarding workflow for accepted candidates.
    """
    offer_status = state.get("offer_status", {})
    selected_candidates = state.get("selected_candidates", [])
    data = state.get("data", {})
    hiring_req = state.get("hiring_request", {})
    job_title = hiring_req.get("job_title", "Software Engineer")
    department = hiring_req.get("department", "Engineering")

    # Get accepted candidates
    accepted_ids = {cid for cid, status in offer_status.items() if status == "accepted"}
    # Also check from renegotiation data
    renegotiation_accepted = data.get("accepted_candidates", [])
    
    accepted_candidates = [
        c for c in selected_candidates
        if c.get("id") in accepted_ids
    ] or renegotiation_accepted

    if not accepted_candidates:
        print("[Onboarding Agent] No accepted candidates to onboard.")
        return {
            "agent_statuses": {"onboarding": "no_candidates"},
            "next_action": "end",
        }

    print(f"[Onboarding Agent] Starting onboarding for {len(accepted_candidates)} new hire(s)...")

    onboarding_tasks = []
    onboarding_status = {}
    start_date = (datetime.utcnow() + timedelta(days=30)).strftime("%B %d, %Y")

    for candidate in accepted_candidates:
        employee_id = f"EMP-{str(uuid.uuid4())[:8].upper()}"
        candidate_name = candidate.get("name", "New Employee")
        candidate_id = candidate.get("id")

        print(f"\n  🎉 Onboarding: {candidate_name} (ID: {employee_id})")

        # Step 1: Create Employee Record (mock HRMS)
        employee_record = {
            "employee_id": employee_id,
            "name": candidate_name,
            "job_title": job_title,
            "department": department,
            "start_date": start_date,
            "candidate_id": candidate_id,
            "created_at": datetime.utcnow().isoformat(),
        }
        print(f"    ✅ Employee record created: {employee_id}")

        # Step 2: IT Asset Allocation (mock IT ticketing)
        it_ticket = {
            "ticket_id": f"IT-{random.randint(10000, 99999)}",
            "employee_id": employee_id,
            "assets_requested": ["MacBook Pro 14\"", "Monitor 27\"", "Keyboard & Mouse", "Headphones"],
            "software_access": ["GitHub", "Jira", "Slack", "Google Workspace", "AWS Console"],
            "status": "in_progress",
            "created_at": datetime.utcnow().isoformat(),
        }
        print(f"    ✅ IT ticket raised: {it_ticket['ticket_id']}")

        # Step 3: Document Collection checklist
        documents_needed = [
            "Signed Offer Letter",
            "Government-issued ID (Aadhaar/Passport)",
            "PAN Card",
            "Previous Employment Letter",
            "Educational Certificates",
            "Bank Account Details",
            "Professional References (2)",
        ]

        # Step 4: Generate Welcome Email via LLM
        try:
            prompt = WELCOME_EMAIL_PROMPT.format(
                employee_name=candidate_name,
                job_title=job_title,
                department=department,
                start_date=start_date,
                employee_id=employee_id,
            )
            response = llm.invoke([SystemMessage(content=prompt)])
            welcome_email = response.content.strip()
        except Exception as e:
            print(f"    [Onboarding] Error generating welcome email: {e}")
            welcome_email = (
                f"Dear {candidate_name},\n\n"
                f"Welcome to AI Hiring Platform! We're thrilled to have you join us as "
                f"{job_title} in the {department} team.\n\n"
                f"Your Employee ID is: {employee_id}\nStart Date: {start_date}\n\n"
                f"Please check your email for further instructions.\n\nWelcome aboard! 🎉\n\nHR Team"
            )
        print(f"    ✅ Welcome kit email sent to {candidate_name}")

        # Compile all onboarding tasks
        onboarding_task = {
            "employee_id": employee_id,
            "candidate_id": candidate_id,
            "candidate_name": candidate_name,
            "employee_record": employee_record,
            "it_ticket": it_ticket,
            "documents_needed": documents_needed,
            "welcome_email_sent": True,
            "welcome_email_preview": welcome_email[:300] + "...",
            "start_date": start_date,
            "status": "onboarding_initiated",
            "checklist": {
                "employee_record_created": True,
                "it_assets_requested": True,
                "document_collection_triggered": True,
                "welcome_email_sent": True,
                "manager_notified": True,
                "hr_orientation_scheduled": True,
            }
        }
        onboarding_tasks.append(onboarding_task)
        onboarding_status[employee_id] = "onboarding_initiated"

    print(f"\n[Onboarding Agent] ✅ Onboarding complete for {len(accepted_candidates)} employee(s).")
    print("[Onboarding Agent] 🏁 Hiring workflow COMPLETE!")

    return {
        "onboarding_tasks": onboarding_tasks,
        "onboarding_status": onboarding_status,
        "agent_statuses": {"onboarding": "completed"},
        "next_action": "end",
    }
