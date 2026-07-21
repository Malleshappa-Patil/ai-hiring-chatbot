"""
Email notification service using fastapi-mail.
Supports mock mode (logs to console) and real SMTP sending.
"""
import logging
from typing import Optional
from pathlib import Path

from backend.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """
    Unified email service.
    MAIL_MOCK=true  → logs emails to console (no SMTP needed)
    MAIL_MOCK=false → sends via fastapi-mail over SMTP
    """

    def __init__(self):
        self.mock = settings.MAIL_MOCK
        self._mail = None

    def _get_mail(self):
        """Lazy-initialize fastapi-mail connection."""
        if self._mail is None and not self.mock:
            try:
                from fastapi_mail import FastMail, ConnectionConfig
                config = ConnectionConfig(
                    MAIL_USERNAME=settings.MAIL_USERNAME,
                    MAIL_PASSWORD=settings.MAIL_PASSWORD,
                    MAIL_FROM=settings.MAIL_FROM,
                    MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
                    MAIL_PORT=settings.MAIL_PORT,
                    MAIL_SERVER=settings.MAIL_SERVER,
                    MAIL_STARTTLS=settings.MAIL_STARTTLS,
                    MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
                    USE_CREDENTIALS=bool(settings.MAIL_USERNAME),
                    VALIDATE_CERTS=True,
                )
                self._mail = FastMail(config)
            except ImportError:
                logger.warning("fastapi-mail not installed. Falling back to mock mode.")
                self.mock = True
        return self._mail

    async def send(
        self,
        to: list[str],
        subject: str,
        body: str,
        html: Optional[str] = None,
    ) -> bool:
        """Send an email. Returns True on success."""
        if self.mock:
            logger.info(
                f"\n{'='*60}\n"
                f"📧 MOCK EMAIL\n"
                f"  To:      {', '.join(to)}\n"
                f"  Subject: {subject}\n"
                f"  Body:\n{body}\n"
                f"{'='*60}"
            )
            return True

        try:
            from fastapi_mail import MessageSchema, MessageType
            mail = self._get_mail()
            message = MessageSchema(
                subject=subject,
                recipients=to,
                body=html or body,
                subtype=MessageType.html if html else MessageType.plain,
            )
            await mail.send_message(message)
            logger.info(f"Email sent to {to}: {subject}")
            return True
        except Exception as e:
            logger.error(f"Email send failed: {e}")
            return False

    # ── Pre-built Templates ────────────────────────────────────────

    async def send_jd_approval_request(
        self, recruiter_email: str, job_title: str, jd_preview: str, approval_url: str
    ) -> bool:
        return await self.send(
            to=[recruiter_email],
            subject=f"[Action Required] Review Job Description: {job_title}",
            body=f"""
Hi there,

The AI has generated a Job Description for "{job_title}".

Preview:
{jd_preview[:500]}...

Please review and approve or reject in the dashboard:
{approval_url}

Best,
AI Hiring Platform
""",
            html=f"""
<h2>Job Description Ready for Review</h2>
<p>The AI has generated a JD for <strong>{job_title}</strong>.</p>
<blockquote style="background:#f4f4f4;padding:12px;border-left:4px solid #6366f1;">
  {jd_preview[:500]}...
</blockquote>
<p><a href="{approval_url}" style="background:#6366f1;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;">
  Review in Dashboard →
</a></p>
""",
        )

    async def send_interview_invitation(
        self,
        candidate_email: str,
        candidate_name: str,
        job_title: str,
        scheduled_at: str,
        interviewer: str,
        meeting_link: Optional[str] = None,
    ) -> bool:
        return await self.send(
            to=[candidate_email],
            subject=f"Interview Invitation — {job_title}",
            body=f"""
Dear {candidate_name},

Congratulations! You have been shortlisted for the {job_title} position.

Interview Details:
- Date & Time: {scheduled_at}
- Interviewer: {interviewer}
{"- Meeting Link: " + meeting_link if meeting_link else ""}

Please confirm your availability by replying to this email.

Best regards,
Hiring Team
""",
        )

    async def send_welcome_onboarding(
        self, candidate_email: str, candidate_name: str, job_title: str
    ) -> bool:
        return await self.send(
            to=[candidate_email],
            subject=f"Welcome to the Team — {job_title}",
            body=f"""
Dear {candidate_name},

We are thrilled to welcome you as our new {job_title}!

Your onboarding process has been initiated. Your HR team will be in touch shortly
with further details about your first day.

Welcome aboard!

Best regards,
HR Team
""",
        )

    async def send_candidate_rejection(
        self, candidate_email: str, candidate_name: str, job_title: str
    ) -> bool:
        html = f"""
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#1a1a2e;">Update on Your Application — {job_title}</h2>
  <p>Dear <strong>{candidate_name}</strong>,</p>
  <p>Thank you for taking the time to apply for the <strong>{job_title}</strong> position
  and for the effort you put into your application.</p>
  <p>After careful consideration, we have decided to move forward with other candidates
  whose qualifications more closely match our current requirements.
  This was a genuinely difficult decision and in no way reflects your potential.</p>
  <p>We were impressed by your background and encourage you to keep growing
  and exploring new opportunities. The right role is out there, and we believe
  you will find it. We will keep your profile on file and may reach out for
  future openings that are a strong match for your skills.</p>
  <p>We sincerely wish you every success in your career journey ahead.</p>
  <p>Warm regards,<br/><strong>Hiring Team</strong><br/>AI Hiring Platform</p>
</div>
"""
        return await self.send(
            to=[candidate_email],
            subject=f"Update on Your Application — {job_title}",
            body=(
                f"Dear {candidate_name},\n\n"
                f"Thank you for applying for the {job_title} position.\n\n"
                "After careful consideration, we have decided to move forward with other candidates "
                "whose qualifications more closely match our current requirements. "
                "This was a difficult decision and does not reflect your potential.\n\n"
                "We encourage you to keep growing. The right opportunity is just around the corner. "
                "We will keep your profile on file for future openings.\n\n"
                "We sincerely wish you every success in your career journey.\n\n"
                "Warm regards,\nHiring Team\nAI Hiring Platform"
            ),
            html=html,
        )

    async def send_selection_email(
        self, candidate_email: str, candidate_name: str, job_title: str, company_name: str = "our company"
    ) -> bool:
        html = f"""
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#065f46;">Congratulations, {candidate_name}! 🎉</h2>
  <p>Dear <strong>{candidate_name}</strong>,</p>
  <p>We are absolutely thrilled to inform you that you have been
  <strong>selected for the {job_title} role</strong> at {company_name}!</p>
  <p>Your skills, experience, and the enthusiasm you demonstrated throughout
  the process truly stood out. We are excited to have you join the team.</p>
  <p>Our HR team will be reaching out to you shortly with the next steps,
  including details about your offer letter, start date, and onboarding process.</p>
  <p>In the meantime, please do not hesitate to reach out if you have any questions.</p>
  <p>Welcome aboard — we cannot wait to work with you!</p>
  <p>Best regards,<br/><strong>Hiring Team</strong><br/>AI Hiring Platform</p>
</div>
"""
        return await self.send(
            to=[candidate_email],
            subject=f"Congratulations — You've been selected for {job_title}! 🎉",
            body=(
                f"Dear {candidate_name},\n\n"
                f"We are thrilled to inform you that you have been selected for the {job_title} role!\n\n"
                "Your skills and the enthusiasm you demonstrated throughout the process truly stood out. "
                "Our HR team will reach out shortly with your offer letter and onboarding details.\n\n"
                "Welcome aboard! We cannot wait to work with you.\n\n"
                "Best regards,\nHiring Team\nAI Hiring Platform"
            ),
            html=html,
        )


# Singleton
email_service = EmailService()
