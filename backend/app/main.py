"""
app/main.py
FastAPI application entry point for the OT/ICS Cybersecurity Exposure Dashboard.

Features
--------
- Async lifespan: initialises and tears down the asyncpg connection pool.
- CORS middleware configured from Settings.CORS_ORIGINS.
- SlowAPI rate limiter (100 requests/minute by default, applied globally).
- Loguru structured logging with uvicorn log interception.
- Health (/health) and readiness (/ready) probes.
- OpenAPI documentation with rich tag metadata.
"""

from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import Depends, FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.auth import verify_api_key
from app.config import settings
from app.routers import exposures, gcc_exposure, map, risk, search, spidersilk, stats
from db.connection import check_connection, close_pool, get_pool

# ---------------------------------------------------------------------------
# Loguru — intercept standard-library logging used by uvicorn / asyncpg
# ---------------------------------------------------------------------------

class _InterceptHandler(logging.Handler):
    """Route stdlib log records through loguru."""

    def emit(self, record: logging.LogRecord) -> None:
        # Find the caller's frame so loguru shows the correct source location
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = str(record.levelno)

        frame, depth = sys._getframe(6), 6
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back  # type: ignore[assignment]
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())


def _setup_logging() -> None:
    """Configure loguru and intercept uvicorn / asyncpg stdlib loggers."""
    # Remove the default loguru sink and add a structured one
    logger.remove()
    logger.add(
        sys.stdout,
        level="INFO",
        format=(
            "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> — "
            "<level>{message}</level>"
        ),
        colorize=True,
        enqueue=True,  # thread-safe
    )

    # Intercept uvicorn and asyncpg log output
    intercept = _InterceptHandler()
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access", "asyncpg"):
        log = logging.getLogger(name)
        log.handlers = [intercept]
        log.propagate = False


# ---------------------------------------------------------------------------
# Rate limiter
# ---------------------------------------------------------------------------

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100/minute"],
)


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage application lifecycle: startup → yield → shutdown."""
    _setup_logging()
    logger.info(
        "Starting OT/ICS Cybersecurity Exposure Dashboard "
        f"(host={settings.API_HOST}, port={settings.API_PORT})"
    )

    # Startup: initialise DB pool
    try:
        pool = await get_pool()
        logger.info(f"Database pool ready (min=5, max=20, db={settings.POSTGRES_DB})")
    except Exception as exc:
        logger.critical(f"Failed to initialise database pool: {exc}")
        raise

    yield  # Application runs here

    # Shutdown: close DB pool
    logger.info("Shutting down — closing database pool…")
    await close_pool()
    logger.info("Shutdown complete.")


# ---------------------------------------------------------------------------
# OpenAPI tag metadata
# ---------------------------------------------------------------------------

TAGS_METADATA = [
    {
        "name": "Map",
        "description": (
            "Geographic exposure data for map visualisation. "
            "Returns MapPoint and ClusterPoint objects suitable for Leaflet / MapboxGL."
        ),
    },
    {
        "name": "Statistics",
        "description": (
            "Aggregated statistics for dashboard charts: "
            "summary KPIs, category/city/port breakdowns, and timeline data."
        ),
    },
    {
        "name": "Exposures",
        "description": (
            "Full CRUD-style access to individual exposure records with "
            "pagination, filtering, sorting, and CSV export."
        ),
    },
    {
        "name": "Risk",
        "description": (
            "Risk-assessment endpoints: organisation leaderboard, "
            "critical IPs with known CVEs, and a composite dataset risk score."
        ),
    },
    {
        "name": "GCC Exposure",
        "description": (
            "Modbus TCP (port 502) exposure breakdown by country "
            "for GCC nations (AE, KW, QA, SA, OM) and Jordan (JO)."
        ),
    },
    {
        "name": "Search",
        "description": (
            "Natural-language query interface: converts plain-English questions "
            "into PostgreSQL SELECT statements via Claude AI, then executes them "
            "against the shodan_exposures table."
        ),
    },
    {
        "name": "SpiderSilk",
        "description": (
            "SpiderSilk asset exposure data: paginated asset list, "
            "dataset KPIs, and breakdowns by country, service, and port."
        ),
    },
    {
        "name": "Health",
        "description": "Liveness and readiness probes for container orchestration.",
    },
]


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="OT/ICS Cybersecurity Exposure Dashboard",
    description=(
        "Production-ready REST API for tracking and analysing the cybersecurity "
        "exposure of Operational Technology (OT) and Industrial Control System (ICS) "
        "devices discovered by Shodan. Provides geographic, statistical, and "
        "risk-assessment views over the collected exposure data."
    ),
    version="1.0.0",
    lifespan=lifespan,
    openapi_tags=TAGS_METADATA,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    dependencies=[Depends(verify_api_key)],
)

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# SlowAPI rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(map.router)
app.include_router(stats.router)
app.include_router(exposures.router)
app.include_router(risk.router)
app.include_router(gcc_exposure.router)
app.include_router(spidersilk.router)
app.include_router(search.router)


# ---------------------------------------------------------------------------
# Health probes
# ---------------------------------------------------------------------------

@app.get(
    "/health",
    tags=["Health"],
    summary="Liveness probe",
    response_description="Always returns 200 OK if the process is running.",
    dependencies=[],  # exempt from API key check
)
async def health() -> dict:
    """Kubernetes / Docker liveness probe — always returns OK."""
    return {"status": "ok"}


@app.get(
    "/ready",
    tags=["Health"],
    summary="Readiness probe",
    response_description="Returns 200 if the database is reachable, 503 otherwise.",
    dependencies=[],  # exempt from API key check
)
async def ready(request: Request) -> JSONResponse:
    """
    Kubernetes / Docker readiness probe.
    Performs a lightweight DB connectivity check before marking the pod ready.
    """
    db_ok = await check_connection()
    if db_ok:
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"status": "ready", "database": "connected"},
        )
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"status": "not_ready", "database": "unreachable"},
    )


# ---------------------------------------------------------------------------
# Entry point (for direct execution — prefer uvicorn CLI in production)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=False,
    )
