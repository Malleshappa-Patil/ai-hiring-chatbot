"""
CV Screening Service.

Uses Gemini to score a candidate's resume against the approved Job Description.
- Score >= CV_MATCH_THRESHOLD (default 70%) -> shortlisted
- Score <  threshold             -> auto-rejected (email sent)
- Shortlisted count == target_candidate_count -> job marked not_hiring
"""
import asyncio
import json
import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

logger = logging.getLogger(__name__)


# -- Public entry point -------------------------------------------------------

async def run_screening_for_candidate(
    candidate_id: str,
    resume_file_path: Optional[str],
) -> None:
    """
    Background task. Opens its own DB session so it can safely run after
    the HTTP request that created the candidate has already closed.
    """
    from backend.database.session import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        try:
            await _screen(db, candidate_id, resume_file_path)
        except Exception as e:
            logger.error(f"[Screening] Unhandled error for candidate {candidate_id}: {e}")
            import traceback; traceback.print_exc()


# -- Core Screening Logic -----------------------------------------------------

async def _screen(
    db: AsyncSession,
    candidate_id: str,
    resume_file_path: Optional[str],
) -> None:
    from backend.database.models import Candidate, CandidateScore, Job, JobDescription
    from backend.config import settings
    from backend.services.resume_parser import parse_resume
    from backend.services.notification_service import email_service

    # 1. Load candidate
    result = await db.execute(select(Candidate).where(Candidate.id == candidate_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        logger.warning(f"[Screening] Candidate {candidate_id} not found")
        return

    # 2. Load the approved JD for this job (latest version first)
    jd_result = await db.execute(
        select(JobDescription)
        .where(JobDescription.job_id == candidate.job_id)
        .where(JobDescription.status == "approved")
        .order_by(desc(JobDescription.version))
    )
    jd = jd_result.scalar_one_or_none()

    # Fall back to latest draft if no approved JD yet
    if not jd:
        jd_result = await db.execute(
            select(JobDescription)
            .where(JobDescription.job_id == candidate.job_id)
            .order_by(desc(JobDescription.version))
        )
        jd = jd_result.scalar_one_or_none()

    # 3. Load the job
    job_result = await db.execute(select(Job).where(Job.id == candidate.job_id))
    job = job_result.scalar_one_or_none()
    seat_limit = job.target_candidate_count if (job and job.target_candidate_count) else 5

    # 4. Check if seats are already full BEFORE scoring
    shortlisted_count = await _count_shortlisted(db, candidate.job_id)
    if shortlisted_count >= seat_limit:
        logger.info(f"[Screening] Seats full for job {candidate.job_id} -- rejecting {candidate.email}")
        candidate.status = "rejected"
        await db.commit()
        await email_service.send_candidate_rejection(
            candidate_email=candidate.email,
            candidate_name=candidate.name,
            job_title=job.title if job else "this position",
        )
        if job:
            await _maybe_mark_not_hiring(db, job, seat_limit)
        return

    # 5. If no JD exists pass the candidate through without scoring
    if not jd:
        logger.warning(f"[Screening] No JD found for job {candidate.job_id} -- skipping score, marking shortlisted")
        candidate.status = "shortlisted"
        await db.commit()
        return

    # 6. Parse the resume
    cv_text = ""
    if resume_file_path:
        try:
            cv_text = parse_resume(resume_file_path)
        except Exception as e:
            logger.warning(f"[Screening] Resume parse failed: {e}")

    # 7. Score via Gemini
    scoring = await _score_with_gemini(
        cv_text=cv_text,
        jd_text=jd.content,
        job_title=job.title if job else "the role",
    )
    score_val   = scoring.get("score", 0.0)
    category    = scoring.get("category", "weak_match")
    explanation = scoring.get("explanation", "")
    matched     = scoring.get("skills_matched", [])
    missing     = scoring.get("skills_missing", [])

    logger.info(
        f"[Screening] {candidate.name} ({candidate.email}) -> "
        f"score={score_val}% category={category}"
    )

    # 8. Save CandidateScore (replace if re-screening)
    old_score_result = await db.execute(
        select(CandidateScore).where(CandidateScore.candidate_id == candidate_id)
    )
    old = old_score_result.scalar_one_or_none()
    if old:
        await db.delete(old)

    cs = CandidateScore(
        candidate_id=candidate_id,
        job_id=candidate.job_id,
        score=score_val,
        category=category,
        explanation=explanation,
        skills_matched=matched,
        skills_missing=missing,
    )
    db.add(cs)

    threshold = settings.CV_MATCH_THRESHOLD

    # 9. Decide outcome
    if score_val >= threshold:
        candidate.status = "shortlisted"
        await db.commit()
        logger.info(f"[Screening] Shortlisted: {candidate.name} (score={score_val}%)")

        # Re-check seat limit after shortlisting
        new_count = await _count_shortlisted(db, candidate.job_id)
        if job and new_count >= seat_limit:
            await _maybe_mark_not_hiring(db, job, seat_limit)
    else:
        candidate.status = "rejected"
        await db.commit()
        logger.info(f"[Screening] Auto-rejected: {candidate.name} (score={score_val}% < {threshold}%)")
        await email_service.send_candidate_rejection(
            candidate_email=candidate.email,
            candidate_name=candidate.name,
            job_title=job.title if job else "this position",
        )


async def _count_shortlisted(db: AsyncSession, job_id: str) -> int:
    """Count candidates in shortlisted-or-beyond status for a job."""
    from backend.database.models import Candidate
    PASSED_STATUSES = ["shortlisted", "interview_scheduled", "interviewed", "selected", "onboarding"]
    result = await db.execute(
        select(func.count())
        .select_from(Candidate)
        .where(Candidate.job_id == job_id)
        .where(Candidate.status.in_(PASSED_STATUSES))
    )
    return result.scalar() or 0


async def _maybe_mark_not_hiring(db: AsyncSession, job, seat_limit: int) -> None:
    """Mark job as not_hiring when all positions are filled."""
    if job.status not in ("not_hiring", "closed"):
        job.status = "not_hiring"
        await db.commit()
        logger.info(
            f"[Screening] Job '{job.title}' seats filled ({seat_limit}/{seat_limit}) -> not_hiring"
        )


# -- Gemini Scoring -----------------------------------------------------------

async def _score_with_gemini(cv_text: str, jd_text: str, job_title: str) -> dict:
    """
    Call Gemini to score a CV against a JD.
    Returns: {score, category, explanation, skills_matched, skills_missing}
    Falls back to a safe default if the call fails.
    """
    from backend.config import settings

    cv_snippet = cv_text[:6000]  if cv_text  else "(no resume text available)"
    jd_snippet = jd_text[:4000]  if jd_text  else "(no job description available)"

    prompt = f"""You are an expert AI hiring assistant. Evaluate how well the candidate's resume
matches the job description below. Be objective, specific, and fair.

## Job Description for: {job_title}
{jd_snippet}

## Candidate Resume
{cv_snippet}

Return ONLY a valid JSON object (no markdown, no explanation outside the JSON) with this exact schema:
{{
  "score": <float 0-100, overall match percentage>,
  "category": "<one of: strong_match | partial_match | weak_match>",
  "explanation": "<2-3 sentence summary of how well the candidate fits>",
  "skills_matched": [<list of specific technical skills from JD that the candidate has>],
  "skills_missing": [<list of specific technical skills from JD that the candidate lacks>]
}}

Rules:
- strong_match : score >= 75
- partial_match: score >= 50 and < 75
- weak_match   : score < 50
- Base the score strictly on alignment between resume and JD requirements
- List only concrete technical skills, not generic soft skills
"""

    raw = ""
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.messages import HumanMessage

        llm = ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL,
            temperature=0.1,
            google_api_key=settings.GOOGLE_API_KEY,
        )
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: llm.invoke([HumanMessage(content=prompt)])
        )
        raw = response.content.strip()

        # Strip markdown code fences if present
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else raw
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        parsed = json.loads(raw)
        parsed["score"] = max(0.0, min(100.0, float(parsed.get("score", 0))))
        valid_cats = {"strong_match", "partial_match", "weak_match"}
        if parsed.get("category") not in valid_cats:
            s = parsed["score"]
            parsed["category"] = "strong_match" if s >= 75 else "partial_match" if s >= 50 else "weak_match"

        return parsed

    except json.JSONDecodeError as e:
        logger.error(f"[Screening] Gemini returned invalid JSON: {e}\nRaw: {raw[:500]}")
        return _fallback_score()
    except Exception as e:
        logger.error(f"[Screening] Gemini scoring failed: {e}")
        return _fallback_score()


def _fallback_score() -> dict:
    """Return a neutral score when Gemini is unavailable."""
    return {
        "score": 0.0,
        "category": "weak_match",
        "explanation": "Automated scoring was unavailable. Please review this candidate manually.",
        "skills_matched": [],
        "skills_missing": [],
    }
