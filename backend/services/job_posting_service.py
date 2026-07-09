"""
Job Posting Service — distributes an approved JD to multiple platforms.

Supported channels:
1. Internal Job Board   — always succeeds (already in DB on approval)
2. Recruitee            — REST API (requires RECRUITEE_COMPANY_ID + RECRUITEE_API_TOKEN)
3. Remotive             — email submission to jobs@remotive.com
4. We Work Remotely     — email submission to eds@weworkremotely.com

All channels run concurrently via asyncio.gather for a fast chatbot response.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Optional

import httpx

from backend.config import settings

logger = logging.getLogger(__name__)


# ── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class PostResult:
    platform: str
    success: bool
    url: Optional[str] = None
    note: str = ""
    icon: str = "📋"


@dataclass
class PostingReport:
    results: list = field(default_factory=list)

    @property
    def any_success(self) -> bool:
        return any(r.success for r in self.results)

    def to_chat_message(self) -> str:
        """Format the posting report as a chatbot-friendly markdown message."""
        lines = ["**📢 JD Posting Results:**\n"]
        for r in self.results:
            if r.success:
                link = f" → [View listing]({r.url})" if r.url else ""
                lines.append(f"- {r.icon} **{r.platform}**: ✅ Posted{link}")
            else:
                lines.append(f"- {r.icon} **{r.platform}**: ⚠️ {r.note}")
        return "\n".join(lines)


# ── Platform description shown to user BEFORE posting ─────────────────────────

PLATFORMS_DESCRIPTION = (
    "Here's where I'll post this JD:\n\n"
    "| # | Platform | Method |\n"
    "|---|----------|--------|\n"
    "| 1 | 🏢 **Internal Job Board** | Saved to your company's job database |\n"
    "| 2 | 🟣 **Recruitee** | REST API — creates a live job offer on your Recruitee career page |\n"
    "| 3 | 🟠 **Remotive** | Email submission — sent to jobs@remotive.com for editorial review |\n"
    "| 4 | 🔵 **We Work Remotely** | Email submission — sent to eds@weworkremotely.com for review |\n\n"
    "> **Note:** Recruitee requires an API token in your `.env`. "
    "Remotive and We Work Remotely are free to submit but reviewed by their team (1–2 business days).\n\n"
    "Type **'yes, post it'** to confirm, or **'skip posting'** to start the hiring workflow without external posting."
)


# ── Individual platform handlers ──────────────────────────────────────────────

async def _post_to_internal_board(session: dict) -> PostResult:
    """Already persisted to DB when workflow is triggered — just return the URL."""
    job_id = session.get("db_job_id", "")
    url = f"http://localhost:5173/jobs/{job_id}" if job_id else "http://localhost:5173/jobs"
    return PostResult(
        platform="Internal Job Board",
        success=True,
        url=url,
        note="Already saved to your company database.",
        icon="🏢",
    )


async def _post_to_recruitee(jd_content: str, job_title: str, location: str) -> PostResult:
    """
    Post a job to Recruitee via their ATS API.
    Docs: https://docs.recruitee.com/reference/createoffer
    Requires: RECRUITEE_COMPANY_ID and RECRUITEE_API_TOKEN in .env
    """
    company_id = getattr(settings, "RECRUITEE_COMPANY_ID", "")
    api_token  = getattr(settings, "RECRUITEE_API_TOKEN", "")

    if not company_id or not api_token:
        return PostResult(
            platform="Recruitee",
            success=False,
            note="Not configured — add RECRUITEE_COMPANY_ID and RECRUITEE_API_TOKEN to .env",
            icon="🟣",
        )

    url = f"https://api.recruitee.com/c/{company_id}/offers"
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json",
    }
    payload = {
        "offer": {
            "title": job_title,
            "location": location or "Remote",
            "description": jd_content,
            "kind": "job",
            "remote": "remote" in location.lower(),
        }
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, json=payload, headers=headers)

        if resp.status_code in (200, 201):
            data = resp.json()
            offer_id = data.get("offer", {}).get("id", "")
            slug     = data.get("offer", {}).get("slug", "")
            board_url = (
                f"https://{company_id}.recruitee.com/o/{slug}-{offer_id}"
                if offer_id else ""
            )
            return PostResult(
                platform="Recruitee",
                success=True,
                url=board_url or None,
                note="Live on your Recruitee career page.",
                icon="🟣",
            )
        else:
            logger.warning(f"[Recruitee] API error {resp.status_code}: {resp.text[:200]}")
            return PostResult(
                platform="Recruitee",
                success=False,
                note=f"API returned {resp.status_code} — check your credentials.",
                icon="🟣",
            )
    except Exception as e:
        logger.error(f"[Recruitee] Exception: {e}")
        return PostResult(
            platform="Recruitee",
            success=False,
            note=f"Connection error: {str(e)[:100]}",
            icon="🟣",
        )


async def _post_via_email(
    platform_name: str,
    recipient_email: str,
    icon: str,
    job_title: str,
    jd_content: str,
    sender_email: str,
) -> PostResult:
    """
    Submit a JD by emailing a job board's editorial address.
    Used for: Remotive, We Work Remotely.
    """
    try:
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText

        subject = f"[Job Submission] {job_title}"

        html_lines = []
        for line in jd_content.split("\n"):
            stripped = line.strip()
            if stripped.startswith("## "):
                html_lines.append(f"<h2>{stripped[3:]}</h2>")
            elif stripped.startswith("# "):
                html_lines.append(f"<h1>{stripped[2:]}</h1>")
            elif stripped.startswith("- "):
                html_lines.append(f"<li>{stripped[2:]}</li>")
            elif stripped:
                html_lines.append(f"<p>{stripped}</p>")
            else:
                html_lines.append("<br/>")

        html_body = (
            f"<html><body>"
            f"<p>Hi {platform_name} team,</p>"
            f"<p>Please find our job listing below for review and publication:</p>"
            f"<hr/>{''.join(html_lines)}<hr/>"
            f"<p>Best regards,<br/>AI Hiring Platform</p>"
            f"</body></html>"
        )

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = sender_email
        msg["To"]      = recipient_email
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT) as smtp:
            if settings.MAIL_STARTTLS:
                smtp.starttls()
            smtp.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
            smtp.sendmail(sender_email, recipient_email, msg.as_string())

        logger.info(f"[{platform_name}] Email submitted to {recipient_email}")
        return PostResult(
            platform=platform_name,
            success=True,
            url=None,
            note="Email submitted for editorial review (1–2 business days to go live).",
            icon=icon,
        )
    except Exception as e:
        logger.error(f"[{platform_name}] Email error: {e}")
        return PostResult(
            platform=platform_name,
            success=False,
            note=f"Email failed: {str(e)[:120]}",
            icon=icon,
        )


# ── Main entry point ──────────────────────────────────────────────────────────

async def post_jd_to_all_platforms(session: dict) -> PostingReport:
    """
    Post the approved JD from a chat session to all configured platforms.
    Runs all platforms concurrently and returns a PostingReport.

    Args:
        session: Chatbot session dict (must contain jd_content and hiring_request)

    Returns:
        PostingReport with one PostResult per platform attempted
    """
    jd_content = session.get("jd_content", "")
    hr         = session.get("hiring_request", {})
    job_title  = hr.get("job_title", "Open Position")
    location   = hr.get("location", "Remote")
    sender     = settings.MAIL_FROM

    mock_mode = getattr(settings, "JOB_POSTING_MOCK_MODE", True)

    if mock_mode:
        logger.info("[JobPosting] MOCK MODE — simulating all postings")
        return PostingReport(results=[
            PostResult(
                "Internal Job Board", True,
                "http://localhost:5173/jobs",
                "Saved to your company database.", "🏢"
            ),
            PostResult(
                "Recruitee", True,
                "https://careers.recruitee.com/o/sample-role",
                "Mock post — add real credentials to go live.", "🟣"
            ),
            PostResult(
                "Remotive", True, None,
                "Mock — email submission would be sent in production.", "🟠"
            ),
            PostResult(
                "We Work Remotely", True, None,
                "Mock — email submission would be sent in production.", "🔵"
            ),
        ])

    tasks = [
        _post_to_internal_board(session),
        _post_to_recruitee(jd_content, job_title, location),
        _post_via_email(
            platform_name="Remotive",
            recipient_email="jobs@remotive.com",
            icon="🟠",
            job_title=job_title,
            jd_content=jd_content,
            sender_email=sender,
        ),
        _post_via_email(
            platform_name="We Work Remotely",
            recipient_email="eds@weworkremotely.com",
            icon="🔵",
            job_title=job_title,
            jd_content=jd_content,
            sender_email=sender,
        ),
    ]

    raw = await asyncio.gather(*tasks, return_exceptions=True)

    platform_names = ["Internal Job Board", "Recruitee", "Remotive", "We Work Remotely"]
    icons          = ["🏢", "🟣", "🟠", "🔵"]
    clean: list[PostResult] = []
    for i, res in enumerate(raw):
        if isinstance(res, Exception):
            clean.append(PostResult(
                platform=platform_names[i],
                success=False,
                note=f"Unexpected error: {str(res)[:100]}",
                icon=icons[i],
            ))
        else:
            clean.append(res)

    report = PostingReport(results=clean)
    successes = sum(1 for r in clean if r.success)
    logger.info(f"[JobPosting] Complete — {successes}/{len(clean)} platforms succeeded.")
    return report
