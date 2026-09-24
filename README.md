# Enterprise Multi-Agent Recruitment Automation Platform

> **Production-grade autonomous hiring orchestration platform** — not a chatbot.  
> Takes a high-level goal (e.g. *"Hire a Senior Backend Engineer"*) and autonomously runs the complete recruitment lifecycle using 11 LangGraph agents, Google Gemini, RAG, Memory Systems, and Human-in-the-Loop workflows.

---

## 🔍 Project Overview

A production-grade Enterprise Multi-Agent Recruitment Automation Platform that automates the complete hiring lifecycle using Agentic AI. It functions as an autonomous workflow orchestration platform that:

- Understands a high-level hiring goal
- Creates an execution plan
- Coordinates multiple specialized agents
- Integrates with external tools
- Maintains short-term and long-term memory
- Keeps humans involved only at critical approval checkpoints
 
A conversational **AI Chatbot** (powered by Google Gemini) guides recruiters through hiring-request collection and then triggers the autonomous agentic workflow.

**The system automatically:**

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
 
---

## 🏗️ Architecture

| Layer | Technology |
|---|---|
| AI Orchestration | LangGraph (multi-agent state graph) |
| LLM | Google Gemini (`gemini-2.5-flash`) |
| Embeddings | HuggingFace `sentence-transformers/all-MiniLM-L6-v2` |
| RAG | LangChain + ChromaDB |
| Resume Parsing | PyMuPDF + Unstructured |
| Backend | FastAPI + Python 3.11 |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Short-Term Memory | Redis (fail-safe, optional) |
| Long-Term Memory | PostgreSQL 15 (async via SQLAlchemy + asyncpg) |
| Email | fastapi-mail (real SMTP or mock mode) |
| Interview Links | Google Meet API (or placeholder) |
| Observability | LangSmith |
| Containerization | Docker + Docker Compose |

---

## 🤖 Agent Hierarchy

The platform has **12 LangGraph agent nodes** organized under a Supervisor that routes work dynamically.

| # | Agent | File | Role | HITL |
|---|---|---|---|---|
| 1 | Supervisor | `agents/supervisor.py` | Entry point, delegates tasks | No |
| 2 | Planning | `agents/planning.py` | Converts goal → execution plan | No |
| 3 | JD Agent | `agents/jd_agent.py` | Generates job descriptions | ✅ Approve/Reject |
| 4 | Sourcing | `agents/sourcing.py` | Posts jobs to LinkedIn/Naukri/Indeed (mock) | No |
| 5 | Monitoring | `agents/monitoring.py` | Tracks funnel, auto-retries if low | No |
| 6 | Resume Screening | `agents/screening.py` | Parses & ranks resumes via RAG + Gemini | ✅ Human Review |
| 7 | Interview Scheduling | `agents/interview.py` | Schedules interviews + Google Meet links | No |
| 8 | Interview Conduct | `agents/interview.py` | Evaluates candidate performance | No |
| 9 | Communication | `agents/communication.py` | Sends personalized rejection emails | No |
| 10 | Offer Management | `agents/offer_management.py` | Generates & sends offer letters | No |
| 11 | Renegotiation | `agents/renegotiation.py` | Handles salary/benefits negotiation | No |
| 12 | Onboarding | `agents/onboarding.py` | Triggers post-hire onboarding workflow | No |

---

## 🔄 LangGraph Workflow

The complete hiring pipeline is implemented as a LangGraph `StateGraph` with conditional edges, HITL interrupts, and loop-back paths.

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
- `interrupt_before=["sourcing"]` — JD must be approved before posting
- Candidate shortlist review via API

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 22+
- Docker + Docker Compose (optional)

### 1. Clone & Configure

```bash
git clone https://github.com/Malleshappa-Patil/ai-hiring-chatbot.git
cd ai-hiring-chatbot
cp .env.example .env
# Edit .env and add your GOOGLE_API_KEY, DB credentials, SMTP settings
```

### 2. Run with Docker Compose

```bash
docker-compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| HireBoard (Candidate Portal) | http://localhost:8001 |

### 3. Run Locally (Development)

**Backend:**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload   # port 8000
```

**HireBoard (Candidate-Facing Portal):**
```bash
python hiring-platform/server.py   # port 8001
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev                        # port 5173
```

---

## 📁 Project Structure

```
ai-hiring-chatbot/
├── backend/
│   ├── agents/                 # 12 LangGraph agent nodes
│   │   ├── supervisor.py       #   Workflow router
│   │   ├── planning.py         #   Goal → execution plan
│   │   ├── jd_agent.py         #   JD generation
│   │   ├── sourcing.py         #   Job posting
│   │   ├── monitoring.py       #   Application monitoring + JD optimization
│   │   ├── screening.py        #   Resume screening
│   │   ├── interview.py        #   Interview scheduling + conduct
│   │   ├── communication.py    #   Rejection emails
│   │   ├── offer_management.py #   Offer letter generation
│   │   ├── renegotiation.py    #   Salary/benefits negotiation
│   │   └── onboarding.py       #   Post-hire onboarding
│   ├── workflows/
│   │   ├── graph.py            # LangGraph StateGraph (compiled)
│   │   └── state.py            # HiringState TypedDict definition
│   ├── services/
│   │   ├── workflow_service.py      # Workflow orchestration
│   │   ├── cv_screening_service.py  # Gemini CV scoring + guardrails
│   │   ├── notification_service.py  # Email service (SMTP / mock)
│   │   ├── google_meet_service.py   # Meet link generation
│   │   └── resume_parser.py         # PDF text extraction
│   ├── rag/
│   │   └── documents/          # RAG knowledge base documents
│   ├── memory/
│   │   ├── short_term.py       # Redis async client
│   │   ├── long_term.py        # PostgreSQL query layer
│   │   └── vector_store.py     # ChromaDB wrapper
│   ├── database/
│   │   ├── models.py           # 11 SQLAlchemy ORM tables
│   │   ├── session.py          # Async engine + session factory
│   │   └── migrations/         # Alembic migrations
│   ├── api/
│   │   ├── dependencies.py     # Auth dependency injection
│   │   └── v1/                 # 8 API routers
│   ├── auth/
│   │   ├── jwt_handler.py      # JWT token creation/verification
│   │   └── password.py         # bcrypt hashing
│   ├── models/
│   │   ├── request_models.py   # Pydantic request schemas
│   │   └── response_models.py  # Pydantic response schemas
│   ├── config.py               # Pydantic Settings (env-based)
│   ├── main.py                 # FastAPI app + lifespan + middleware
│   ├── requirements.txt        # Python dependencies
│   └── Dockerfile
├── frontend/
│   └── src/
│       ├── api/                # Axios API client modules
│       ├── components/         # Layout, Sidebar, Chatbot, Charts
│       ├── pages/              # 7 page components
│       ├── types/              # TypeScript interfaces
│       └── hooks/              # React Query hooks
├── hiring-platform/            # Candidate-facing job board (port 8001)
│   ├── server.py               # Standalone FastAPI server
│   ├── index.html
│   ├── style.css
│   └── app.js
├── docker-compose.yml
└── workflow.md                 # Detailed architecture reference
```

---

## 🌐 API Routers

| Router | Prefix | Purpose |
|---|---|---|
| Auth | `/api/v1/auth` | JWT login, register, user management |
| Jobs | `/api/v1/jobs` | CRUD jobs, JD approval |
| Candidates | `/api/v1/candidates` | Resume upload, scoring, status |
| Workflow | `/api/v1/workflow` | Start/advance/status workflows |
| Interviews | `/api/v1/interviews` | Schedule, manage interviews |
| Onboarding | `/api/v1/onboarding` | Onboarding task management |
| Analytics | `/api/v1/analytics` | Hiring metrics & reporting |
| AI Chatbot | `/api/v1/chatbot` | Conversational hiring assistant |

---

## 📊 Frontend Pages

| Page | Route | Description |
|---|---|---|
| Login | `/login` | JWT authentication |
| Dashboard | `/dashboard` | Metrics overview + agent status |
| Job Management | `/jobs` | Create jobs, review & approve JDs |
| Candidates | `/candidates` | AI-ranked candidate list with scores |
| Workflow Monitor | `/workflow` | Real-time agent pipeline visualization |
| Analytics | `/analytics` | Funnel metrics + hiring trend charts |
| Onboarding | `/onboarding` | Post-hire task tracker |

The **AI Chatbot** is accessible as a floating component across all authenticated pages.

---

## 🗄️ Database Design

**PostgreSQL** — 11 SQLAlchemy ORM tables

| Table | Purpose |
|---|---|
| `users` | Recruiters, hiring managers, admins |
| `jobs` | Job postings with hiring goals |
| `job_descriptions` | Versioned JDs with approval tracking |
| `candidates` | Applicant records linked to jobs |
| `resumes` | Uploaded resume files + parsed data |
| `candidate_scores` | AI screening scores + match categories |
| `interviews` | Scheduled interviews with Meet links |
| `workflow_states` | LangGraph workflow state + agent status |
| `agent_logs` | Agent execution logs (latency, tokens) |
| `onboarding_tasks` | Post-hire task tracking |
| `analytics` | Hiring metrics (funnel, conversion) |

---

## 🧠 Memory Architecture

### Short-Term Memory
**Redis** — Maintains active workflow state with TTL expiry (fail-safe, degrades gracefully if Redis is down).
- Current workflow stage, candidate progress, interview status, pending approvals

### Long-Term Memory
**PostgreSQL** — Stores historical hiring data for RAG and analytics.
- Previous hiring campaigns, candidate outcomes, approved JDs, recruiter preferences

### Vector Store
**ChromaDB** with HuggingFace `all-MiniLM-L6-v2` embeddings — Semantic similarity search for RAG retrieval.

---

## 🔐 Authentication

- **JWT** (access + refresh tokens)
- **bcrypt** password hashing
- **RBAC** (Role-Based Access Control)

**Roles:**
- `recruiter` — Create jobs, manage candidates
- `hiring_manager` — Approve JDs, review candidates
- `admin` — Full access

**Default credentials (dev):** `admin@hiring.com` / `admin123`

---

## 🔗 External Integrations

| Tool | Status | Notes |
|---|---|---|
| Google Gemini | ✅ Live | `gemini-2.5-flash` for all LLM tasks |
| HuggingFace | ✅ Live | `all-MiniLM-L6-v2` embeddings |
| ChromaDB | ✅ Live | Vector store persisted at `./chroma_db` |
| fastapi-mail | ✅ Live | SMTP email (Gmail); toggle `MAIL_MOCK` for dev |
| Google Meet | ⚙️ Optional | Real links via service account; placeholder by default |
| LangSmith | ✅ Live | Tracing, latency, token usage |
| LinkedIn API | 🔲 Mock | Simulated job posting |
| Naukri API | 🔲 Mock | Simulated job posting |
| Indeed API | 🔲 Mock | Simulated job posting |
| HRMS | 🔲 Mock | Simulated onboarding system |

---

## 📡 Observability

Implemented via **LangSmith** integration.

Tracked:
- Agent execution logs (per-node)
- Tool calls, latency (ms), token usage
- Failures & errors
- Full workflow traces (pipeline-level)

Agent logs are also persisted to the `agent_logs` PostgreSQL table.

---

## 🐳 Deployment

### Docker Compose

| Service | Image / Build | Port |
|---|---|---|
| PostgreSQL | `postgres:15-alpine` | 5432 |
| Redis | `redis:7-alpine` | 6379 |
| Backend | `./backend/Dockerfile` | 8000 |
| Frontend | `./frontend/Dockerfile` | 5173 |

Volumes: `postgres_data`, `redis_data`, `chroma_data`, `upload_data`

```bash
docker-compose up --build
```

---

## 🛠️ Skills Demonstrated

- Agentic AI & Multi-Agent Systems (12 specialized agents)
- LangGraph (State Graphs, Conditional Edges, HITL Interrupts)
- Google Gemini Integration
- RAG Architecture (LangChain + ChromaDB + HuggingFace)
- Prompt-Injection Security
- Tool Calling & LLM Orchestration
- Memory Systems (Redis + PostgreSQL)
- FastAPI (async, middleware, dependency injection)
- React 18 + TypeScript + Vite + Tailwind CSS
- PostgreSQL (SQLAlchemy ORM, async)
- Redis & Docker + Docker Compose
- JWT Authentication + RBAC
- Email Automation (fastapi-mail)
- Google Meet Integration
- LangSmith Observability
- Production AI Engineering

---

## 📡 API Documentation

Run the backend and visit: **http://localhost:8000/docs**
