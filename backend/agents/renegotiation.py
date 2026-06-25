"""
Renegotiation Agent — Step 17 from agentic-workflow.md.
Handles salary and benefits negotiation for candidates who didn't accept initially.

Actions:
- Salary Negotiation
- Benefits Negotiation
- Final decision: Accept or Close
"""
import random
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage
from backend.config import settings
from backend.workflows.state import HiringState

llm = ChatGoogleGenerativeAI(
    model=settings.GEMINI_MODEL,
    temperature=0.3,
    google_api_key=settings.GOOGLE_API_KEY
)

NEGOTIATION_PROMPT = """You are an experienced HR negotiation specialist.

A candidate is in negotiations for the following role:
Position: {job_title}
Original Offer: {budget}
Negotiation Round: {round_number}

Candidate: {candidate_name}
Candidate's Concerns/Counter-offer: {concerns}

Draft a negotiation response that:
1. Acknowledges their concerns respectfully
2. Offers an improved package (within 15% of original budget)
3. Highlights non-monetary benefits (flexibility, growth, perks)
4. Creates urgency without pressure
5. Sets a clear final deadline

Keep it professional and persuasive (150-200 words).
"""


def renegotiation_node(state: HiringState) -> dict:
    """
    Renegotiation Agent — Step 17 from agentic-workflow.md.
    Attempts salary/benefits negotiation with candidates.
    """
    offer_status = state.get("offer_status", {})
    offer_letters = state.get("offer_letters", {})
    negotiation_rounds = state.get("negotiation_rounds", {})
    selected_candidates = state.get("selected_candidates", [])
    hiring_req = state.get("hiring_request", {})
    job_title = hiring_req.get("job_title", "Position")
    budget = hiring_req.get("budget", "Competitive")

    # Find candidates who are renegotiating
    negotiating_candidates = {
        cid: status for cid, status in offer_status.items()
        if status == "renegotiating"
    }

    print(f"[Renegotiation Agent] Processing {len(negotiating_candidates)} candidates in negotiation...")

    updated_status = {}
    updated_rounds = {}
    negotiation_responses = {}

    for candidate_id, _ in negotiating_candidates.items():
        # Find candidate details
        candidate = next((c for c in selected_candidates if c.get("id") == candidate_id), {})
        candidate_name = candidate.get("name", "Candidate")
        current_round = negotiation_rounds.get(candidate_id, 0) + 1

        print(f"  🤝 Negotiating with {candidate_name} (Round {current_round})...")

        MAX_ROUNDS = 2
        if current_round > MAX_ROUNDS:
            # Close the process after max rounds
            final_decision = random.choices(
                ["accepted", "rejected"],
                weights=[0.5, 0.5]
            )[0]
            print(f"    Max rounds reached → {final_decision.upper()}")
            updated_status[candidate_id] = final_decision
            updated_rounds[candidate_id] = current_round
            continue

        # Generate negotiation response
        try:
            concerns = random.choice([
                "The salary is below market rate",
                "Needs more remote work flexibility",
                "Wants additional stock options/equity",
                "Requesting better health benefits",
                "Asking for signing bonus",
            ])
            prompt = NEGOTIATION_PROMPT.format(
                job_title=job_title,
                budget=budget,
                round_number=current_round,
                candidate_name=candidate_name,
                concerns=concerns,
            )
            response = llm.invoke([SystemMessage(content=prompt)])
            negotiation_content = response.content.strip()
        except Exception as e:
            negotiation_content = f"Dear {candidate_name}, we appreciate your counter-proposal and are working on a revised offer."

        # Mock: candidate responds to negotiation
        response_outcome = random.choices(
            ["accepted", "renegotiating"],
            weights=[0.70, 0.30]
        )[0]

        if current_round >= MAX_ROUNDS:
            response_outcome = random.choices(["accepted", "rejected"], weights=[0.55, 0.45])[0]

        updated_status[candidate_id] = response_outcome
        updated_rounds[candidate_id] = current_round
        negotiation_responses[candidate_id] = {
            "round": current_round,
            "response_sent": negotiation_content[:300] + "...",
            "candidate_response": response_outcome,
        }
        print(f"    {candidate_name}: {response_outcome.upper()} after round {current_round}")

    # Merge updates
    final_offer_status = {**offer_status, **updated_status}
    final_rounds = {**negotiation_rounds, **updated_rounds}

    # Check if any still renegotiating
    still_negotiating = any(v == "renegotiating" for v in final_offer_status.values())
    
    # Determine accepted candidates for onboarding
    accepted_ids = [cid for cid, status in final_offer_status.items() if status == "accepted"]
    accepted_candidates = [c for c in selected_candidates if c.get("id") in accepted_ids]

    if still_negotiating:
        next_action = "renegotiation"  # Another round
    elif accepted_candidates:
        next_action = "onboarding"
    else:
        next_action = "end"  # All rejected after negotiation

    return {
        "offer_status": updated_status,
        "negotiation_rounds": updated_rounds,
        "data": {
            "negotiation_responses": negotiation_responses,
            "accepted_candidates": accepted_candidates,
        },
        "agent_statuses": {"renegotiation": "completed"},
        "next_action": next_action,
    }
