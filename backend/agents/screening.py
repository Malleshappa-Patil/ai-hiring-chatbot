"""
Resume Screening Agent — Step 11 from agentic-workflow.md.
Parses resumes, compares against JD, ranks and shortlists candidates.

Tools:
- Resume Parser (PyMuPDF / python-docx)
- ATS Scoring Engine (Gemini LLM)
- Vector Database (ChromaDB via RAG)
"""
import json
import re
import asyncio
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from backend.config import settings
from backend.workflows.state import HiringState

llm = ChatGoogleGenerativeAI(
    model=settings.GEMINI_MODEL,
    temperature=0.1,
    google_api_key=settings.GOOGLE_API_KEY
)

SCREENING_PROMPT = """You are an expert ATS (Applicant Tracking System) and senior technical recruiter.

## Job Description
{jd_content}

## Required Skills
{skills}

## Experience Required
{experience}

## Candidate Resume
{resume_text}

Evaluate how well this candidate's resume matches the job description above.
Be objective, specific, and base your score strictly on what is written in the resume.

Return ONLY a valid JSON object (no markdown, no extra text) with this exact schema:
{{
  "score": <float 0-100, overall ATS match percentage>,
  "category": "<one of: strong_match | partial_match | weak_match>",
  "skills_matched": [<list of specific technical skills from JD that the candidate has>],
  "skills_missing": [<list of specific technical skills from JD that the candidate lacks>],
  "explanation": "<2-3 sentence summary of how well the candidate fits>"
}}

Category rules:
- strong_match  : score >= 70
- partial_match : score >= 50 and < 70
- weak_match    : score < 50
"""


llm = ChatGoogleGenerativeAI(
    model=settings.GEMINI_MODEL,
    temperature=0.1,
    google_api_key=settings.GOOGLE_API_KEY
)


def _parse_gemini_json(raw: str) -> dict:
    """Strip markdown fences and parse JSON from Gemini response."""
    raw = raw.strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()
    return json.loads(raw)


def _normalize_category(category: str, score: float) -> str:
    """
    Normalize LLM-returned category to DB enum values.
    Handles: 'Strong Match', 'strong_match', 'STRONG MATCH', etc.
    Falls back to score-based assignment if unrecognised.
    """
    normalized = category.lower().replace(" ", "_").replace("-", "_")
    if "strong" in normalized:
        return "strong_match"
    if "partial" in normalized:
        return "partial_match"
    if "weak" in normalized:
        return "weak_match"
    # Score-based fallback
    if score >= 70:
        return "strong_match"
    if score >= 50:
        return "partial_match"
    return "weak_match"


def _score_candidate(jd_content: str, skills: str, experience: str,
                     resume_text: str) -> dict:
    """Call Gemini synchronously to score one candidate resume against the JD."""
    if not resume_text.strip():
        return {
            "score": 0.0,
            "category": "weak_match",
            "skills_matched": [],
            "skills_missing": [],
            "explanation": "No resume text available — cannot score this candidate.",
        }

    prompt = SCREENING_PROMPT.format(
        jd_content=jd_content[:4000],
        skills=skills,
        experience=experience,
        resume_text=resume_text[:6000],
    )
    try:
        response = llm.invoke([HumanMessage(content=prompt)])
        parsed = _parse_gemini_json(response.content)
        score = max(0.0, min(100.0, float(parsed.get("score", 0))))
        category = _normalize_category(parsed.get("category", ""), score)
        return {
            "score": score,
            "category": category,
            "skills_matched": parsed.get("skills_matched", []),
            "skills_missing": parsed.get("skills_missing", []),
            "explanation": parsed.get("explanation", ""),
        }
    except json.JSONDecodeError as e:
        print(f"  [Screening] JSON parse error: {e} | raw={response.content[:300]}")
        return {
            "score": 0.0,
            "category": "weak_match",
            "skills_matched": [],
            "skills_missing": [],
            "explanation": "Scoring failed (invalid response). Manual review required.",
        }
    except Exception as e:
        print(f"  [Screening] Gemini call failed: {e}")
        return {
            "score": 0.0,
            "category": "weak_match",
            "skills_matched": [],
            "skills_missing": [],
            "explanation": f"Scoring unavailable ({e}). Manual review required.",
        }


def screening_node(state: HiringState) -> dict:
    """
    Resume Screening Agent — Step 11 from agentic-workflow.md.
    Scores real candidates from the workflow state against the approved JD.
    Falls back to empty list if no real applicants are present yet.
    """
    jd_content = state.get("jd_content", "")
    hiring_req  = state.get("hiring_request", {})
    skills      = ", ".join(hiring_req.get("skills_required", []))
    experience  = hiring_req.get("experience_years", "3+ years")
    candidates_needed = state.get(
        "candidates_needed",
        hiring_req.get("candidates_needed", 1),
    )

    # Real candidates come from data["real_candidates"] — populated by
    # run_screening_for_candidate() via the HireBoard integration.
    data            = state.get("data", {})
    real_candidates = data.get("real_candidates", [])

    print(
        f"[Screening Agent] Evaluating {len(real_candidates)} real candidates "
        f"for '{hiring_req.get('job_title', 'role')}'..."
    )

    if not real_candidates:
        print("[Screening Agent] No real candidates in state yet — skipping scoring.")
        return {
            "shortlisted_candidates": [],
            "candidate_rankings":     {},
            "agent_statuses":         {"screening": "completed"},
            "next_action":            "interview_scheduling",
        }

    shortlisted = []
    rankings    = {}
    threshold   = settings.CV_MATCH_THRESHOLD  # default 70.0

    for candidate in real_candidates:
        cid         = candidate.get("id", "unknown")
        name        = candidate.get("name", "Unknown")
        resume_text = candidate.get("resume_text", "")

        evaluation = _score_candidate(jd_content, skills, experience, resume_text)
        score      = evaluation["score"]
        category   = evaluation["category"]

        rankings[cid] = score

        candidate_result = {
            **candidate,
            "score":          score,
            "category":       category,
            "skills_matched": evaluation["skills_matched"],
            "skills_missing": evaluation["skills_missing"],
            "explanation":    evaluation["explanation"],
        }

        if score >= threshold:
            shortlisted.append(candidate_result)
            print(f"  ✅ {name}: {score:.1f}/100 — {category}")
        else:
            print(f"  ❌ {name}: {score:.1f}/100 — {category} (below threshold {threshold})")

    # Sort by score descending; take top (candidates_needed * 3) for interviews
    shortlisted.sort(key=lambda x: x.get("score", 0), reverse=True)
    interview_pool = shortlisted[: max(candidates_needed * 3, 5)]

    print(f"[Screening Agent] Shortlisted {len(interview_pool)} candidates for interviews.")

    return {
        "shortlisted_candidates": interview_pool,
        "candidate_rankings":     rankings,
        "agent_statuses":         {"screening": "completed"},
        "next_action":            "interview_scheduling",
    }
