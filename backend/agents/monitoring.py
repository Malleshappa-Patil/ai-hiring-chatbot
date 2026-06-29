"""
Application Monitoring Agent — Steps 6, 9, 10 from agentic-workflow.md.
Monitors incoming applications and decides:
- If applications >= threshold → proceed to shortlisting
- If applications < threshold → trigger JD optimization + repost
"""
import random
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage
from backend.config import settings
from backend.workflows.state import HiringState

llm = ChatGoogleGenerativeAI(
    model=settings.GEMINI_MODEL,
    temperature=0.2,
    google_api_key=settings.GOOGLE_API_KEY
)

JD_OPTIMIZATION_PROMPT = """You are an expert recruiting consultant.
The following Job Description is not attracting enough candidates. 
Current application count: {current_count}
Target threshold: {threshold}

Original JD:
{jd_content}

Please improve this JD to attract more candidates by:
1. Adding relevant keywords for better searchability (SEO optimization)
2. Broadening skill requirements slightly (mark some as "nice to have" instead of required)
3. Making the role more attractive with better benefits/perks description
4. Improving the job title if needed (e.g., "Senior Engineer" → "Senior Software Engineer (Remote)")
5. Adding remote/hybrid work flexibility if not mentioned

Return the improved JD in clean Markdown format.
"""


def monitoring_node(state: HiringState) -> dict:
    """
    Application Monitoring Agent — Steps 6, 9, 10.
    Checks application count vs threshold.
    """
    hiring_req = state.get("hiring_request", {})
    candidates_needed = state.get("candidates_needed", 
                                  hiring_req.get("candidates_needed", 10))
    threshold = max(candidates_needed * 3, settings.MIN_APPLICANT_COUNT)  # 3x pipeline

    # Mock: simulate application count growing over iterations
    sourcing_retry_count = state.get("sourcing_retry_count", 0)
    current_count = state.get("application_count", 0)

    # Simulate applications arriving (in real app, this would query the DB)
    new_applications = random.randint(3, 12) * (sourcing_retry_count + 1)
    total_count = current_count + new_applications

    print(f"[Monitoring Agent] Applications: {total_count} / {threshold} needed")

    if total_count >= threshold:
        print(f"[Monitoring Agent] ✅ Threshold reached! Proceeding to shortlisting.")
        return {
            "application_count": total_count,
            "agent_statuses": {"monitoring": "threshold_reached"},
            "next_action": "screening",
        }
    else:
        print(f"[Monitoring Agent] ⚠️  Below threshold. Triggering JD optimization.")
        return {
            "application_count": total_count,
            "agent_statuses": {"monitoring": "below_threshold"},
            "next_action": "jd_optimization",
        }


def jd_optimization_node(state: HiringState) -> dict:
    """
    JD Optimization Agent — Step 7 from agentic-workflow.md.
    Improves the JD to attract more candidates and reposts.
    """
    jd_content = state.get("jd_content", "")
    application_count = state.get("application_count", 0)
    sourcing_retry_count = state.get("sourcing_retry_count", 0)
    hiring_req = state.get("hiring_request", {})
    candidates_needed = hiring_req.get("candidates_needed", 10)
    threshold = max(candidates_needed * 3, settings.MIN_APPLICANT_COUNT)

    print(f"[JD Optimization Agent] Improving JD (repost #{sourcing_retry_count + 1})...")

    if sourcing_retry_count >= settings.MAX_SOURCING_RETRIES:
        # Force proceed after max retries even with low count
        print("[JD Optimization Agent] Max retries reached. Proceeding with available candidates.")
        return {
            "sourcing_retry_count": sourcing_retry_count + 1,
            "agent_statuses": {"jd_optimization": "max_retries"},
            "next_action": "screening",
        }

    try:
        prompt = JD_OPTIMIZATION_PROMPT.format(
            current_count=application_count,
            threshold=threshold,
            jd_content=jd_content,
        )
        response = llm.invoke(prompt)
        improved_jd = response.content.strip()
    except Exception as e:
        print(f"[JD Optimization] LLM error: {e}")
        improved_jd = jd_content  # Keep original if optimization fails

    # Mock: Re-post to platforms (Step 8 — Repost Updated JD)
    from datetime import datetime
    import random as rand
    repost_results = {}
    for platform in ["LinkedIn", "Naukri", "Wellfound"]:
        repost_id = f"{platform[:3].upper()}-OPT-{rand.randint(10000, 99999)}"
        repost_results[platform] = {
            "status": "reposted",
            "posting_id": repost_id,
            "url": f"https://{platform.lower()}.com/jobs/{repost_id}",
            "reposted_at": datetime.utcnow().isoformat(),
        }
        print(f"  🔄 Reposted to {platform}")

    return {
        "jd_content": improved_jd,
        "posting_status": repost_results,
        "sourcing_retry_count": sourcing_retry_count + 1,
        "agent_statuses": {"jd_optimization": "completed"},
        "next_action": "monitoring",  # Wait and monitor again
    }
