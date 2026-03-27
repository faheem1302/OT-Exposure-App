"""
db/connection.py
Async PostgreSQL connection pool management using asyncpg.
Reads configuration from pydantic-settings config.
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

import asyncpg
from loguru import logger

from app.config import settings

# Module-level pool singleton
_pool: Optional[asyncpg.Pool] = None
_pool_lock = asyncio.Lock()


def _build_dsn() -> str:
    """Build PostgreSQL DSN from settings."""
    return (
        f"postgresql://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}"
        f"@{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"
    )


async def get_pool() -> asyncpg.Pool:
    """
    Return the existing connection pool or create a new one.
    Thread-safe via asyncio.Lock — safe for concurrent startup.

    Pool settings tuned for a dashboard workload:
      - min_size=5  : keep warm connections ready
      - max_size=20 : cap concurrency to avoid overwhelming Postgres
      - command_timeout=60 : fail slow queries quickly
    """
    global _pool

    if _pool is not None:
        return _pool

    async with _pool_lock:
        # Double-checked locking — another coroutine may have initialised while
        # we were waiting for the lock.
        if _pool is not None:
            return _pool

        dsn = _build_dsn()
        logger.info(
            "Initialising asyncpg connection pool "
            f"(host={settings.POSTGRES_HOST}, db={settings.POSTGRES_DB})"
        )

        _pool = await asyncpg.create_pool(
            dsn=dsn,
            min_size=5,
            max_size=20,
            command_timeout=60,
            # Return JSON columns as plain strings so we control deserialisation
            init=_init_connection,
        )

        logger.info("asyncpg connection pool ready.")
        return _pool


async def _init_connection(conn: asyncpg.Connection) -> None:
    """
    Per-connection initialisation hook called by asyncpg for every new
    physical connection in the pool.

    We register a custom codec so that JSONB columns come back as Python
    strings (json.loads is called explicitly in the application layer).
    """
    await conn.set_type_codec(
        "jsonb",
        encoder=str,
        decoder=str,
        schema="pg_catalog",
        format="text",
    )
    await conn.set_type_codec(
        "json",
        encoder=str,
        decoder=str,
        schema="pg_catalog",
        format="text",
    )


async def close_pool() -> None:
    """
    Gracefully close all connections in the pool.
    Should be called during application shutdown.
    """
    global _pool

    if _pool is None:
        logger.debug("close_pool() called but pool was never initialised — skipping.")
        return

    logger.info("Closing asyncpg connection pool…")
    await _pool.close()
    _pool = None
    logger.info("asyncpg connection pool closed.")


@asynccontextmanager
async def get_connection() -> AsyncGenerator[asyncpg.Connection, None]:
    """
    Async context manager that acquires a connection from the pool and
    releases it automatically on exit.

    Usage::

        async with get_connection() as conn:
            rows = await conn.fetch("SELECT 1")

    Raises:
        asyncpg.PostgresError: on any database error (propagated to caller).
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn


async def check_connection() -> bool:
    """
    Lightweight liveness check — executes ``SELECT 1`` and returns True on
    success or False on any error.  Used by the /ready health endpoint.
    """
    try:
        async with get_connection() as conn:
            await conn.fetchval("SELECT 1")
        return True
    except Exception as exc:  # noqa: BLE001
        logger.error(f"Database liveness check failed: {exc}")
        return False
