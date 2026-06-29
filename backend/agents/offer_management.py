"""
Offer Management Agent — Step 15B from agentic-workflow.md.
Generates personalized offer letters and sends them to selected candidates.
Tracks acceptance/rejection status.
"""
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage
from backend.config import settings
from backend.workflows.state import HiringState

llm = ChatGoogleGenerativeAI(
    model=settings.GEMINI_MODEL,
    temperature=0.3,
    google_api_key=settings.GOOGLE_API_KEY
)

OFFER_LETTER_PROMPT = """You are an HR Manager generating a formal offer letter.

Company: AI Hiring Platform (A forward-thinking tech company)
Position: {job_title}
Department: {department}
Candidate Name: {candidate_name}
Salary Budget: {budget}
Location: {location}
Start Date: 30 days from today

Generate a complete, professional offer letter that includes:
1. Formal greeting and congratulations
2. Position details (title, department, reporting structure)
3. Compensation package (salary, bonuses, equity if applicable)
4. Benefits overview (health insurance, PTO, learning budget, etc.)
5. Employment conditions (start date, probation period if any)
6. Acceptance deadline (1 week from date)
7. Professional closing with signature block

Make it warm but professional. Format in clean text (not markdown).
"""


def offer_management_node(state: HiringState) -> dict:
    """
    Offer Management Agent — Step 15B from agentic-workflow.md.
    Generates and sends offer letters to selected candidates.
    """
    selected_candidates = state.get("selected_candidates", [])
    hiring_req = state.get("hiring_request", {})
    job_title = hiring_req.get("job_title", "Software Engineer")
    department = hiring_req.get("department", "Engineering")
    budget = hiring_req.get("budget", "Competitive")
    location = hiring_req.get("location", "Remote")

    if not selected_candidates:
        print("[Offer Management] No selected candidates. Ending process.")
        return {
            "agent_statuses": {"offer_management": "no_candidates"},
            "next_action": "end",
        }

    print(f"[Offer Management Agent] Generating offer letters for {len(selected_candidates)} candidates...")

    offer_letters = {}
    offer_status = {}

    for candidate in selected_candidates:
        candidate_id = candidate.get("id")
        candidate_name = candidate.get("name", "Candidate")

        try:
            prompt = OFFER_LETTER_PROMPT.format(
                job_title=job_title,
                department=department,
                candidate_name=candidate_name,
                budget=budget,
                location=location,
            )
            response = llm.invoke(prompt)
            offer_content = response.content.strip()
        except Exception as e:
            print(f"  [Offer] Error generating offer for {candidate_name}: {e}")
            offer_content = (
                f"Dear {candidate_name},\n\n"
                f"We are pleased to offer you the position of {job_title} at AI Hiring Platform.\n\n"
                f"Salary: {budget}\nLocation: {location}\nDepartment: {department}\n\n"
                f"Please respond within 7 days.\n\nBest regards,\nHR Team"
            )

        offer_letters[candidate_id] = {
            "candidate_id": candidate_id,
            "candidate_name": candidate_name,
            "job_title": job_title,
            "offer_content": offer_content,
            "sent_at": __import__("datetime").datetime.utcnow().isoformat(),
            "acceptance_deadline": (__import__("datetime").datetime.utcnow() + 
                                   __import__("datetime").timedelta(days=7)).isoformat(),
        }
        # Mock: candidate has 70% chance of accepting on first offer
        import random
        initial_response = random.choices(
            ["accepted", "rejected", "renegotiating"],
            weights=[0.65, 0.10, 0.25]
        )[0]
        offer_status[candidate_id] = initial_response

        print(f"  📄 Offer letter sent to {candidate_name} → Response: {initial_response}")

    # Check if any need renegotiation
    needs_renegotiation = any(v == "renegotiating" for v in offer_status.values())
    all_decided = all(v in ["accepted", "rejected"] for v in offer_status.values())

    if needs_renegotiation:
        next_action = "renegotiation"
    else:
        next_action = "onboarding"

    return {
        "offer_letters": offer_letters,
        "offer_status": offer_status,
        "agent_statuses": {"offer_management": "completed"},
        "next_action": next_action,
    }
