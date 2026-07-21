"""
Google Meet Service.

Generates interview meeting links.
- When GOOGLE_MEET_API_KEY is set: creates a real Google Calendar event with Meet link
- When not set: returns a well-formatted placeholder URL

To enable real Meet links later:
1. Create a Google Cloud project and enable the Google Calendar API
2. Create a Service Account and download the JSON key file
3. Set GOOGLE_MEET_SERVICE_ACCOUNT_FILE in config.py or .env
4. Share your Google Calendar with the service account email
"""
import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)


async def create_meeting(
    candidate_name: str,
    job_title: str,
    scheduled_at: datetime,
    duration_minutes: int = 60,
    interviewer: str = "Hiring Team",
) -> str:
    """
    Generate a Google Meet interview link.

    Returns a real Meet URL if configured, otherwise a placeholder.
    """
    from backend.config import settings

    if settings.GOOGLE_MEET_SERVICE_ACCOUNT_FILE:
        try:
            return await _create_real_meet(
                candidate_name=candidate_name,
                job_title=job_title,
                scheduled_at=scheduled_at,
                duration_minutes=duration_minutes,
                interviewer=interviewer,
                calendar_id=settings.GOOGLE_MEET_CALENDAR_ID,
                service_account_file=settings.GOOGLE_MEET_SERVICE_ACCOUNT_FILE,
            )
        except Exception as e:
            logger.warning(f"[Meet] Real Meet creation failed, using placeholder: {e}")

    # Placeholder — a unique, human-readable URL per interview
    meeting_code = uuid.uuid4().hex[:10]
    logger.info(f"[Meet] Using placeholder Meet link for {candidate_name}")
    return f"https://meet.google.com/{meeting_code[:3]}-{meeting_code[3:7]}-{meeting_code[7:]}"


async def _create_real_meet(
    candidate_name: str,
    job_title: str,
    scheduled_at: datetime,
    duration_minutes: int,
    interviewer: str,
    calendar_id: str,
    service_account_file: str,
) -> str:
    """
    Create a real Google Calendar event with a Meet conference link.
    Requires google-auth and google-api-python-client packages.
    """
    import asyncio
    from functools import partial

    def _sync_create():
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        SCOPES = ["https://www.googleapis.com/auth/calendar"]
        credentials = service_account.Credentials.from_service_account_file(
            service_account_file, scopes=SCOPES
        )
        service = build("calendar", "v3", credentials=credentials)

        end_time = scheduled_at + timedelta(minutes=duration_minutes)

        event = {
            "summary": f"Interview: {candidate_name} — {job_title}",
            "description": f"Interview for {job_title} position.\nCandidate: {candidate_name}\nInterviewer: {interviewer}",
            "start": {
                "dateTime": scheduled_at.isoformat(),
                "timeZone": "Asia/Kolkata",
            },
            "end": {
                "dateTime": end_time.isoformat(),
                "timeZone": "Asia/Kolkata",
            },
            "conferenceData": {
                "createRequest": {
                    "requestId": str(uuid.uuid4()),
                    "conferenceSolutionKey": {"type": "hangoutsMeet"},
                }
            },
            "attendees": [],
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "email", "minutes": 60},
                    {"method": "popup", "minutes": 10},
                ],
            },
        }

        created = service.events().insert(
            calendarId=calendar_id,
            body=event,
            conferenceDataVersion=1,
        ).execute()

        meet_link = created.get("hangoutLink", "")
        if not meet_link:
            # Try to get from conferenceData
            conf = created.get("conferenceData", {})
            for ep in conf.get("entryPoints", []):
                if ep.get("entryPointType") == "video":
                    meet_link = ep.get("uri", "")
                    break

        logger.info(f"[Meet] Created real Meet event: {created.get('id')} -> {meet_link}")
        return meet_link

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _sync_create)
