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
from datetime import datetime
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
UPLOADS_DIR = BASE_DIR / "uploads"
CANDIDATES_FILE = BASE_DIR / "candidates.json"
JOBS_FILE = BASE_DIR / "jobs.json"

UPLOADS_DIR.mkdir(exist_ok=True)

# ── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Dummy Hiring Platform",
    description="A simple job board where candidates apply and upload resumes. Used by the AI Hiring Agent.",
    version="1.0.0",
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


# ── Default job listings (populated from AI chatbot workflow) ─────────────────

DEFAULT_JOBS = [
    {
        "id": "job-001",
        "title": "Senior Python Developer",
        "department": "Engineering",
        "location": "Remote / Bangalore",
        "experience": "4-6 years",
        "salary": "₹20-30 LPA",
        "skills": ["Python", "FastAPI", "PostgreSQL", "Docker"],
        "description": "Build scalable backend systems for our AI-powered recruitment platform.",
        "posted_at": datetime.utcnow().isoformat(),
        "status": "open",
    },
    {
        "id": "job-002",
        "title": "React Frontend Engineer",
        "department": "Engineering",
        "location": "Hybrid / Mumbai",
        "experience": "3-5 years",
        "salary": "₹15-25 LPA",
        "skills": ["React", "TypeScript", "Tailwind CSS", "GraphQL"],
        "description": "Craft beautiful, performant user interfaces for our recruitment dashboard.",
        "posted_at": datetime.utcnow().isoformat(),
        "status": "open",
    },
]


# ── REST API Endpoints ────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "platform": "Dummy Hiring Platform", "version": "1.0.0"}


@app.get("/jobs")
async def list_jobs():
    """Return all open job listings."""
    jobs = _load_json(JOBS_FILE, DEFAULT_JOBS)
    return {"jobs": jobs, "total": len(jobs)}


@app.post("/jobs")
async def create_job(job: dict):
    """
    Add a new job listing (called by the AI chatbot workflow when a JD is approved).
    """
    jobs = _load_json(JOBS_FILE, DEFAULT_JOBS)
    job.setdefault("id", f"job-{uuid.uuid4().hex[:8]}")
    job.setdefault("posted_at", datetime.utcnow().isoformat())
    job.setdefault("status", "open")
    jobs.append(job)
    _save_json(JOBS_FILE, jobs)
    return {"message": "Job created", "job": job}


@app.post("/apply")
async def apply_for_job(
    name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(""),
    job_id: str = Form(...),
    job_title: str = Form(""),
    linkedin_url: str = Form(""),
    cover_note: str = Form(""),
    resume: UploadFile = File(...),
):
    """
    Accept a job application with resume upload.
    Stores the resume file and candidate metadata.
    """
    # Validate file type
    allowed_types = {
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    allowed_exts = {".pdf", ".doc", ".docx"}
    file_ext = Path(resume.filename).suffix.lower()

    if file_ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Only PDF and Word documents are accepted. Got: {file_ext}",
        )

    # Save the resume file
    candidate_id = f"CAND-{uuid.uuid4().hex[:8].upper()}"
    safe_filename = f"{candidate_id}{file_ext}"
    file_path = UPLOADS_DIR / safe_filename

    content = await resume.read()
    file_path.write_bytes(content)

    # Build candidate record
    candidate = {
        "id": candidate_id,
        "name": name,
        "email": email,
        "phone": phone,
        "job_id": job_id,
        "applied_for": job_title,
        "linkedin_url": linkedin_url,
        "cover_note": cover_note,
        "resume_filename": safe_filename,
        "resume_url": f"http://localhost:8001/resumes/{safe_filename}",
        "original_filename": resume.filename,
        "file_size_kb": round(len(content) / 1024, 1),
        "applied_at": datetime.utcnow().isoformat(),
        "status": "applied",
        "source": "Dummy Hiring Platform",
    }

    # Persist to candidates.json
    candidates = _load_json(CANDIDATES_FILE, {"candidates": []})
    candidates["candidates"].append(candidate)
    _save_json(CANDIDATES_FILE, candidates)

    print(f"[Platform] ✅ New application: {name} ({email}) → {job_title} [{candidate_id}]")
    return {
        "message": "Application submitted successfully!",
        "candidate_id": candidate_id,
        "candidate": candidate,
    }


@app.get("/candidates")
async def list_candidates(job_id: Optional[str] = None):
    """
    Return all candidates who applied.
    Optionally filter by job_id.
    Used by the AI hiring agent to fetch applicants.
    """
    data = _load_json(CANDIDATES_FILE, {"candidates": []})
    candidates = data.get("candidates", [])
    if job_id:
        candidates = [c for c in candidates if c.get("job_id") == job_id]
    return {
        "candidates": candidates,
        "total": len(candidates),
        "fetched_at": datetime.utcnow().isoformat(),
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
    data = _load_json(CANDIDATES_FILE, {"candidates": []})
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
    print("🚀 Starting Dummy Hiring Platform at http://localhost:8001")
    print("   API Docs: http://localhost:8001/docs")
    print("   Candidates API: http://localhost:8001/candidates")
    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=True, app_dir=str(BASE_DIR))
