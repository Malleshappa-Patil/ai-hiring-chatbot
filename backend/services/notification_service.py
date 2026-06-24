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
        return await self.send(
            to=[candidate_email],
            subject=f"Application Update — {job_title}",
            body=f"""
Dear {candidate_name},

Thank you for your interest in the {job_title} position.

After careful consideration, we regret to inform you that we will not be
moving forward with your application at this time.

We appreciate the time you invested in our process and wish you all the best
in your job search.

Best regards,
Hiring Team
""",
        )


# Singleton
email_service = EmailService()
