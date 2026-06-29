"""
Candidate Communication Agent — Step 15A from agentic-workflow.md.
Sends rejection emails to non-selected candidates.
Also handles offer letter sending for selected candidates (Step 15B).
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

REJECTION_EMAIL_PROMPT = """You are a compassionate HR professional at a tech company.
Write a professional, empathetic rejection email for the following candidate.

Position: {job_title}
Candidate Name: {candidate_name}
Company: AI Hiring Platform
Interview Score: {interview_score}/100

Guidelines:
- Be warm and respectful
- Thank them for their time
- Mention 1-2 genuine positive observations
- Encourage them to apply for future roles
- Keep it concise (150-200 words)
- Professional closing

Write ONLY the email body (no subject line needed). Start with "Dear {candidate_name},"
"""


def communication_node(state: HiringState) -> dict:
    """
    Candidate Communication Agent — Step 15A.
    Sends personalized rejection emails to non-selected candidates.
    """
    data = state.get("data", {})
    rejected_candidates = data.get("rejected_candidates", [])
    hiring_req = state.get("hiring_request", {})
    job_title = hiring_req.get("job_title", "the position")

    print(f"[Communication Agent] Sending rejection emails to {len(rejected_candidates)} candidates...")

    sent_emails = {}

    for candidate in rejected_candidates:
        candidate_name = candidate.get("name", "Candidate")
        candidate_id = candidate.get("id", "unknown")
        interview_score = candidate.get("interview_score", 50)

        try:
            prompt = REJECTION_EMAIL_PROMPT.format(
                job_title=job_title,
                candidate_name=candidate_name,
                interview_score=interview_score,
            )
            response = llm.invoke(prompt)
            email_body = response.content.strip()
        except Exception as e:
            print(f"  [Communication] Error generating email for {candidate_name}: {e}")
            email_body = (
                f"Dear {candidate_name},\n\n"
                f"Thank you for your interest in the {job_title} position. "
                f"After careful consideration, we have decided to proceed with other candidates. "
                f"We appreciate your time and encourage you to apply for future openings.\n\n"
                f"Best regards,\nHR Team"
            )

        # Mock email sending (in real app, would call email service)
        sent_emails[candidate_id] = {
            "candidate_name": candidate_name,
            "email_type": "rejection",
            "status": "sent_mock",
            "subject": f"Update on your application for {job_title}",
            "body_preview": email_body[:200] + "...",
        }
        print(f"  📧 Rejection email sent to {candidate_name} (mock)")

    return {
        "data": {"rejection_emails_sent": sent_emails},
        "agent_statuses": {"communication": "completed"},
        "next_action": "offer_management",  # Now handle selected candidates
    }
