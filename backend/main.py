"""
FastAPI application entrypoint.
Configures the app, CORS, routers, and startup/shutdown events.
"""
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from backend.config import settings

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# Set LangSmith env vars before any LangChain imports
os.environ["LANGCHAIN_TRACING_V2"] = str(settings.LANGCHAIN_TRACING_V2).lower()
os.environ["LANGCHAIN_API_KEY"] = settings.LANGCHAIN_API_KEY
os.environ["LANGCHAIN_PROJECT"] = settings.LANGCHAIN_PROJECT
os.environ["LANGCHAIN_ENDPOINT"] = settings.LANGCHAIN_ENDPOINT
os.environ["GOOGLE_API_KEY"] = settings.GOOGLE_API_KEY


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown event handler."""
    logger.info(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"   Environment : {settings.ENVIRONMENT}")
    logger.info(f"   Gemini Model: {settings.GEMINI_MODEL}")
    logger.info(f"   Embeddings  : {settings.EMBEDDING_MODEL}")

    # Import here to avoid circular imports and trigger DB init
    from backend.database.session import init_db
    await init_db()
    logger.info("✅ Database initialized")

    yield

    logger.info("🔴 Shutting down AI Hiring Platform...")


# ── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Enterprise Multi-Agent Recruitment Automation Platform. "
        "Automates the complete hiring lifecycle using LangGraph, "
        "Google Gemini, RAG, and Human-in-the-Loop workflows."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ── Routers ───────────────────────────────────────────────────────────────────
from backend.api.v1 import auth, jobs, candidates, workflow, interviews, onboarding, analytics  # noqa: E402

app.include_router(auth.router,        prefix=settings.API_PREFIX, tags=["Authentication"])
app.include_router(jobs.router,        prefix=settings.API_PREFIX, tags=["Jobs"])
app.include_router(candidates.router,  prefix=settings.API_PREFIX, tags=["Candidates"])
app.include_router(workflow.router,    prefix=settings.API_PREFIX, tags=["Workflow"])
app.include_router(interviews.router,  prefix=settings.API_PREFIX, tags=["Interviews"])
app.include_router(onboarding.router,  prefix=settings.API_PREFIX, tags=["Onboarding"])
app.include_router(analytics.router,   prefix=settings.API_PREFIX, tags=["Analytics"])


# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/", tags=["Root"])
async def root():
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "docs": "/docs",
        "health": "/health",
    }
