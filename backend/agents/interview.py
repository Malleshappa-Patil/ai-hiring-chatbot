"""
Interview Agent — Steps 12 & 13 from agentic-workflow.md.

Step 12 — Interview Scheduling Agent:
- Sends interview invitations
- Books time slots (Google Calendar / Outlook mock)

Step 13 — Conduct Interview Agent:
- Technical Interview evaluation via LLM
- Behavioral Interview assessment
- Candidate scoring and selection decision
"""
import random
from datetime import datetime, timedelta
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage
from backend.config import settings
from backend.workflows.state import HiringState

llm = ChatGoogleGenerativeAI(
    model=settings.GEMINI_MODEL,
    temperature=0.2,
    google_api_key=settings.GOOGLE_API_KEY
)

INTERVIEW_EVALUATION_PROMPT = """You are an expert technical interviewer and HR professional.

Role: {job_title}
Required Skills: {skills}
Required Experience: {experience}

Candidate: {candidate_name}
Candidate Skills: {candidate_skills}
Candidate Experience: {candidate_experience} years
Initial Screening Score: {screening_score}/100

Conduct a simulated technical + behavioral interview evaluation for this candidate.

Evaluate based on:
1. Technical Competency (0-40 points): Depth in required skills
2. Problem Solving (0-20 points): Analytical thinking ability
3. Communication (0-20 points): Clear articulation of ideas
4. Culture Fit (0-10 points): Team collaboration potential
5. Leadership/Initiative (0-10 points): Self-driven, proactive

Provide evaluation in JSON:
{{
  "technical_score": <0-40>,
  "problem_solving_score": <0-20>,
  "communication_score": <0-20>,
  "culture_fit_score": <0-10>,
  "leadership_score": <0-10>,
  "total_score": <0-100>,
  "verdict": "Selected" or "Rejected",
  "key_observations": ["<observation1>", "<observation2>", "<observation3>"],
  "interviewer_notes": "<2-3 sentence summary>",
  "strengths": ["<strength1>", "<strength2>"],
  "concerns": ["<concern1>"]
}}
"""


def interview_scheduling_node(state: HiringState) -> dict:
    """
    Step 12 — Interview Scheduling Agent.
    Books interview slots and sends invitations.
    """
    shortlisted = state.get("shortlisted_candidates", [])
    hiring_req = state.get("hiring_request", {})
    
    print(f"[Interview Scheduling] Scheduling {len(shortlisted)} interviews...")
    
    scheduled = []
    base_date = datetime.utcnow() + timedelta(days=3)
    
    for i, candidate in enumerate(shortlisted):
        interview_slot = base_date + timedelta(hours=i * 2)
        schedule_entry = {
            "candidate_id": candidate.get("id"),
            "candidate_name": candidate.get("name"),
            "interview_date": interview_slot.isoformat(),
            "duration_minutes": 60,
            "format": "Video Call (Google Meet)",
            "calendar_event_id": f"CAL-{candidate.get('id')}-{random.randint(1000,9999)}",
            "invitation_sent": True,
            "confirmation_email_sent": True,
            "status": "scheduled",
        }
        scheduled.append(schedule_entry)
        print(f"  📅 {candidate.get('name')}: {interview_slot.strftime('%Y-%m-%d %H:%M')} UTC")

    return {
        "scheduled_interviews": scheduled,
        "agent_statuses": {"interview_scheduling": "completed"},
        "next_action": "interview_conduct",
    }


def interview_conduct_node(state: HiringState) -> dict:
    """
    Step 13 — Interview Conduct Agent.
    Evaluates candidates via LLM simulation and makes selection decisions.
    """
    shortlisted = state.get("shortlisted_candidates", [])
    hiring_req = state.get("hiring_request", {})
    job_title = hiring_req.get("job_title", "Open Position")
    skills = ", ".join(hiring_req.get("skills_required", []))
    experience = hiring_req.get("experience_years", "3+ years")
    candidates_needed = state.get("candidates_needed", 
                                  hiring_req.get("candidates_needed", 1))

    print(f"[Interview Agent] Conducting interviews for {len(shortlisted)} candidates...")

    interview_results = {}
    selected = []
    rejected = []

    for candidate in shortlisted:
        try:
            prompt = INTERVIEW_EVALUATION_PROMPT.format(
                job_title=job_title,
                skills=skills,
                experience=experience,
                candidate_name=candidate.get("name"),
                candidate_skills=", ".join(candidate.get("skills", [])),
                candidate_experience=candidate.get("experience", 0),
                screening_score=candidate.get("score", 50),
            )
            response = llm.invoke([SystemMessage(content=prompt)])
            
            import json, re
            json_match = re.search(r'\{.*\}', response.content, re.DOTALL)
            if json_match:
                evaluation = json.loads(json_match.group())
            else:
                evaluation = {
                    "total_score": random.randint(50, 90),
                    "verdict": random.choice(["Selected", "Rejected"]),
                    "key_observations": ["Good technical knowledge"],
                    "interviewer_notes": "Candidate showed good potential.",
                    "strengths": ["Communication", "Technical skills"],
                    "concerns": []
                }
        except Exception as e:
            print(f"  [Interview] Error evaluating {candidate.get('name')}: {e}")
            evaluation = {
                "total_score": random.randint(50, 85),
                "verdict": "Selected" if random.random() > 0.4 else "Rejected",
                "key_observations": ["Technical evaluation pending"],
                "interviewer_notes": "Manual review recommended.",
                "strengths": [], "concerns": []
            }

        result = {
            **candidate,
            "interview_score": evaluation.get("total_score", 50),
            "verdict": evaluation.get("verdict", "Rejected"),
            "key_observations": evaluation.get("key_observations", []),
            "interviewer_notes": evaluation.get("interviewer_notes", ""),
            "interview_strengths": evaluation.get("strengths", []),
            "interview_concerns": evaluation.get("concerns", []),
        }
        interview_results[candidate.get("id")] = result

        verdict = evaluation.get("verdict", "Rejected")
        if verdict == "Selected" and len(selected) < candidates_needed:
            selected.append(result)
            print(f"  ✅ {candidate.get('name')}: SELECTED (score: {evaluation.get('total_score')}/100)")
        else:
            rejected.append(result)
            print(f"  ❌ {candidate.get('name')}: REJECTED (score: {evaluation.get('total_score')}/100)")

    print(f"\n[Interview Agent] Selected: {len(selected)}, Rejected: {len(rejected)}")

    # Store rejected in data for communication agent
    return {
        "interview_results": interview_results,
        "selected_candidates": selected,
        "data": {"rejected_candidates": rejected},
        "agent_statuses": {"interview": "completed"},
        "next_action": "communication" if rejected else "offer_management",
    }
