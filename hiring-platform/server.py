"""
Dummy Hiring Platform — Standalone FastAPI server.

Serves the candidate-facing job board web app and exposes REST APIs
that the AI hiring agent uses to fetch applicants and resumes.

Run: python hiring-platform/server.py
URL: http://localhost:8001
"""
import json
import os
import uuid
import urllib.request as _urllib_req
import urllib.parse
from datetime import datetime
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR       = Path(__file__).parent
UPLOADS_DIR    = BASE_DIR / "uploads"
CANDIDATES_FILE = BASE_DIR / "candidates.json"
JOBS_FILE      = BASE_DIR / "jobs.json"
COMPANIES_FILE = BASE_DIR / "companies.json"

UPLOADS_DIR.mkdir(exist_ok=True)

# ── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="HireBoard Platform",
    description="Candidate-facing job board connected to the AI Hiring Chatbot.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _load_json(path: Path, default) -> any:
    if path.exists():
        try:
            return json.loads(path.read_text())
        except Exception:
            return default
    return default


def _save_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def _resolve_main_backend_job_id(hireboard_job_id: str) -> str | None:
    """
    Given a HireBoard job id, return the main backend job UUID.

    Two cases:
    1. Local chatbot-created job (id like 'job-xxxx') — has main_backend_id stored in jobs.json
    2. Live main-backend job (id like 'mb-XXXXXXXX') — UUID prefix embedded in id
       We fetch the public endpoint to find the full UUID.
    """
    # Case 1: check local store
    jobs: list = _load_json(JOBS_FILE, [])
    if isinstance(jobs, dict):
        jobs = jobs.get("jobs", [])
    for j in jobs:
        if j.get("id") == hireboard_job_id and j.get("main_backend_id"):
            return j["main_backend_id"]

    # Case 2: live main-backend job — id is 'mb-{first8charsOfUUID}'
    if hireboard_job_id.startswith("mb-"):
        short = hireboard_job_id[3:]  # 8-char hex prefix of the UUID
        try:
            req = _urllib_req.Request(
                "http://localhost:8000/api/v1/jobs/public?page_size=200",
                headers={"Accept": "application/json"},
            )
            with _urllib_req.urlopen(req, timeout=2) as resp:
                data = json.loads(resp.read().decode())
                for mj in data.get("items", []):
                    if mj["id"].replace("-", "").startswith(short):
                        return mj["id"]
        except Exception as e:
            print(f"[Platform] ⚠️  Could not resolve job UUID: {e}")

    return None

# ── Default data ──────────────────────────────────────────────────────────────

DEFAULT_COMPANY = {
    "id": "company-hello-world",
    "name": "Hello World",
    "tagline": "Building the future, one hire at a time",
    "industry": "Technology",
    "location": "Bangalore / Remote",
    "team_size": "10–100",
    "website": "",
    "created_at": datetime.utcnow().isoformat(),
}

DEFAULT_JOBS = [
    {
        "id": "job-001",
        "company_id": "company-001",
        "title": "Senior Python Developer",
        "department": "Engineering",
        "location": "Remote / Bangalore",
        "experience": "4-6 years",
        "salary": "₹20-30 LPA",
        "skills": ["Python", "FastAPI", "PostgreSQL", "Docker"],
        "description": "Build scalable backend systems for our AI-powered recruitment platform.",
        "posted_at": datetime.utcnow().isoformat(),
        "status": "open",
        "target_candidate_count": 3,
        "openings": 3,
    },
    {
        "id": "job-002",
        "company_id": "company-001",
        "title": "React Frontend Engineer",
        "department": "Engineering",
        "location": "Hybrid / Mumbai",
        "experience": "3-5 years",
        "salary": "₹15-25 LPA",
        "skills": ["React", "TypeScript", "Tailwind CSS", "GraphQL"],
        "description": "Craft performant user interfaces for our recruitment dashboard.",
        "posted_at": datetime.utcnow().isoformat(),
        "status": "open",
        "target_candidate_count": 2,
        "openings": 2,
    },
]


# ── REST API — Health ─────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "platform": "HireBoard", "version": "2.0.0"}


# ── REST API — Companies ──────────────────────────────────────────────────────

@app.get("/companies")
async def list_companies():
    """Return all companies."""
    data = _load_json(COMPANIES_FILE, {"companies": [DEFAULT_COMPANY]})
    companies = data.get("companies", [DEFAULT_COMPANY])
    return {"companies": companies, "total": len(companies)}


@app.post("/companies")
async def create_company(company: dict):
    """Add a new company."""
    data = _load_json(COMPANIES_FILE, {"companies": [DEFAULT_COMPANY]})
    companies = data.get("companies", [DEFAULT_COMPANY])

    company.setdefault("id", f"company-{uuid.uuid4().hex[:8]}")
    company.setdefault("created_at", datetime.utcnow().isoformat())
    companies.append(company)
    _save_json(COMPANIES_FILE, {"companies": companies})
    print(f"[Platform] ✅ Company created: {company.get('name')} [{company['id']}]")
    return {"message": "Company created", "company": company}


@app.get("/companies/{company_id}")
async def get_company(company_id: str):
    """Get a specific company."""
    data = _load_json(COMPANIES_FILE, {"companies": [DEFAULT_COMPANY]})
    for c in data.get("companies", []):
        if c["id"] == company_id:
            return c
    raise HTTPException(status_code=404, detail=f"Company {company_id} not found")


@app.put("/companies/{company_id}")
async def update_company(company_id: str, updates: dict):
    """Update an existing company."""
    data = _load_json(COMPANIES_FILE, {"companies": [DEFAULT_COMPANY]})
    companies = data.get("companies", [])
    for i, c in enumerate(companies):
        if c["id"] == company_id:
            companies[i] = {**c, **updates, "id": company_id}
            _save_json(COMPANIES_FILE, {"companies": companies})
            return {"message": "Company updated", "company": companies[i]}
    raise HTTPException(status_code=404, detail=f"Company {company_id} not found")


@app.delete("/companies/{company_id}")
async def delete_company(company_id: str):
    """Delete a company."""
    data = _load_json(COMPANIES_FILE, {"companies": [DEFAULT_COMPANY]})
    companies = data.get("companies", [])
    new_cos = [c for c in companies if c.get("id") != company_id]
    if len(new_cos) == len(companies):
        raise HTTPException(status_code=404, detail=f"Company {company_id} not found")
    _save_json(COMPANIES_FILE, {"companies": new_cos})
    return {"message": f"Company {company_id} removed"}


# ── REST API — Jobs ───────────────────────────────────────────────────────────

@app.get("/jobs")
async def list_jobs(company_id: Optional[str] = None):
    """
    Return all job listings.
    Merges:
      1. Jobs from the main AI Hiring backend (localhost:8000)
      2. Local jobs.json (chatbot-created jobs)
    Optionally filtered by company_id.
    """
    # ── 1. Load local jobs ────────────────────────────────────────
    local_jobs: list = _load_json(JOBS_FILE, [])
    if isinstance(local_jobs, dict):          # legacy format guard
        local_jobs = local_jobs.get("jobs", [])

    # ── 2. Fetch jobs from main backend (no auth needed, public) ──
    main_jobs: list = []
    try:
        req = _urllib_req.Request(
            "http://localhost:8000/api/v1/jobs/public",
            headers={"Accept": "application/json"},
        )
        with _urllib_req.urlopen(req, timeout=2) as resp:
            payload = json.loads(resp.read().decode())
            main_jobs = payload.get("items", [])
    except Exception as e:
        print(f"[Platform] ⚠️  Could not reach main backend: {e}")

    # ── 3. Normalise main-backend jobs into HireBoard format ──────
    local_main_map = {j.get("main_backend_id"): i for i, j in enumerate(local_jobs) if j.get("main_backend_id")}
    for mj in main_jobs:
        mid = mj.get("id", "")
        if mid in local_main_map:
            idx = local_main_map[mid]
            local_jobs[idx]["status"] = mj.get("status", local_jobs[idx].get("status", "open"))
            local_jobs[idx]["is_full"] = mj.get("is_full", False)
            if mj.get("is_full"):
                local_jobs[idx]["status"] = "not_hiring"
            continue

        hb_job = {
            "id":                     f"mb-{mid[:8]}",
            "main_backend_id":        mid,
            "company_id":             mj.get("company_id") or "company-hello-world",
            "title":                  mj.get("title", "Untitled"),
            "department":             mj.get("department", ""),
            "location":               mj.get("location", "Remote"),
            "experience":             mj.get("experience_level", ""),
            "salary":                 "Competitive",
            "skills":                 [],
            "description":            mj.get("hiring_goal", ""),
            "target_candidate_count": mj.get("target_candidate_count", 1),
            "openings":               mj.get("target_candidate_count", 1),
            "is_full":                mj.get("is_full", False),
            "status":                 mj.get("status", "open"),
            "posted_at":              mj.get("created_at", datetime.utcnow().isoformat()),
            "source":                 "main_backend",
        }
        local_jobs.append(hb_job)

    # ── 4. Filter and return ──────────────────────────────────────
    jobs = local_jobs
    if company_id:
        jobs = [j for j in jobs if j.get("company_id") == company_id]
    return {"jobs": jobs, "total": len(jobs)}


@app.post("/jobs")
async def create_job(job: dict):
    """
    Add a new job listing.
    Called by the AI chatbot workflow when a JD is approved.
    If no company_id is provided, defaults to company-001.
    Auto-creates the company section in companies.json if missing.
    """
    jobs = _load_json(JOBS_FILE, [])
    if isinstance(jobs, dict):
        jobs = jobs.get("jobs", [])
    job.setdefault("id", f"job-{uuid.uuid4().hex[:8]}")
    job.setdefault("posted_at", datetime.utcnow().isoformat())
    job.setdefault("status", "open")
    job.setdefault("company_id", "company-001")

    # Ensure company exists in companies.json so an accordion section renders
    co_id = job["company_id"]
    co_data = _load_json(COMPANIES_FILE, {"companies": [DEFAULT_COMPANY]})
    cos = co_data.get("companies", [])
    if not any(c.get("id") == co_id for c in cos):
        c_name = co_id.replace("company-", "").replace("-", " ").title()
        new_co = {
            "id": co_id,
            "name": c_name,
            "tagline": f"Building great teams at {c_name}",
            "industry": "Technology",
            "location": job.get("location", "Remote"),
            "team_size": "10-100",
            "created_at": datetime.utcnow().isoformat(),
        }
        cos.append(new_co)
        _save_json(COMPANIES_FILE, {"companies": cos})
        print(f"[Platform] ✅ Auto-created company: {c_name} [{co_id}]")

    jobs.append(job)
    _save_json(JOBS_FILE, jobs)
    print(f"[Platform] ✅ Job created: {job.get('title')} [{job['id']}] → company: {job['company_id']}")
    return {"message": "Job created", "job": job}


@app.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    """Remove a job listing (by local id OR main_backend_id)."""
    jobs = _load_json(JOBS_FILE, [])
    if isinstance(jobs, dict):
        jobs = jobs.get("jobs", [])
    before = len(jobs)
    jobs = [
        j for j in jobs
        if j.get("id") != job_id and j.get("main_backend_id") != job_id
    ]
    if len(jobs) == before:
        # Not found in local file — silently ok (was a live main-backend job)
        return {"message": f"Job {job_id} removed (or not in local store)"}
    _save_json(JOBS_FILE, jobs)
    return {"message": f"Job {job_id} removed"}


# ── REST API — Applications ───────────────────────────────────────────────────

@app.post("/apply")
async def apply_for_job(
    name:        str = Form(...),
    email:       str = Form(...),
    phone:       str = Form(""),
    job_id:      str = Form(...),
    job_title:   str = Form(""),
    company_id:  str = Form(""),
    linkedin_url: str = Form(""),
    cover_note:  str = Form(""),
    resume: UploadFile = File(...),
):
    """
    Accept a job application with resume upload.
    Stores the resume file, checks seat limit, then syncs to main backend
    which will trigger async CV screening via Gemini.
    """
    allowed_exts = {".pdf", ".doc", ".docx"}
    file_ext = Path(resume.filename).suffix.lower()

    if file_ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Only PDF and Word documents are accepted. Got: {file_ext}",
        )

    # -- Check seat limit BEFORE accepting the file upload --
    main_job_id = _resolve_main_backend_job_id(job_id)
    if main_job_id:
        try:
            req = _urllib_req.Request(
                f"http://localhost:8000/api/v1/jobs/{main_job_id}/seat-status",
                headers={"Accept": "application/json"},
            )
            with _urllib_req.urlopen(req, timeout=3) as resp:
                seat_data = json.loads(resp.read().decode())
                if seat_data.get("is_full"):
                    raise HTTPException(
                        status_code=409,
                        detail="We are not accepting applications for this role at the moment.",
                    )
        except HTTPException:
            raise
        except Exception as e:
            print(f"[Platform] ⚠️  Could not check seat status: {e}")

    candidate_id  = f"CAND-{uuid.uuid4().hex[:8].upper()}"
    safe_filename = f"{candidate_id}{file_ext}"
    file_path     = UPLOADS_DIR / safe_filename

    content = await resume.read()
    file_path.write_bytes(content)

    resume_url = f"http://localhost:8001/resumes/{safe_filename}"

    candidate = {
        "id":                candidate_id,
        "name":              name,
        "email":             email,
        "phone":             phone,
        "job_id":            job_id,
        "company_id":        company_id,
        "applied_for":       job_title,
        "linkedin_url":      linkedin_url,
        "cover_note":        cover_note,
        "resume_filename":   safe_filename,
        "resume_url":        resume_url,
        "original_filename": resume.filename,
        "file_size_kb":      round(len(content) / 1024, 1),
        "applied_at":        datetime.utcnow().isoformat(),
        "status":            "applied",
        "source":            "HireBoard",
    }

    candidates = _load_json(CANDIDATES_FILE, {"candidates": []})
    candidates["candidates"].append(candidate)
    _save_json(CANDIDATES_FILE, candidates)

    print(f"[Platform] New application: {name} ({email}) -> {job_title} [{candidate_id}]")

    # -- Push to main backend so recruiter sees candidate + CV screening triggers --
    if main_job_id:
        try:
            params = urllib.parse.urlencode({
                "name":             name,
                "email":            email,
                "phone":            phone,
                "job_id":           main_job_id,
                "linkedin_url":     linkedin_url,
                "cover_note":       cover_note,
                "source":           "HireBoard",
                "resume_file_path": str(file_path.resolve()),  # absolute path for CV parser
                "resume_url":       resume_url,
            })
            req = _urllib_req.Request(
                f"http://localhost:8000/api/v1/candidates/from-hireboard?{params}",
                method="POST",
                headers={"Content-Type": "application/json"},
            )
            with _urllib_req.urlopen(req, timeout=5) as resp:
                result = json.loads(resp.read().decode())
                if result.get("seats_full"):
                    raise HTTPException(
                        status_code=409,
                        detail="We are not accepting applications for this role at the moment.",
                    )
                print(f"[Platform] Synced to main backend: candidate_id={result.get('candidate_id')}")
        except HTTPException:
            raise
        except Exception as e:
            print(f"[Platform] Could not sync to main backend: {e}")
    else:
        print(f"[Platform] No main_backend_id for job {job_id} -- local-only job")

    return {
        "message": "Application submitted successfully! Our AI is reviewing your resume.",
        "candidate_id": candidate_id,
        "candidate": candidate,
    }



@app.get("/candidates")
async def list_candidates(job_id: Optional[str] = None, company_id: Optional[str] = None):
    """
    Return all candidates. Optionally filter by job_id or company_id.
    Used by the AI hiring agent to fetch applicants.
    """
    data       = _load_json(CANDIDATES_FILE, {"candidates": []})
    candidates = data.get("candidates", [])
    if job_id:
        candidates = [c for c in candidates if c.get("job_id") == job_id]
    if company_id:
        candidates = [c for c in candidates if c.get("company_id") == company_id]
    return {
        "candidates":  candidates,
        "total":       len(candidates),
        "fetched_at":  datetime.utcnow().isoformat(),
    }


@app.get("/candidates/{candidate_id}")
async def get_candidate(candidate_id: str):
    """Get a specific candidate by ID."""
    data = _load_json(CANDIDATES_FILE, {"candidates": []})
    for c in data.get("candidates", []):
        if c["id"] == candidate_id:
            return c
    raise HTTPException(status_code=404, detail=f"Candidate {candidate_id} not found")


@app.get("/resumes/{filename}")
async def download_resume(filename: str):
    """Download a candidate's resume file."""
    file_path = UPLOADS_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Resume file not found")
    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type="application/octet-stream",
    )


@app.delete("/candidates/{candidate_id}")
async def delete_candidate(candidate_id: str):
    """Remove a candidate application."""
    data   = _load_json(CANDIDATES_FILE, {"candidates": []})
    before = len(data["candidates"])
    data["candidates"] = [c for c in data["candidates"] if c["id"] != candidate_id]
    if len(data["candidates"]) == before:
        raise HTTPException(status_code=404, detail="Candidate not found")
    _save_json(CANDIDATES_FILE, data)
    return {"message": f"Candidate {candidate_id} removed"}


# ── Serve the frontend SPA ────────────────────────────────────────────────────
app.mount("/", StaticFiles(directory=str(BASE_DIR), html=True), name="static")


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("🚀 Starting HireBoard at http://localhost:8001")
    print("   API Docs:      http://localhost:8001/docs")
    print("   Companies API: http://localhost:8001/companies")
    print("   Candidates API:http://localhost:8001/candidates")
    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=True, app_dir=str(BASE_DIR))
