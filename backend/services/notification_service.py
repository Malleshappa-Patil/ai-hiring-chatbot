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
        meet_link_str = meeting_link or "https://meet.google.com/abc-defg-hij"

        meet_button_html = f"""
        <div style="margin-top:20px;text-align:center;">
          <a href="{meet_link_str}" target="_blank" style="display:inline-block;background:#059669;color:#ffffff;font-weight:700;font-size:15px;padding:12px 28px;border-radius:8px;text-decoration:none;box-shadow:0 2px 8px rgba(5,150,105,0.25);">
            🎥 Join Google Meet Interview
          </a>
          <div style="margin-top:8px;font-size:12px;color:#6b7280;">Meeting Link: <a href="{meet_link_str}" style="color:#059669;">{meet_link_str}</a></div>
        </div>
        """

        html = f"""
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <!-- Header -->
  <div style="background:linear-gradient(135deg,#065f46 0%,#047857 100%);padding:32px 36px;">
    <div style="color:#a7f3d0;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:6px;">AI Hiring Platform</div>
    <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0;">📅 Interview Invitation</h1>
    <div style="color:#d1fae5;font-size:14px;margin-top:4px;">{job_title}</div>
  </div>

  <!-- Body -->
  <div style="padding:32px 36px;">
    <p style="color:#111827;font-size:16px;margin:0 0 20px;">Dear <strong>{candidate_name}</strong>,</p>

    <p style="color:#374151;line-height:1.7;margin:0 0 24px;">
      Great news! Based on your application review, the hiring team would love to invite you for an interview for the <strong>{job_title}</strong> role.
    </p>

    <!-- Details Box -->
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px 24px;margin-bottom:28px;">
      <div style="font-size:11px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:14px;">🗓 Interview Details</div>

      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151;">
        <tr>
          <td style="padding:8px 0;color:#6b7280;width:120px;font-weight:600;">Date & Time</td>
          <td style="padding:8px 0;font-weight:700;color:#111827;">{scheduled_at}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;font-weight:600;">Interviewer</td>
          <td style="padding:8px 0;font-weight:600;color:#111827;">{interviewer}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280;font-weight:600;">Location</td>
          <td style="padding:8px 0;font-weight:600;color:#111827;">🎥 Google Meet (Video Call)</td>
        </tr>
      </table>

      {meet_button_html}
    </div>

    <p style="color:#374151;line-height:1.6;margin:0 0 24px;">
      Please join the video call 2–3 minutes before the scheduled start time. Make sure your microphone and camera are tested beforehand.
    </p>

    <p style="color:#374151;margin:0;">Best of luck,<br/>
    <strong>Hiring Team</strong><br/>
    <span style="color:#6b7280;font-size:13px;">AI Hiring Platform</span></p>
  </div>

  <!-- Footer -->
  <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 36px;text-align:center;">
    <p style="color:#9ca3af;font-size:11px;margin:0;">This is an automated invitation from the AI Hiring Platform.</p>
  </div>
</div>
"""
        body = f"""Dear {candidate_name},

Congratulations! You have been invited for an interview for the {job_title} position.

Interview Details:
- Date & Time: {scheduled_at}
- Interviewer: {interviewer}
- Google Meet Link: {meet_link_str}

Please join the Google Meet video call at your scheduled time:
{meet_link_str}

Best regards,
Hiring Team
"""
        return await self.send(
            to=[candidate_email],
            subject=f"Interview Invitation — {job_title}",
            body=body,
            html=html,
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

    async def send_screening_rejection(
        self,
        candidate_email: str,
        candidate_name: str,
        job_title: str,
        score: float = 0.0,
        explanation: str = "",
        skills_missing: list[str] | None = None,
    ) -> bool:
        """
        Rich rejection email sent automatically after AI resume screening.
        Includes: match score, reason, missing skills, and a motivational note.
        """
        skills_missing = skills_missing or []

        # Build missing-skills HTML list
        if skills_missing:
            skills_html = "<ul style='margin:8px 0;padding-left:20px;'>" + \
                          "".join(f"<li style='margin-bottom:4px;color:#374151;'>{s}</li>" for s in skills_missing) + \
                          "</ul>"
            skills_text = "\n".join(f"  • {s}" for s in skills_missing)
        else:
            skills_html = "<p style='color:#6b7280;font-style:italic;'>No specific gaps identified — the overall profile did not reach our match threshold for this role.</p>"
            skills_text = "  No specific skill gaps identified."

        reason_html = f"<p style='color:#374151;line-height:1.6;'>{explanation}</p>" if explanation else ""
        reason_text = explanation or "Your profile did not meet the minimum match threshold for this role."

        score_badge_color = "#dc2626" if score < 50 else "#d97706"
        score_pct = f"{score:.0f}%"

        html = f"""
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);padding:32px 36px;">
    <div style="color:#a5b4fc;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:6px;">AI Hiring Platform</div>
    <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0;">Application Update</h1>
    <div style="color:#c7d2fe;font-size:14px;margin-top:4px;">{job_title}</div>
  </div>

  <!-- Body -->
  <div style="padding:32px 36px;">
    <p style="color:#111827;font-size:16px;margin:0 0 20px;">Dear <strong>{candidate_name}</strong>,</p>

    <p style="color:#374151;line-height:1.7;margin:0 0 20px;">
      Thank you sincerely for your interest in the <strong>{job_title}</strong> role and
      for the time you invested in your application. After a thorough AI-assisted review
      of your resume, we are unable to move forward with your application at this stage.
    </p>

    <!-- Score badge -->
    <div style="display:flex;align-items:center;gap:12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
      <div style="background:{score_badge_color};color:#fff;font-weight:700;font-size:18px;padding:6px 14px;border-radius:6px;white-space:nowrap;">Match: {score_pct}</div>
      <div style="color:#6b7280;font-size:13px;line-height:1.5;">Your resume achieved a <strong style='color:#374151;'>{score_pct} match</strong> against the job requirements. Our threshold for this role is <strong style='color:#374151;'>70%</strong>.</div>
    </div>

    <!-- Reason -->
    <div style="margin-bottom:24px;">
      <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">📋 Reason</div>
      {reason_html}
    </div>

    <!-- Missing skills -->
    <div style="margin-bottom:28px;">
      <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">🛠 Skills to Develop</div>
      <p style="color:#374151;font-size:13px;margin:0 0 8px;">Strengthening the following areas would significantly boost your match for similar roles:</p>
      {skills_html}
    </div>

    <!-- Motivational note -->
    <div style="background:linear-gradient(135deg,#ecfdf5,#f0fdf4);border-left:4px solid #10b981;padding:18px 20px;border-radius:0 8px 8px 0;margin-bottom:28px;">
      <div style="font-size:11px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">💪 Keep Going — You've Got This</div>
      <p style="color:#065f46;line-height:1.7;margin:0;font-size:14px;">
        Every rejection is a step closer to the right opportunity. The skills gap above is
        not a wall — it's a roadmap. Spend a few weeks levelling up in those areas and you
        could be an excellent fit for the next opening. <strong>Never stop learning, never
        stop building.</strong> The best version of your career is still ahead of you.
      </p>
    </div>

    <p style="color:#374151;line-height:1.6;margin:0 0 24px;">
      We will keep your profile on file. Should a role emerge that aligns more closely
      with your current skill set, we will not hesitate to reach out.
    </p>

    <p style="color:#374151;margin:0;">Warm regards,<br/>
    <strong>Hiring Team</strong><br/>
    <span style="color:#6b7280;font-size:13px;">AI Hiring Platform</span></p>
  </div>

  <!-- Footer -->
  <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 36px;text-align:center;">
    <p style="color:#9ca3af;font-size:11px;margin:0;">This is an automated message from the AI Hiring Platform. Please do not reply to this email.</p>
  </div>
</div>
"""

        body = (
            f"Dear {candidate_name},\n\n"
            f"Thank you for applying for the {job_title} position.\n\n"
            f"MATCH SCORE: {score_pct} (threshold: 70%)\n\n"
            f"REASON:\n{reason_text}\n\n"
            f"SKILLS TO DEVELOP:\n{skills_text}\n\n"
            "KEEP GOING:\n"
            "Every rejection is a step closer to the right opportunity. The skills gap above "
            "is not a wall — it's a roadmap. Strengthen those areas and you'll be a strong "
            "candidate for the next opening. Never stop learning, never stop building.\n\n"
            "We'll keep your profile on file for future opportunities.\n\n"
            "Warm regards,\nHiring Team\nAI Hiring Platform"
        )

        return await self.send(
            to=[candidate_email],
            subject=f"Your Application for {job_title} — Feedback & Next Steps",
            body=body,
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
