"""
Database session configuration.
Provides async SQLAlchemy engine and session factory.
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from backend.config import settings

# Async engine for FastAPI endpoints
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""
    pass


async def init_db():
    """Create all tables on startup (development only; use Alembic in production)."""
    async with engine.begin() as conn:
        # Import models to register them with Base
        from backend.database import models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
        
        # Ensure target_candidate_count column exists
        from sqlalchemy import text
        try:
            await conn.execute(text("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS target_candidate_count INTEGER DEFAULT 3;"))
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to add target_candidate_count column: {e}")



async def get_db():
    """FastAPI dependency: yields an async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
