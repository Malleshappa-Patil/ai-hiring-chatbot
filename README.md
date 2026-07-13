# Enterprise Multi-Agent Recruitment Automation Platform

> **Production-grade autonomous hiring orchestration platform** — not a chatbot.
> Takes a high-level goal ("Hire a Senior Backend Engineer") and autonomously runs the complete recruitment lifecycle using LangGraph agents, Google Gemini, RAG, and Human-in-the-Loop workflows.

--- 

## 🏗️ Architecture
 
| Layer | Technology |
|---|---|
| AI Orchestration | LangGraph (multi-agent graph) |
| LLM | Google Gemini (`gemini-1.5-pro`) |
| Embeddings | HuggingFace `sentence-transformers/all-MiniLM-L6-v2` |
| RAG | LangChain + ChromaDB |
| Resume Parsing | PyMuPDF + Unstructured |
| Backend | FastAPI + Python 3.11 |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Short-Term Memory | Redis |
| Long-Term Memory | PostgreSQL 15 |
| Email | fastapi-mail |
| Observability | LangSmith |
| Containerization | Docker + Docker Compose |

---

## 🤖 Agents

| Agent | Role | HITL |
|---|---|---|
| Supervisor | Entry point, delegates tasks | No |
| Planning | Converts goal → execution plan | No |
| JD Agent | Generates job descriptions | ✅ Approve/Reject |
| Sourcing | Posts jobs to LinkedIn/Naukri/Indeed (mock) | No |
| Monitoring | Tracks funnel, auto-retries if low | No |
| Screening | Parses & ranks resumes via RAG | ✅ Human Review |
| Interview | Schedules interviews via Calendar (mock) | No |
| Onboarding | Triggers post-hire workflow | No |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 22+
- Docker + Docker Compose

### 1. Clone & Configure

```bash
git clone <repo>
cd ai-hiring-chatbot
cp .env.example .env
# Edit .env and add your GOOGLE_API_KEY
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

### 3. Run Locally (Development)

**Backend:**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## 📁 Project Structure

```
ai-hiring-chatbot/
├── backend/
│   ├── agents/          # 8 LangGraph agents
│   ├── workflows/       # LangGraph state machine
│   ├── tools/           # LLM, RAG, parsers, mock APIs
│   ├── rag/             # ChromaDB + HuggingFace embeddings
│   ├── memory/          # Redis + PostgreSQL memory
│   ├── database/        # SQLAlchemy models + migrations
│   ├── api/v1/          # FastAPI route handlers
│   ├── services/        # Business logic services
│   ├── auth/            # JWT + bcrypt + RBAC
│   ├── models/          # Pydantic schemas
│   └── main.py          # App entrypoint
└── frontend/
    └── src/
        ├── api/         # Axios API client
        ├── components/  # Reusable components
        ├── pages/       # 7 page components
        ├── types/       # TypeScript interfaces
        └── hooks/       # React Query hooks
```

---

## 🔐 Authentication

**Roles:**
- `recruiter` — Create jobs, manage candidates
- `hiring_manager` — Approve JDs, review candidates
- `admin` — Full access

**Default credentials (dev):** `admin@hiring.com` / `admin123`

---

## 📊 Frontend Pages

| Page | Route | Description |
|---|---|---|
| Dashboard | `/dashboard` | Metrics overview + agent status |
| Job Management | `/jobs` | Create jobs, review & approve JDs |
| Candidates | `/candidates` | AI-ranked candidate list |
| Workflow Monitor | `/workflow` | Real-time agent pipeline status |
| Analytics | `/analytics` | Funnel metrics + trends charts |
| Onboarding | `/onboarding` | Post-hire task tracker |
| Login | `/login` | JWT authentication |

---

## 🏗️ Build Phases

- ✅ **Phase 1** — Project Scaffolding (complete)
- 🔲 **Phase 2** — Database + Auth
- 🔲 **Phase 3** — Agent & Workflow Layer (LangGraph)
- 🔲 **Phase 4** — RAG + Memory (ChromaDB + Redis)
- 🔲 **Phase 5** — API & Services
- 🔲 **Phase 6** — Frontend polish + integration

---

## 📡 API Documentation

Run the backend and visit: **http://localhost:8000/docs**
