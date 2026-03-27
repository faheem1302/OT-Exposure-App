"""
app/routers/stats.py
Statistics endpoints for the OT/ICS Cybersecurity Exposure Dashboard.

Endpoints
---------
GET /api/stats/summary      — high-level KPIs (StatsSummary)
GET /api/stats/by-category  — exposure count per OT/ICS protocol (List[CategoryStat])
GET /api/stats/by-city      — exposure count per city (List[CityStat])
GET /api/stats/by-port      — top-20 ports by exposure count (List[PortStat])
GET /api/stats/by-product   — top products by exposure count (List[ProductStat])
GET /api/stats/timeline     — daily exposure counts (List[TimelineStat])
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, Request, status
from loguru import logger
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.schemas.exposure import (
    CategoryStat,
    CityStat,
    PortStat,
    ProductStat,
    StatsSummary,
    TimelineStat,
)
from db.connection import get_connection

router = APIRouter(
    prefix="/api/stats",
    tags=["Statistics"],
)

limiter = Limiter(key_func=get_remote_address)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

async def _fetchval(sql: str, *args) -> int:
    """Execute a scalar query and return the integer result (default 0)."""
    async with get_connection() as conn:
        result = await conn.fetchval(sql, *args)
    return int(result or 0)


# ---------------------------------------------------------------------------
# GET /api/stats/summary
# ---------------------------------------------------------------------------

@router.get(
    "/summary",
    response_model=StatsSummary,
    summary="Dashboard KPI summary",
    description="Returns high-level key performance indicators for the dashboard header.",
)
@limiter.limit("100/minute")
async def get_summary(request: Request) -> StatsSummary:
    """Aggregate-level statistics across all exposure records."""

    sql_total = "SELECT COUNT(*) FROM shodan_exposures"
    sql_unique_ips = "SELECT COUNT(DISTINCT ip_str) FROM shodan_exposures"
    sql_unique_orgs = "SELECT COUNT(DISTINCT org) FROM shodan_exposures WHERE org IS NOT NULL"
    sql_top_city = (
        "SELECT city FROM shodan_exposures "
        "WHERE city IS NOT NULL "
        "GROUP BY city ORDER BY COUNT(*) DESC LIMIT 1"
    )
    sql_top_category = (
        "SELECT api FROM shodan_exposures "
        "WHERE api IS NOT NULL "
        "GROUP BY api ORDER BY COUNT(*) DESC LIMIT 1"
    )

    try:
        async with get_connection() as conn:
            total_exposures = int((await conn.fetchval(sql_total)) or 0)
            unique_ips = int((await conn.fetchval(sql_unique_ips)) or 0)
            unique_orgs = int((await conn.fetchval(sql_unique_orgs)) or 0)
            top_city = await conn.fetchval(sql_top_city)
            top_category = await conn.fetchval(sql_top_category)
    except Exception as exc:
        logger.error(f"stats/summary query failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve statistics summary.",
        )

    return StatsSummary(
        total_exposures=total_exposures,
        unique_ips=unique_ips,
        unique_orgs=unique_orgs,
        top_city=top_city,
        top_category=top_category,
    )


# ---------------------------------------------------------------------------
# GET /api/stats/by-category
# ---------------------------------------------------------------------------

@router.get(
    "/by-category",
    response_model=List[CategoryStat],
    summary="Exposures by OT/ICS protocol",
    description=(
        "Returns exposure counts grouped by OT/ICS protocol/API category, "
        "ordered by count descending."
    ),
)
@limiter.limit("100/minute")
async def get_by_category(
    request: Request,
    limit: int = Query(50, ge=1, le=200, description="Maximum categories to return"),
) -> List[CategoryStat]:
    """Exposure count per OT/ICS protocol category."""

    sql = """
        SELECT
            api,
            COUNT(*)::int AS count
        FROM shodan_exposures
        GROUP BY api
        ORDER BY count DESC
        LIMIT $1
    """

    try:
        async with get_connection() as conn:
            rows = await conn.fetch(sql, limit)
    except Exception as exc:
        logger.error(f"stats/by-category query failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve category statistics.",
        )

    return [CategoryStat(api=row["api"], count=row["count"]) for row in rows]


# ---------------------------------------------------------------------------
# GET /api/stats/by-city
# ---------------------------------------------------------------------------

@router.get(
    "/by-city",
    response_model=List[CityStat],
    summary="Exposures by city",
    description="Returns exposure counts grouped by city, ordered by count descending.",
)
@limiter.limit("100/minute")
async def get_by_city(
    request: Request,
    limit: int = Query(50, ge=1, le=200, description="Maximum cities to return"),
    country_code: Optional[str] = Query(None, description="Filter by ISO 2-letter country code"),
) -> List[CityStat]:
    """Exposure count per city."""

    conditions = ["city IS NOT NULL"]
    params: list = []
    idx = 1

    if country_code:
        conditions.append(f"UPPER(country_code) = UPPER(${idx})")
        params.append(country_code)
        idx += 1

    where = "WHERE " + " AND ".join(conditions)
    params.append(limit)
    limit_placeholder = f"${idx}"

    sql = f"""
        SELECT
            city,
            COUNT(*)::int AS count
        FROM shodan_exposures
        {where}
        GROUP BY city
        ORDER BY count DESC
        LIMIT {limit_placeholder}
    """

    try:
        async with get_connection() as conn:
            rows = await conn.fetch(sql, *params)
    except Exception as exc:
        logger.error(f"stats/by-city query failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve city statistics.",
        )

    return [CityStat(city=row["city"], count=row["count"]) for row in rows]


# ---------------------------------------------------------------------------
# GET /api/stats/by-port
# ---------------------------------------------------------------------------

@router.get(
    "/by-port",
    response_model=List[PortStat],
    summary="Top ports by exposure count",
    description="Returns the top 20 ports ordered by exposure count descending.",
)
@limiter.limit("100/minute")
async def get_by_port(
    request: Request,
    limit: int = Query(20, ge=1, le=100, description="Maximum ports to return"),
) -> List[PortStat]:
    """Top ports by exposure count."""

    sql = """
        SELECT
            port,
            COUNT(*)::int AS count
        FROM shodan_exposures
        WHERE port IS NOT NULL
        GROUP BY port
        ORDER BY count DESC
        LIMIT $1
    """

    try:
        async with get_connection() as conn:
            rows = await conn.fetch(sql, limit)
    except Exception as exc:
        logger.error(f"stats/by-port query failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve port statistics.",
        )

    return [PortStat(port=row["port"], count=row["count"]) for row in rows]


# ---------------------------------------------------------------------------
# GET /api/stats/by-product
# ---------------------------------------------------------------------------

@router.get(
    "/by-product",
    response_model=List[ProductStat],
    summary="Top products by exposure count",
    description="Returns the top products/vendors ordered by exposure count descending.",
)
@limiter.limit("100/minute")
async def get_by_product(
    request: Request,
    limit: int = Query(20, ge=1, le=100, description="Maximum products to return"),
) -> List[ProductStat]:
    """Top products by exposure count."""

    sql = """
        SELECT
            product,
            COUNT(*)::int AS count
        FROM shodan_exposures
        WHERE product IS NOT NULL AND TRIM(product) <> ''
        GROUP BY product
        ORDER BY count DESC
        LIMIT $1
    """

    try:
        async with get_connection() as conn:
            rows = await conn.fetch(sql, limit)
    except Exception as exc:
        logger.error(f"stats/by-product query failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve product statistics.",
        )

    return [ProductStat(product=row["product"], count=row["count"]) for row in rows]


# ---------------------------------------------------------------------------
# GET /api/stats/timeline
# ---------------------------------------------------------------------------

@router.get(
    "/timeline",
    response_model=List[TimelineStat],
    summary="Daily exposure timeline",
    description=(
        "Returns the number of exposure records grouped by calendar date "
        "(UTC), ordered chronologically. Use for trend charts."
    ),
)
@limiter.limit("100/minute")
async def get_timeline(
    request: Request,
    days: int = Query(90, ge=1, le=730, description="Number of days of history to return"),
) -> List[TimelineStat]:
    """Daily exposure counts for the last *days* calendar days."""

    sql = """
        SELECT
            TO_CHAR(DATE(timestamp AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS date,
            COUNT(*)::int AS count
        FROM shodan_exposures
        WHERE timestamp IS NOT NULL
          AND timestamp >= NOW() - ($1 || ' days')::INTERVAL
        GROUP BY DATE(timestamp AT TIME ZONE 'UTC')
        ORDER BY DATE(timestamp AT TIME ZONE 'UTC') ASC
    """

    try:
        async with get_connection() as conn:
            rows = await conn.fetch(sql, str(days))
    except Exception as exc:
        logger.error(f"stats/timeline query failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve timeline statistics.",
        )

    return [TimelineStat(date=row["date"], count=row["count"]) for row in rows]
