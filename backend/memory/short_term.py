"""
Redis client for short-term workflow memory.
Stores active workflow state, pending approvals, and agent statuses.
Redis is OPTIONAL — all operations degrade gracefully if Redis is unavailable.
"""
import json
import logging
from typing import Any, Optional
import redis.asyncio as redis

from backend.config import settings

logger = logging.getLogger(__name__)


class ShortTermMemory:
    """Async Redis client wrapping workflow state operations.
    All methods are fail-safe: if Redis is down they log a warning and return
    sensible defaults so the rest of the application keeps working."""

    def __init__(self):
        self._client: Optional[redis.Redis] = None

    async def client(self) -> redis.Redis:
        if self._client is None:
            self._client = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=1,
            )
        return self._client

    async def ping(self) -> bool:
        try:
            r = await self.client()
            return await r.ping()
        except Exception as e:
            logger.warning(f"Redis unavailable (ping failed): {e}")
            return False

    # ── Generic Key/Value ──────────────────────────────────────────
    async def set(self, key: str, value: Any, ttl_seconds: int = 3600) -> None:
        try:
            r = await self.client()
            serialized = json.dumps(value) if not isinstance(value, str) else value
            await r.set(key, serialized, ex=ttl_seconds)
        except Exception as e:
            logger.warning(f"Redis SET skipped (key={key}): {e}")

    async def get(self, key: str) -> Optional[Any]:
        try:
            r = await self.client()
            value = await r.get(key)
            if value is None:
                return None
            try:
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                return value
        except Exception as e:
            logger.warning(f"Redis GET skipped (key={key}): {e}")
            return None

    async def delete(self, key: str) -> None:
        try:
            r = await self.client()
            await r.delete(key)
        except Exception as e:
            logger.warning(f"Redis DELETE skipped (key={key}): {e}")

    async def exists(self, key: str) -> bool:
        try:
            r = await self.client()
            return bool(await r.exists(key))
        except Exception as e:
            logger.warning(f"Redis EXISTS skipped (key={key}): {e}")
            return False

    # ── Workflow State ─────────────────────────────────────────────
    async def set_workflow_state(self, job_id: str, state: dict, ttl: int = 86400) -> None:
        """Store active LangGraph workflow state for a job."""
        await self.set(f"workflow:state:{job_id}", state, ttl)

    async def get_workflow_state(self, job_id: str) -> Optional[dict]:
        return await self.get(f"workflow:state:{job_id}")

    async def delete_workflow_state(self, job_id: str) -> None:
        await self.delete(f"workflow:state:{job_id}")

    # ── Pending Approvals ──────────────────────────────────────────
    async def set_pending_approval(self, job_id: str, approval_type: str, data: dict) -> None:
        """Flag a workflow as waiting for human approval."""
        await self.set(
            f"approval:pending:{job_id}:{approval_type}",
            {"status": "pending", "type": approval_type, **data},
            ttl_seconds=86400,
        )

    async def get_pending_approval(self, job_id: str, approval_type: str) -> Optional[dict]:
        return await self.get(f"approval:pending:{job_id}:{approval_type}")

    async def resolve_approval(self, job_id: str, approval_type: str, decision: str) -> None:
        """Mark an approval as resolved (approved/rejected)."""
        key = f"approval:pending:{job_id}:{approval_type}"
        current = await self.get(key)
        if current:
            current["status"] = decision
            await self.set(key, current, ttl_seconds=3600)

    async def clear_approval(self, job_id: str, approval_type: str) -> None:
        await self.delete(f"approval:pending:{job_id}:{approval_type}")

    # ── Agent Status Cache ─────────────────────────────────────────
    async def set_agent_status(self, job_id: str, agent: str, status: str) -> None:
        await self.set(f"agent:status:{job_id}:{agent}", status, ttl_seconds=3600)

    async def get_all_agent_statuses(self, job_id: str) -> dict[str, str]:
        try:
            r = await self.client()
            pattern = f"agent:status:{job_id}:*"
            keys = await r.keys(pattern)
            if not keys:
                return {}
            values = await r.mget(*keys)
            return {
                k.split(":")[-1]: v
                for k, v in zip(keys, values)
                if v is not None
            }
        except Exception as e:
            logger.warning(f"Redis get_all_agent_statuses skipped: {e}")
            return {}

    # ── Session / Rate Limiting ────────────────────────────────────
    async def set_user_session(self, user_id: str, data: dict) -> None:
        await self.set(f"session:{user_id}", data, ttl_seconds=3600)

    async def get_user_session(self, user_id: str) -> Optional[dict]:
        return await self.get(f"session:{user_id}")

    async def close(self) -> None:
        try:
            if self._client:
                await self._client.aclose()
                self._client = None
        except Exception as e:
            logger.warning(f"Redis close failed: {e}")


# Singleton instance
memory = ShortTermMemory()
