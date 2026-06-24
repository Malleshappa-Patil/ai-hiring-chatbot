"""Analytics API: dashboard metrics, hiring funnel, trends."""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.session import get_db
from backend.database.models import User
from backend.api.dependencies import get_current_user
from backend.memory.long_term import long_term
from backend.models.response_models import (
    DashboardMetricsResponse, FunnelDataResponse, HiringTrendResponse
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics")


@router.get("/dashboard", response_model=DashboardMetricsResponse)
async def get_dashboard_metrics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Aggregate key hiring KPIs from the database."""
    metrics = await long_term.get_dashboard_metrics(db)
    return metrics


@router.get("/funnel", response_model=list[FunnelDataResponse])
async def get_hiring_funnel(
    job_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get candidate counts and conversion rates at each pipeline stage."""
    return await long_term.get_hiring_funnel(db, job_id=job_id)


@router.get("/trends", response_model=list[HiringTrendResponse])
async def get_hiring_trends(
    months: int = Query(6, ge=1, le=24),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get monthly hiring trends: applications, shortlisted, hired."""
    return await long_term.get_hiring_trends(db, months=months)
