"""
app/routers/map.py
Map-related endpoints for the OT/ICS Cybersecurity Exposure Dashboard.

Endpoints
---------
GET /api/map/exposures   — list of MapPoint objects for map rendering
GET /api/map/clusters    — aggregated ClusterPoint objects for cluster/heatmaps
"""

from __future__ import annotations

import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from loguru import logger
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.schemas.exposure import ClusterPoint, MapPoint
from db.connection import get_connection

router = APIRouter(
    prefix="/api/map",
    tags=["Map"],
)

limiter = Limiter(key_func=get_remote_address)

# ---------------------------------------------------------------------------
# OT / ICS critical ports — anything on these is elevated risk
# ---------------------------------------------------------------------------
_OT_CRITICAL_PORTS = {102, 502, 44818, 20000}


def _build_map_where(
    category: Optional[str],
    city: Optional[str],
    risk_level: Optional[str],
) -> tuple[str, list]:
    """
    Build a WHERE clause and parameter list for the map/exposures query.

    Parameters
    ----------
    category:   filter on the ``api`` column (OT/ICS protocol)
    city:       filter on the ``city`` column (case-insensitive)
    risk_level: 'critical' → has vulns; 'high' → OT critical port; 'medium' → all others

    Returns
    -------
    (where_clause, params)
        where_clause includes the leading "WHERE" keyword (or empty string).
        params is a list of positional values matching $1, $2, … placeholders.
    """
    conditions: list[str] = []
    params: list = []
    idx = 1  # asyncpg uses $1, $2 … placeholders

    if category:
        conditions.append(f"api = ${idx}")
        params.append(category)
        idx += 1

    if city:
        conditions.append(f"LOWER(city) = LOWER(${idx})")
        params.append(city)
        idx += 1

    if risk_level:
        level = risk_level.lower()
        if level == "critical":
            conditions.append("vulns IS NOT NULL AND vulns != '{}'::jsonb")
        elif level == "high":
            # Port is in the list of critical OT ports
            port_placeholders = ", ".join(
                f"${idx + i}" for i in range(len(_OT_CRITICAL_PORTS))
            )
            conditions.append(f"port IN ({port_placeholders})")
            params.extend(sorted(_OT_CRITICAL_PORTS))
            idx += len(_OT_CRITICAL_PORTS)
        elif level == "medium":
            # Everything that is neither critical nor high
            port_placeholders = ", ".join(
                f"${idx + i}" for i in range(len(_OT_CRITICAL_PORTS))
            )
            conditions.append(
                f"(vulns IS NULL OR vulns = '{{}}') "
                f"AND port NOT IN ({port_placeholders})"
            )
            params.extend(sorted(_OT_CRITICAL_PORTS))
            idx += len(_OT_CRITICAL_PORTS)
        # Unknown values are silently ignored

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    return where, params


# ---------------------------------------------------------------------------
# GET /api/map/exposures
# ---------------------------------------------------------------------------

@router.get(
    "/exposures",
    response_model=List[MapPoint],
    summary="Map exposure points",
    description=(
        "Returns up to *limit* exposure records with geographic coordinates "
        "for rendering on the dashboard map. Supports filtering by OT/ICS "
        "protocol category, city, and risk level."
    ),
)
@limiter.limit("100/minute")
async def get_map_exposures(
    request: Request,
    category: Optional[str] = Query(None, description="OT/ICS protocol / API category"),
    city: Optional[str] = Query(None, description="City name (case-insensitive)"),
    risk_level: Optional[str] = Query(
        None,
        description="Risk level: 'critical' (has CVEs), 'high' (OT port), 'medium' (other)",
        pattern="^(critical|high|medium)$",
    ),
    limit: int = Query(1000, ge=1, le=10000, description="Maximum number of points to return"),
) -> List[MapPoint]:
    """Return map points, optionally filtered by category, city, and risk level."""

    where, params = _build_map_where(category, city, risk_level)
    limit_idx = len(params) + 1
    params.append(limit)

    sql = f"""
        SELECT
            id,
            ip_str,
            latitude,
            longitude,
            city,
            org,
            api,
            port,
            vulns
        FROM shodan_exposures
        {where}
        ORDER BY timestamp DESC
        LIMIT ${limit_idx}
    """

    logger.debug(f"map/exposures SQL: {sql!r} params={params}")

    try:
        async with get_connection() as conn:
            rows = await conn.fetch(sql, *params)
    except Exception as exc:
        logger.error(f"map/exposures query failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve map exposures.",
        )

    points: List[MapPoint] = []
    for row in rows:
        row_dict = dict(row)
        # vulns is returned as a string by our custom codec — parse it
        if isinstance(row_dict.get("vulns"), str):
            try:
                row_dict["vulns"] = json.loads(row_dict["vulns"])
            except (json.JSONDecodeError, TypeError):
                row_dict["vulns"] = None
        points.append(MapPoint(**row_dict))

    logger.info(f"map/exposures returning {len(points)} points.")
    return points


# ---------------------------------------------------------------------------
# GET /api/map/clusters
# ---------------------------------------------------------------------------

@router.get(
    "/clusters",
    response_model=List[ClusterPoint],
    summary="Geographic exposure clusters",
    description=(
        "Returns aggregated exposure counts grouped into 0.1-degree lat/lon "
        "buckets.  Suitable for cluster-map and heat-map visualisations."
    ),
)
@limiter.limit("100/minute")
async def get_map_clusters(
    request: Request,
    category: Optional[str] = Query(None, description="Filter clusters by OT/ICS protocol"),
    country_code: Optional[str] = Query(None, description="Filter clusters by ISO country code"),
) -> List[ClusterPoint]:
    """Return geographic clusters (rounded lat/lon buckets with counts)."""

    conditions: list[str] = [
        "latitude IS NOT NULL",
        "longitude IS NOT NULL",
    ]
    params: list = []
    idx = 1

    if category:
        conditions.append(f"api = ${idx}")
        params.append(category)
        idx += 1

    if country_code:
        conditions.append(f"UPPER(country_code) = UPPER(${idx})")
        params.append(country_code)
        idx += 1

    where = "WHERE " + " AND ".join(conditions)

    sql = f"""
        SELECT
            ROUND(latitude::numeric,  1)::float AS latitude,
            ROUND(longitude::numeric, 1)::float AS longitude,
            COUNT(*)::int                        AS count
        FROM shodan_exposures
        {where}
        GROUP BY
            ROUND(latitude::numeric,  1),
            ROUND(longitude::numeric, 1)
        ORDER BY count DESC
    """

    logger.debug(f"map/clusters SQL: {sql!r} params={params}")

    try:
        async with get_connection() as conn:
            rows = await conn.fetch(sql, *params)
    except Exception as exc:
        logger.error(f"map/clusters query failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve map clusters.",
        )

    clusters = [ClusterPoint(**dict(row)) for row in rows]
    logger.info(f"map/clusters returning {len(clusters)} cluster buckets.")
    return clusters
