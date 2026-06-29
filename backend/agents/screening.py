"""
Resume Screening Agent — Step 11 from agentic-workflow.md.
Parses resumes, compares against JD, ranks and shortlists candidates.

Tools:
- Resume Parser (mock)
- ATS Scoring Engine (LLM-based)
- Vector Database (ChromaDB via RAG)
"""
import random
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage
from backend.config import settings
from backend.workflows.state import HiringState

llm = ChatGoogleGenerativeAI(
    model=settings.GEMINI_MODEL,
    temperature=0.1,
    google_api_key=settings.GOOGLE_API_KEY
)

SCREENING_PROMPT = """You are an expert ATS (Applicant Tracking System) and technical recruiter.

Job Description:
{jd_content}

Required Skills: {skills}
Experience Required: {experience}

Candidate Profile:
Name: {candidate_name}
Skills: {candidate_skills}
Experience: {candidate_experience} years
Education: {candidate_education}
Previous Roles: {candidate_roles}

Evaluate this candidate against the JD and provide:
1. Match Score (0-100)
2. Match Category: "Strong Match" / "Partial Match" / "Weak Match"
3. Key Strengths (bullet points)
4. Gaps (bullet points)
5. Recommendation (1-2 sentences)

Respond in JSON format:
{{
  "score": <number>,
  "category": "<category>",
  "strengths": ["<strength1>", "<strength2>"],
  "gaps": ["<gap1>", "<gap2>"],
  "recommendation": "<text>"
}}
"""

# Mock candidate database (in real app, these come from applications/DB)
MOCK_CANDIDATES = [
    {"id": f"CAND-{i:04d}", "name": f"Candidate {i}", 
     "skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "AWS"][:random.randint(2,5)],
     "experience": random.randint(1, 10),
     "education": random.choice(["B.Tech CS", "M.Tech CS", "BCA", "MCA", "B.Sc IT"]),
     "roles": random.choice(["Backend Developer", "Full Stack Engineer", "Software Engineer", "DevOps Engineer"])}
    for i in range(1, 21)  # 20 mock candidates
]


def screening_node(state: HiringState) -> dict:
    """
    Resume Screening Agent — Step 11 from agentic-workflow.md.
    Shortlists candidates based on JD match score.
    """
    jd_content = state.get("jd_content", "")
    hiring_req = state.get("hiring_request", {})
    skills = ", ".join(hiring_req.get("skills_required", []))
    experience = hiring_req.get("experience_years", "3+ years")
    candidates_needed = state.get("candidates_needed", 
                                  hiring_req.get("candidates_needed", 1))
    application_count = state.get("application_count", 0)
    
    # Use available candidates (capped at application_count)
    pool = MOCK_CANDIDATES[:min(application_count, len(MOCK_CANDIDATES))]
    if not pool:
        pool = MOCK_CANDIDATES[:10]  # fallback

    print(f"[Screening Agent] Evaluating {len(pool)} candidates for '{hiring_req.get('job_title', 'role')}'...")
    
    shortlisted = []
    rankings = {}

    for candidate in pool:
        try:
            prompt = SCREENING_PROMPT.format(
                jd_content=jd_content[:2000],  # Truncate for token limits
                skills=skills,
                experience=experience,
                candidate_name=candidate["name"],
                candidate_skills=", ".join(candidate["skills"]),
                candidate_experience=candidate["experience"],
                candidate_education=candidate["education"],
                candidate_roles=candidate["roles"],
            )
            response = llm.invoke(prompt)
            
            import json, re
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', response.content, re.DOTALL)
            if json_match:
                evaluation = json.loads(json_match.group())
            else:
                evaluation = {"score": 50, "category": "Partial Match", 
                             "strengths": [], "gaps": [], "recommendation": "Manual review needed"}
        except Exception as e:
            print(f"  [Screening] Error evaluating {candidate['name']}: {e}")
            evaluation = {"score": random.randint(40, 80), "category": "Partial Match",
                         "strengths": ["Technical background"], "gaps": [], 
                         "recommendation": "Requires manual review"}

        candidate_result = {
            **candidate,
            "score": evaluation.get("score", 50),
            "category": evaluation.get("category", "Partial Match"),
            "strengths": evaluation.get("strengths", []),
            "gaps": evaluation.get("gaps", []),
            "recommendation": evaluation.get("recommendation", ""),
        }
        rankings[candidate["id"]] = evaluation.get("score", 50)
        
        # Shortlist: Strong Match + top Partial Matches
        if evaluation.get("category") in ["Strong Match", "Partial Match"] and evaluation.get("score", 0) >= 60:
            shortlisted.append(candidate_result)
            print(f"  ✅ {candidate['name']}: {evaluation.get('score')}/100 — {evaluation.get('category')}")
        else:
            print(f"  ❌ {candidate['name']}: {evaluation.get('score')}/100 — {evaluation.get('category')} (filtered)")

    # Sort by score, take top candidates_needed * 3 for interviews
    shortlisted.sort(key=lambda x: x.get("score", 0), reverse=True)
    interview_pool = shortlisted[:max(candidates_needed * 3, 5)]

    print(f"[Screening Agent] Shortlisted {len(interview_pool)} candidates for interviews.")

    return {
        "shortlisted_candidates": interview_pool,
        "candidate_rankings": rankings,
        "agent_statuses": {"screening": "completed"},
        "next_action": "interview_scheduling",
    }
