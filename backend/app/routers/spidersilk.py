"""
app/routers/spidersilk.py
SpiderSilk asset exposure endpoints.

Endpoints
---------
GET /api/spidersilk/assets          — paginated asset list with filters
GET /api/spidersilk/summary         — dataset KPIs
GET /api/spidersilk/by-country      — asset count per country
GET /api/spidersilk/by-service      — asset count per service
GET /api/spidersilk/by-port         — asset count per port
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, Request, status
from loguru import logger
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.schemas.spidersilk import (
    SpiderSilkAsset,
    SpiderSilkCountryStat,
    SpiderSilkPortStat,
    SpiderSilkServiceStat,
    SpiderSilkSummary,
)
from db.connection import get_connection

router = APIRouter(
    prefix="/api/spidersilk",
    tags=["SpiderSilk"],
)

limiter = Limiter(key_func=get_remote_address)

_TABLE = "spidersilk_assets"


# ---------------------------------------------------------------------------
# GET /api/spidersilk/assets
# ---------------------------------------------------------------------------

@router.get(
    "/assets",
    response_model=List[SpiderSilkAsset],
    summary="List SpiderSilk assets",
    description=(
        "Returns a paginated list of SpiderSilk asset records. "
        "Optionally filter by country ISO code, service name, port, or tag."
    ),
)
@limiter.limit("100/minute")
async def list_assets(
    request: Request,
    country_iso: Optional[str] = Query(None, description="Filter by country ISO (e.g. AE)"),
    service: Optional[str] = Query(None, description="Filter by service name"),
    port: Optional[int] = Query(None, description="Filter by port"),
    tag: Optional[str] = Query(None, description="Filter by tag"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> List[SpiderSilkAsset]:
    conditions = []
    args: list = []
    idx = 1

    if country_iso:
        conditions.append(f"location_country_iso = ${idx}")
        args.append(country_iso.upper())
        idx += 1
    if service:
        conditions.append(f"service ILIKE ${idx}")
        args.append(f"%{service}%")
        idx += 1
    if port is not None:
        conditions.append(f"port = ${idx}")
        args.append(port)
        idx += 1
    if tag:
        conditions.append(f"tag ILIKE ${idx}")
        args.append(f"%{tag}%")
        idx += 1

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    sql = f"""
        SELECT * FROM {_TABLE}
        {where}
        ORDER BY ingested_at DESC
        LIMIT ${idx} OFFSET ${idx + 1}
    """
    args.extend([limit, offset])

    try:
        async with get_connection() as conn:
            rows = await conn.fetch(sql, *args)
    except Exception as exc:
        logger.error(f"spidersilk/assets query failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve SpiderSilk assets.",
        )

    return [SpiderSilkAsset(**dict(row)) for row in rows]


# ---------------------------------------------------------------------------
# GET /api/spidersilk/summary
# ---------------------------------------------------------------------------

@router.get(
    "/summary",
    response_model=SpiderSilkSummary,
    summary="SpiderSilk dataset summary",
)
@limiter.limit("100/minute")
async def get_summary(request: Request) -> SpiderSilkSummary:
    sql = f"""
        SELECT
            COUNT(*)                              AS total_assets,
            COUNT(DISTINCT ip)                    AS unique_ips,
            COUNT(DISTINCT service)               AS unique_services,
            (
                SELECT location_country_name
                FROM {_TABLE}
                WHERE location_country_name IS NOT NULL
                GROUP BY location_country_name
                ORDER BY COUNT(*) DESC
                LIMIT 1
            )                                     AS top_country,
            (
                SELECT service
                FROM {_TABLE}
                WHERE service IS NOT NULL
                GROUP BY service
                ORDER BY COUNT(*) DESC
                LIMIT 1
            )                                     AS top_service
        FROM {_TABLE};
    """

    try:
        async with get_connection() as conn:
            row = await conn.fetchrow(sql)
    except Exception as exc:
        logger.error(f"spidersilk/summary query failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve SpiderSilk summary.",
        )

    return SpiderSilkSummary(
        total_assets=row["total_assets"] or 0,
        unique_ips=row["unique_ips"] or 0,
        unique_services=row["unique_services"] or 0,
        top_country=row["top_country"],
        top_service=row["top_service"],
    )


# ---------------------------------------------------------------------------
# GET /api/spidersilk/by-country
# ---------------------------------------------------------------------------

@router.get(
    "/by-country",
    response_model=List[SpiderSilkCountryStat],
    summary="Asset count per country",
)
@limiter.limit("100/minute")
async def by_country(request: Request) -> List[SpiderSilkCountryStat]:
    sql = f"""
        SELECT location_country_iso, location_country_name, COUNT(*) AS count
        FROM {_TABLE}
        GROUP BY location_country_iso, location_country_name
        ORDER BY count DESC;
    """

    try:
        async with get_connection() as conn:
            rows = await conn.fetch(sql)
    except Exception as exc:
        logger.error(f"spidersilk/by-country query failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve country breakdown.",
        )

    return [
        SpiderSilkCountryStat(
            location_country_iso=row["location_country_iso"],
            location_country_name=row["location_country_name"],
            count=row["count"],
        )
        for row in rows
    ]


# ---------------------------------------------------------------------------
# GET /api/spidersilk/by-service
# ---------------------------------------------------------------------------

@router.get(
    "/by-service",
    response_model=List[SpiderSilkServiceStat],
    summary="Asset count per service",
)
@limiter.limit("100/minute")
async def by_service(
    request: Request,
    limit: int = Query(default=20, ge=1, le=100),
) -> List[SpiderSilkServiceStat]:
    sql = f"""
        SELECT service, COUNT(*) AS count
        FROM {_TABLE}
        WHERE service IS NOT NULL
        GROUP BY service
        ORDER BY count DESC
        LIMIT $1;
    """

    try:
        async with get_connection() as conn:
            rows = await conn.fetch(sql, limit)
    except Exception as exc:
        logger.error(f"spidersilk/by-service query failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve service breakdown.",
        )

    return [SpiderSilkServiceStat(service=row["service"], count=row["count"]) for row in rows]


# ---------------------------------------------------------------------------
# GET /api/spidersilk/by-port
# ---------------------------------------------------------------------------

@router.get(
    "/by-port",
    response_model=List[SpiderSilkPortStat],
    summary="Asset count per port",
)
@limiter.limit("100/minute")
async def by_port(
    request: Request,
    limit: int = Query(default=20, ge=1, le=100),
) -> List[SpiderSilkPortStat]:
    sql = f"""
        SELECT port, COUNT(*) AS count
        FROM {_TABLE}
        WHERE port IS NOT NULL
        GROUP BY port
        ORDER BY count DESC
        LIMIT $1;
    """

    try:
        async with get_connection() as conn:
            rows = await conn.fetch(sql, limit)
    except Exception as exc:
        logger.error(f"spidersilk/by-port query failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve port breakdown.",
        )

    return [SpiderSilkPortStat(port=row["port"], count=row["count"]) for row in rows]


# ---------------------------------------------------------------------------
# GET /api/spidersilk/vuln-by-country
# ---------------------------------------------------------------------------

@router.get(
    "/vuln-by-country",
    summary="Vulnerable vs clean assets per country",
)
@limiter.limit("100/minute")
async def vuln_by_country(
    request: Request,
    limit: int = Query(default=10, ge=1, le=50),
) -> list:
    sql = f"""
        SELECT
            location_country_name,
            COUNT(*) AS total,
            COUNT(*) FILTER (
                WHERE vulnerabilities_json IS NOT NULL
                  AND vulnerabilities_json::text != '[]'
                  AND vulnerabilities_json::text != 'null'
            ) AS with_vulns
        FROM {_TABLE}
        WHERE location_country_name IS NOT NULL
        GROUP BY location_country_name
        ORDER BY total DESC
        LIMIT $1;
    """

    try:
        async with get_connection() as conn:
            rows = await conn.fetch(sql, limit)
    except Exception as exc:
        logger.error(f"spidersilk/vuln-by-country query failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve vulnerability breakdown.",
        )

    return [
        {
            "country": row["location_country_name"],
            "total": row["total"],
            "with_vulns": row["with_vulns"],
            "clean": row["total"] - row["with_vulns"],
        }
        for row in rows
    ]
