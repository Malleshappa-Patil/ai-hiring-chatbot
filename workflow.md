# Enterprise Multi-Agent Recruitment Automation Platform

## Project Overview

A production-grade Enterprise Multi-Agent Recruitment Automation Platform that automates the complete hiring lifecycle using Agentic AI. The system is **not** a chatbot. It functions as an autonomous workflow orchestration platform that understands a high-level hiring goal, creates an execution plan, coordinates multiple specialized agents, integrates with external tools, maintains memory, and keeps humans involved only at critical approval checkpoints.

A conversational **AI Chatbot** (powered by Google Gemini) guides recruiters through hiring-request collection and then triggers the autonomous agentic workflow.

Example Goal:

"Hire a Senior Backend Engineer"

The system automatically:

1. Collects hiring requirements via AI chatbot conversation
2. Generates a Job Description
3. Obtains recruiter approval (HITL)
4. Publishes the job to recruitment platforms
5. Monitors applicant flow
6. Screens & scores resumes (with prompt-injection guardrails)
7. Ranks candidates
8. Schedules interviews (with Google Meet links)
9. Conducts interview evaluation
10. Sends rejection / offer communications
11. Manages offer negotiation & renegotiation
12. Triggers onboarding workflow
13. Maintains hiring analytics

The system uses a **Human-in-the-Loop** architecture where critical decisions (JD approval, candidate review) require recruiter sign-off.

---

# Core Architecture

The application follows a **Multi-Agent Architecture** built using **LangGraph** with Google Gemini as the LLM backbone.

| Layer              | Technology                                        |
|--------------------|---------------------------------------------------|
| AI Orchestration   | LangGraph (multi-agent state graph)               |
| LLM                | Google Gemini (`gemini-2.5-flash`)                 |
| Embeddings         | HuggingFace `sentence-transformers/all-MiniLM-L6-v2` |
| RAG                | LangChain + ChromaDB                              |
| Resume Parsing     | PyMuPDF + Unstructured                            |
| Backend            | FastAPI + Python 3.11                             |
| Frontend           | React 18 + TypeScript + Vite + Tailwind CSS       |
| Short-Term Memory  | Redis (fail-safe, optional)                       |
| Long-Term Memory   | PostgreSQL 15 (async via SQLAlchemy + asyncpg)    |
| Email              | fastapi-mail (real SMTP or mock mode)             |
| Interview Links    | Google Meet API (or placeholder)                  |
| Observability      | LangSmith                                         |
| Containerization   | Docker + Docker Compose                           |

---

# Agent Hierarchy

The platform has **11 LangGraph agent nodes** organized under a Supervisor that routes work dynamically.

## 1. Supervisor Agent

File: `backend/agents/supervisor.py`

Responsibilities:

* Entry point of the workflow
* Understand current hiring state
* Decide which agent executes next using an LLM decision tree
* Handle failures and retries
* Track overall progress via `next_action` field

Input:

* Full `HiringState` (goal, JD status, application counts, interview results, offer status, etc.)

Output:

* `next_action` — the next agent node to invoke

---

## 2. Planning Agent

File: `backend/agents/planning.py`

Responsibilities:

* Convert hiring goals into executable task lists
* Create workflow plans
* Define dependencies and execution order

Tools:

* Google Gemini (LLM)

---

## 3. JD Agent (Job Description Generation)

File: `backend/agents/jd_agent.py`

Responsibilities:

* Generate job descriptions using LLM + hiring context
* Use company hiring templates
* Support iterative refinement based on recruiter feedback
* Track retry count (max 3 retries)

Tools:

* Google Gemini (LLM)
* RAG (company knowledge retrieval)

Human Approval Required:

* Approve → proceed to sourcing
* Reject with feedback → regenerate JD

---

## 4. Sourcing Agent

File: `backend/agents/sourcing.py`

Responsibilities:

* Publish approved jobs to recruitment platforms
* Manage job posting channels
* Track posting success per platform

Tools:

* LinkedIn API (mock)
* Naukri API (mock)
* Indeed API (mock)
* Wellfound API (mock)
* Company Career Portal (mock)

Output:

* `posting_status` — platform → status mapping
* Job status updated in database

---

## 5. Monitoring Agent

File: `backend/agents/monitoring.py`

Responsibilities:

* Monitor hiring metrics and application volume
* Detect low application count vs. threshold (MIN_APPLICANT_COUNT=10)
* Route to screening (if sufficient) or JD optimization (if low)
* Track sourcing retry count

Contains sub-node: **JD Optimization Node**

* Improves JD keywords, visibility, and reach
* Triggers repost via sourcing

---

## 6. Resume Screening Agent

File: `backend/agents/screening.py`

Responsibilities:

* Parse uploaded resumes
* Compare resumes against approved JD using Gemini
* Score candidates (0–100)
* Categorize candidates

Categories:

* **Strong Match** (≥70%)
* **Partial Match** (50–69%)
* **Weak Match** (<50%)

Tools:

* Resume Parser (PyMuPDF)
* Google Gemini (LLM evaluation)
* ChromaDB (vector similarity)

Security:

* **Prompt-injection guardrail** — regex + LLM detection layers reject manipulative resume content before scoring

Output:

* Candidate rankings & scores
* Match explanations
* Skills matched / missing

---

## 7. Interview Scheduling Agent

File: `backend/agents/interview.py` (scheduling node)

Responsibilities:

* Schedule interviews for shortlisted candidates
* Generate Google Meet links (real or placeholder)
* Send interview invitation emails
* Book time slots

Tools:

* Google Meet Service (`backend/services/google_meet_service.py`)
* Email Service (`backend/services/notification_service.py`)

---

## 8. Interview Conduct Agent

File: `backend/agents/interview.py` (conduct node)

Responsibilities:

* Simulate/evaluate technical & behavioral interviews
* Score candidates
* Determine selected vs. rejected candidates

Tools:

* Google Gemini (LLM evaluation)

Output:

* `interview_results` — candidate ID → evaluation
* `selected_candidates` — final picks
* `rejected_candidates` — not selected

---

## 9. Communication Agent

File: `backend/agents/communication.py`

Responsibilities:

* Send empathetic, professional rejection emails to non-selected candidates
* Use LLM to personalize each rejection message

Tools:

* Google Gemini (LLM)
* Email Service

---

## 10. Offer Management Agent

File: `backend/agents/offer_management.py`

Responsibilities:

* Generate personalized offer letters using LLM
* Send offers to selected candidates
* Track acceptance / rejection / renegotiation status

Tools:

* Google Gemini (LLM)
* Email Service

---

## 11. Renegotiation Agent

File: `backend/agents/renegotiation.py`

Responsibilities:

* Handle salary and benefits negotiation
* Support multiple negotiation rounds
* Final decision: accept or close process

Tools:

* Google Gemini (LLM)
* Email Service

---

## 12. Onboarding Agent

File: `backend/agents/onboarding.py`

Responsibilities:

* Trigger onboarding workflow for accepted candidates
* Send welcome communication
* Create onboarding tasks (document collection, IT asset allocation, etc.)
* Generate access requests

Tools:

* Email Service
* HRMS (mock)
* IT Ticketing (mock)

Output:

* Onboarding checklist
* Employee onboarding status

---

# AI Chatbot Interface

File: `backend/api/v1/chatbot.py`

The chatbot is the conversational entry point for HR/recruiters. It uses Google Gemini to guide users through a structured conversation that collects all hiring parameters.

**Chatbot Flow:**

1. **Greeting** — Welcome and ask for job title
2. **Job Title** — Collect title, infer department
3. **Skills** — Ask for required skills
4. **Experience** — Ask for experience level
5. **Budget** — Collect salary range
6. **Location** — Ask for work location
7. **Candidates Needed** — How many to hire
8. **Hiring Manager** — Who approves
9. **Confirmation** — Summarize and confirm
10. **JD Generation** — Trigger JD agent via Gemini
11. **JD Approval** — HITL: recruiter reviews generated JD
12. **Workflow Launch** — Approved JD triggers the full agentic pipeline

Endpoints:

* `POST /chatbot/start` — Start a new chatbot session
* `POST /chatbot/message` — Send a message and get AI response
* `GET  /chatbot/session/{id}` — Get session history
* `POST /chatbot/approve-jd` — Approve or reject the generated JD

---

# Shared Tool & Service Layer

## Services

| Service                  | File                                        | Purpose                                                     |
|--------------------------|---------------------------------------------|-------------------------------------------------------------|
| Workflow Service         | `backend/services/workflow_service.py`      | Orchestrates LangGraph execution, manages state transitions |
| CV Screening Service     | `backend/services/cv_screening_service.py`  | Gemini-powered resume scoring with prompt-injection guards  |
| Notification Service     | `backend/services/notification_service.py`  | Email sending (real SMTP via fastapi-mail or mock mode)     |
| Google Meet Service      | `backend/services/google_meet_service.py`   | Google Calendar + Meet link generation                      |
| Resume Parser            | `backend/services/resume_parser.py`         | PDF resume text extraction                                  |

## External Integrations

| Tool             | Status      | Notes                                             |
|------------------|-------------|---------------------------------------------------|
| Google Gemini    | ✅ Live      | `gemini-2.5-flash` for all LLM tasks              |
| HuggingFace      | ✅ Live      | `all-MiniLM-L6-v2` embeddings                     |
| ChromaDB         | ✅ Live      | Vector store persisted at `./chroma_db`            |
| fastapi-mail     | ✅ Live      | SMTP email (Gmail); toggle `MAIL_MOCK` for dev    |
| Google Meet      | ⚙️ Optional | Real links via service account; placeholder by default |
| LangSmith        | ✅ Live      | Tracing, latency, token usage                     |
| LinkedIn API     | 🔲 Mock      | Simulated job posting                             |
| Naukri API       | 🔲 Mock      | Simulated job posting                             |
| Indeed API       | 🔲 Mock      | Simulated job posting                             |
| HRMS             | 🔲 Mock      | Simulated onboarding system                       |

---

# Memory Architecture

## Short-Term Memory

File: `backend/memory/short_term.py`

Purpose: Maintain active workflow state with TTL expiry.

Store:

* Current workflow stage
* Candidate progress
* Interview status
* Pending approvals
* Agent status cache

Technology: **Redis** (async, fail-safe — degrades gracefully if Redis is down)

---

## Long-Term Memory

File: `backend/memory/long_term.py`

Purpose: Store historical hiring information for RAG and analytics.

Store:

* Previous hiring campaigns
* Candidate outcomes
* Approved JDs
* Recruiter preferences
* Hiring analytics

Technology: **PostgreSQL** (async via SQLAlchemy + asyncpg)

---

## Vector Store

File: `backend/memory/vector_store.py`

Purpose: Semantic similarity search for RAG retrieval.

Technology: **ChromaDB** with HuggingFace `all-MiniLM-L6-v2` embeddings

---

# LangGraph Workflow

File: `backend/workflows/graph.py`
State: `backend/workflows/state.py`

The complete 18-step hiring pipeline is implemented as a LangGraph `StateGraph` with conditional edges, HITL interrupts, and loop-back paths.

```
START
  ↓
Supervisor Agent
  ↓
  ├─ JD Generation ←─────────────┐
  │     ↓                        │
  │  Supervisor (HITL check)     │
  │     ↓                        │
  │  JD Approved?                │
  │   ├─ NO → JD Generation ─────┘
  │   └─ YES
  │         ↓
  ├─ Sourcing (post to platforms)
  │     ↓
  ├─ Monitoring
  │     ↓
  │  Applications ≥ 10?
  │   ├─ NO → JD Optimization → Monitoring (loop)
  │   └─ YES
  │         ↓
  ├─ Resume Screening
  │     ↓
  ├─ Interview Scheduling
  │     ↓
  ├─ Interview Conduct
  │     ↓
  │  Candidate Selected?
  │   ├─ Rejected → Communication (rejection emails)
  │   │                ↓
  │   │            Selected remaining?
  │   │             ├─ YES → Offer Management
  │   │             └─ NO  → END
  │   └─ Selected → Offer Management
  │         ↓
  │  Offer Status?
  │   ├─ Renegotiating → Renegotiation Agent
  │   │                    ↓
  │   │                 Accepted? → Onboarding
  │   │                 Rejected? → END
  │   ├─ Accepted → Onboarding
  │   └─ All Rejected → END
  │         ↓
  └─ Onboarding
         ↓
        END
```

**HITL Interrupts:**

* `interrupt_before=["sourcing"]` — JD must be approved before posting
* Candidate shortlist review via API

**Checkpointing:**

* `MemorySaver` — in-memory checkpointing for HITL resume

---

# Backend Architecture

Framework: **FastAPI**

Entrypoint: `backend/main.py`

API Prefix: `/api/v1`

### API Routers

| Router       | Prefix              | File                          | Purpose                         |
|--------------|----------------------|-------------------------------|---------------------------------|
| Auth         | `/api/v1/auth`      | `backend/api/v1/auth.py`      | JWT login, register, user mgmt |
| Jobs         | `/api/v1/jobs`      | `backend/api/v1/jobs.py`      | CRUD jobs, JD approval          |
| Candidates   | `/api/v1/candidates`| `backend/api/v1/candidates.py`| Resume upload, scoring, status  |
| Workflow     | `/api/v1/workflow`  | `backend/api/v1/workflow.py`  | Start/advance/status workflows  |
| Interviews   | `/api/v1/interviews`| `backend/api/v1/interviews.py`| Schedule, manage interviews     |
| Onboarding   | `/api/v1/onboarding`| `backend/api/v1/onboarding.py`| Onboarding task management      |
| Analytics    | `/api/v1/analytics` | `backend/api/v1/analytics.py` | Hiring metrics & reporting      |
| AI Chatbot   | `/api/v1/chatbot`   | `backend/api/v1/chatbot.py`   | Conversational hiring assistant |

### Backend Structure

```
backend/
├── agents/                 # 11 LangGraph agent nodes
│   ├── supervisor.py       #   Workflow router
│   ├── planning.py         #   Goal → execution plan
│   ├── jd_agent.py         #   JD generation
│   ├── sourcing.py         #   Job posting
│   ├── monitoring.py       #   Application monitoring + JD optimization
│   ├── screening.py        #   Resume screening
│   ├── interview.py        #   Interview scheduling + conduct
│   ├── communication.py    #   Rejection emails
│   ├── offer_management.py #   Offer letter generation
│   ├── renegotiation.py    #   Salary/benefits negotiation
│   └── onboarding.py       #   Post-hire onboarding
├── workflows/
│   ├── graph.py            # LangGraph StateGraph (compiled)
│   └── state.py            # HiringState TypedDict definition
├── services/
│   ├── workflow_service.py      # Workflow orchestration
│   ├── cv_screening_service.py  # Gemini CV scoring + guardrails
│   ├── notification_service.py  # Email service (SMTP / mock)
│   ├── google_meet_service.py   # Meet link generation
│   └── resume_parser.py        # PDF text extraction
├── rag/
│   └── documents/          # RAG knowledge base documents
├── memory/
│   ├── short_term.py       # Redis async client
│   ├── long_term.py        # PostgreSQL query layer
│   └── vector_store.py     # ChromaDB wrapper
├── database/
│   ├── models.py           # 11 SQLAlchemy ORM tables
│   ├── session.py          # Async engine + session factory
│   └── migrations/         # Alembic migrations
├── api/
│   ├── dependencies.py     # Auth dependency injection
│   └── v1/                 # 8 API routers
├── auth/
│   ├── jwt_handler.py      # JWT token creation/verification
│   └── password.py         # bcrypt hashing
├── models/
│   ├── request_models.py   # Pydantic request schemas
│   └── response_models.py  # Pydantic response schemas
├── config.py               # Pydantic Settings (env-based)
├── main.py                 # FastAPI app + lifespan + middleware
├── requirements.txt        # Python dependencies
└── Dockerfile              # Backend container image
```

---

# HireBoard Platform (Candidate-Facing)

Directory: `hiring-platform/`

A standalone FastAPI server that serves as the **candidate-facing job board** and external hiring portal. It runs independently on port **8001** and connects back to the main backend.

Features:

* Browse published job listings
* Apply for jobs (upload resume)
* View application status
* Static HTML/CSS/JS frontend (`index.html`, `style.css`, `app.js`)
* JSON-backed data storage (`candidates.json`, `jobs.json`, `companies.json`)
* Auto-syncs job postings from the main backend

Run: `python hiring-platform/server.py`

---

# Frontend Architecture

Framework: **React 18 + TypeScript**

Bundler: **Vite**

Styling: **Tailwind CSS**

State Management: **React Query** (`@tanstack/react-query`)

Notifications: **react-hot-toast**

Routing: **React Router v6** (protected routes + layout)

### Frontend Structure

```
frontend/src/
├── api/                    # Axios API client modules
│   ├── client.ts           #   Base Axios instance
│   ├── auth.ts             #   Auth endpoints
│   ├── jobs.ts             #   Job endpoints
│   ├── candidates.ts       #   Candidate endpoints
│   ├── workflow.ts         #   Workflow endpoints
│   ├── interviews.ts       #   Interview endpoints (not shown but inferred)
│   ├── onboarding.ts       #   Onboarding endpoints
│   ├── analytics.ts        #   Analytics endpoints
│   └── chatbot.ts          #   AI Chatbot endpoints
├── components/
│   ├── common/             #   Layout, Sidebar, ProtectedRoute
│   ├── chatbot/            #   AIChatbot.tsx — conversational UI
│   ├── analytics/          #   Chart & metric components
│   ├── candidates/         #   Candidate cards & tables
│   ├── jobs/               #   Job listing & JD review components
│   └── workflow/           #   Agent status & pipeline visualization
├── pages/
│   ├── Login.tsx           #   JWT authentication page
│   ├── Dashboard.tsx       #   Metrics overview + agent status
│   ├── JobManagement.tsx   #   Create jobs, review & approve JDs
│   ├── CandidateList.tsx   #   AI-ranked candidate list
│   ├── WorkflowMonitor.tsx #   Real-time agent pipeline status
│   ├── Analytics.tsx       #   Funnel metrics + trends charts
│   └── OnboardingTracker.tsx # Post-hire task tracker
├── types/
│   └── index.ts            #   TypeScript interfaces
├── App.tsx                 #   Routes + QueryClient + Toaster
├── main.tsx                #   ReactDOM root
├── index.css               #   Global styles
└── App.css                 #   App-level styles
```

---

# Frontend Pages

| Page              | Route          | Description                             |
|-------------------|----------------|-----------------------------------------|
| Login             | `/login`       | JWT authentication                      |
| Dashboard         | `/dashboard`   | Metrics overview + agent status         |
| Job Management    | `/jobs`        | Create jobs, review & approve JDs       |
| Candidates        | `/candidates`  | AI-ranked candidate list with scores    |
| Workflow Monitor  | `/workflow`    | Real-time agent pipeline visualization  |
| Analytics         | `/analytics`   | Funnel metrics + hiring trend charts    |
| Onboarding        | `/onboarding`  | Post-hire task tracker                  |

The AI Chatbot is accessible as a floating component across all authenticated pages.

---

# Authentication

Implementation:

* **JWT** (access + refresh tokens)
* **bcrypt** password hashing
* **RBAC** (Role-Based Access Control)

Roles:

1. **Recruiter** — Create jobs, manage candidates
2. **Hiring Manager** — Approve JDs, review candidates
3. **Admin** — Full access

Default credentials (dev): `admin@hiring.com` / `admin123`

---

# Database Design

**PostgreSQL** — 11 SQLAlchemy ORM tables

File: `backend/database/models.py`

| Table              | Purpose                                  |
|--------------------|------------------------------------------|
| `users`            | Recruiters, hiring managers, admins      |
| `jobs`             | Job postings with hiring goals           |
| `job_descriptions` | Versioned JDs with approval tracking     |
| `candidates`       | Applicant records linked to jobs         |
| `resumes`          | Uploaded resume files + parsed data      |
| `candidate_scores` | AI screening scores + match categories   |
| `interviews`       | Scheduled interviews with Meet links     |
| `workflow_states`  | LangGraph workflow state + agent status  |
| `agent_logs`       | Agent execution logs (latency, tokens)   |
| `onboarding_tasks` | Post-hire task tracking                  |
| `analytics`        | Hiring metrics (funnel, conversion)      |

---

# Observability

Implemented via **LangSmith** integration.

Tracked:

* Agent execution logs (per-node)
* Tool calls
* Latency (ms)
* Token usage
* Failures & errors
* Workflow traces (full pipeline)

Agent logs are also persisted to the `agent_logs` PostgreSQL table.

---

# Deployment

### Docker Compose (`docker-compose.yml`)

| Service   | Image / Build          | Port  |
|-----------|------------------------|-------|
| PostgreSQL| `postgres:15-alpine`   | 5432  |
| Redis     | `redis:7-alpine`       | 6379  |
| Backend   | `./backend/Dockerfile` | 8000  |
| Frontend  | `./frontend/Dockerfile`| 5173  |

Volumes: `postgres_data`, `redis_data`, `chroma_data`, `upload_data`

### Local Development

```bash
# Backend
uvicorn backend.main:app --reload          # port 8000

# HireBoard Platform
python hiring-platform/server.py           # port 8001

# Frontend
cd frontend && npm run dev                 # port 5173
```

---

# Non-Functional Requirements

* Production-ready architecture
* Modular codebase with clear separation of concerns
* Scalable design (async I/O, connection pooling)
* Fault tolerance (Redis fail-safe, retry logic)
* Human-in-the-loop approvals at critical checkpoints
* Prompt-injection guardrails for resume screening
* Audit logging (agent_logs table + LangSmith)
* Extensible agent framework (add agents by registering nodes)
* Clean RESTful API design with Swagger/ReDoc docs
* Real-time workflow visibility
* Email notifications (real SMTP or mock)
* Interview scheduling with Google Meet links

---

# Resume Project Title

Enterprise Multi-Agent Recruitment Automation Platform using LangGraph, Google Gemini, RAG, Memory Systems, Human-in-the-Loop Workflows, Tool Calling, and Autonomous Agent Orchestration.

---

# Skills Demonstrated

* Agentic AI
* LangGraph (State Graphs, Conditional Edges, HITL Interrupts)
* Multi-Agent Systems (11 specialized agents)
* Google Gemini Integration
* RAG Architecture (LangChain + ChromaDB + HuggingFace)
* Prompt-Injection Security
* Tool Calling
* LLM Orchestration
* Memory Systems (Redis + PostgreSQL)
* FastAPI (async, middleware, dependency injection)
* React + TypeScript
* Tailwind CSS
* PostgreSQL (SQLAlchemy ORM, async)
* Redis
* Docker + Docker Compose
* JWT Authentication + RBAC
* Email Automation (fastapi-mail)
* Google Meet Integration
* LangSmith Observability
* Workflow Automation
* AI System Design
* Production AI Engineering
