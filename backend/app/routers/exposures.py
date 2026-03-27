"""
app/routers/exposures.py
Exposure list, detail, and CSV export endpoints.

Endpoints
---------
GET /api/exposures/          — paginated list with filtering & sorting
GET /api/exposures/{id}      — single record detail
GET /api/exposures/export/csv — streaming CSV download
"""

from __future__ import annotations

import csv
import io
import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from loguru import logger
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.schemas.exposure import (
    ExposureFilter,
    ExposureResponse,
    PaginatedResponse,
)
from db.connection import get_connection

router = APIRouter(
    prefix="/api/exposures",
    tags=["Exposures"],
)

limiter = Limiter(key_func=get_remote_address)

# ---------------------------------------------------------------------------
# Allowed sort columns (whitelist to prevent SQL injection)
# ---------------------------------------------------------------------------
_ALLOWED_SORT = {
    "timestamp", "ip_str", "org", "city", "port",
    "api", "country_code", "updated_at", "created_at",
}

# ---------------------------------------------------------------------------
# All columns returned by ExposureResponse (matches table columns)
# ---------------------------------------------------------------------------
_SELECT_COLUMNS = """
    id, hash, asn, http, os, timestamp, isp, transport,
    _shodan, hostnames, location, ip, domains, org, data,
    port, ip_str, api, city, region_code, area_code,
    longitude, latitude, country_code, country_name, cloud,
    product, tags, cpe23, cpe, version, vulns, ssl,
    created_at, updated_at
"""

# JSONB columns that come back as plain strings and need parsing
_JSONB_COLS = {"http", "ssl", "vulns", "_shodan", "location", "cloud"}


def _parse_row(row) -> dict:
    """Convert an asyncpg Record to a dict, JSON-decoding JSONB columns."""
    d = dict(row)
    for col in _JSONB_COLS:
        if col in d and isinstance(d[col], str):
            try:
                d[col] = json.loads(d[col])
            except (json.JSONDecodeError, TypeError):
                d[col] = None
    return d


def _build_filter_where(
    category: Optional[str],
    city: Optional[str],
    port: Optional[int],
    org: Optional[str],
    search: Optional[str],
) -> tuple[str, list]:
    """
    Build WHERE clause + param list from optional filter values.
    Returns (where_clause_string, params_list).
    """
    conditions: list[str] = []
    params: list = []
    idx = 1

    if category:
        conditions.append(f"api = ${idx}")
        params.append(category)
        idx += 1

    if city:
        conditions.append(f"LOWER(city) = LOWER(${idx})")
        params.append(city)
        idx += 1

    if port is not None:
        conditions.append(f"port = ${idx}")
        params.append(port)
        idx += 1

    if org:
        conditions.append(f"org ILIKE ${idx}")
        params.append(f"%{org}%")
        idx += 1

    if search:
        conditions.append(
            f"(ip_str ILIKE ${idx} OR org ILIKE ${idx} OR data ILIKE ${idx})"
        )
        params.append(f"%{search}%")
        idx += 1

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    return where, params


# ---------------------------------------------------------------------------
# GET /api/exposures/
# ---------------------------------------------------------------------------

@router.get(
    "/",
    response_model=PaginatedResponse[ExposureResponse],
    summary="List exposures (paginated)",
    description=(
        "Returns a paginated, filterable, and sortable list of OT/ICS exposure "
        "records.  Use *search* for full-text search across ip_str, org and data."
    ),
)
@limiter.limit("100/minute")
async def list_exposures(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    category: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    port: Optional[int] = Query(None),
    org: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("timestamp", pattern=r"^(timestamp|ip_str|org|city|port|api|country_code|updated_at|created_at)$"),
    sort_order: str = Query("desc", pattern=r"^(asc|desc)$"),
) -> PaginatedResponse[ExposureResponse]:
    """Paginated exposure list with optional filters and sorting."""

    # Validate sort_by against whitelist (belt-and-suspenders)
    if sort_by not in _ALLOWED_SORT:
        sort_by = "timestamp"
    sort_order = sort_order.lower()
    if sort_order not in ("asc", "desc"):
        sort_order = "desc"

    where, params = _build_filter_where(category, city, port, org, search)

    # Count query
    count_sql = f"SELECT COUNT(*) FROM shodan_exposures {where}"

    # Offset / limit params
    offset = (page - 1) * page_size
    params_data = params + [page_size, offset]
    limit_idx = len(params) + 1
    offset_idx = len(params) + 2

    data_sql = f"""
        SELECT {_SELECT_COLUMNS}
        FROM shodan_exposures
        {where}
        ORDER BY {sort_by} {sort_order} NULLS LAST
        LIMIT ${limit_idx}
        OFFSET ${offset_idx}
    """

    try:
        async with get_connection() as conn:
            total = int((await conn.fetchval(count_sql, *params)) or 0)
            rows = await conn.fetch(data_sql, *params_data)
    except Exception as exc:
        logger.error(f"exposures/ list query failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve exposures.",
        )

    items = [ExposureResponse(**_parse_row(row)) for row in rows]
    pages = max(1, (total + page_size - 1) // page_size)

    return PaginatedResponse[ExposureResponse](
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


# ---------------------------------------------------------------------------
# GET /api/exposures/export/csv  — must be declared BEFORE /{id} route
# ---------------------------------------------------------------------------

@router.get(
    "/export/csv",
    summary="Export exposures as CSV",
    description=(
        "Streams all matching exposure records as a CSV file. "
        "Supports the same filters as the list endpoint."
    ),
    response_class=StreamingResponse,
)
@limiter.limit("10/minute")
async def export_csv(
    request: Request,
    category: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    port: Optional[int] = Query(None),
    org: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    """Stream matching exposures as a downloadable CSV file."""

    where, params = _build_filter_where(category, city, port, org, search)

    sql = f"""
        SELECT
            id, ip_str, port, api, org, city, country_code,
            country_name, isp, asn, product, version,
            os, transport, latitude, longitude,
            timestamp, created_at, updated_at, data
        FROM shodan_exposures
        {where}
        ORDER BY timestamp DESC
    """

    CSV_HEADERS = [
        "id", "ip_str", "port", "api", "org", "city", "country_code",
        "country_name", "isp", "asn", "product", "version",
        "os", "transport", "latitude", "longitude",
        "timestamp", "created_at", "updated_at", "data",
    ]

    try:
        async with get_connection() as conn:
            rows = await conn.fetch(sql, *params)
    except Exception as exc:
        logger.error(f"exposures/export/csv query failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to export exposures.",
        )

    def _generate_csv():
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=CSV_HEADERS, extrasaction="ignore")
        writer.writeheader()

        for row in rows:
            row_dict = {}
            for col in CSV_HEADERS:
                val = row[col]
                if val is None:
                    row_dict[col] = ""
                elif hasattr(val, "isoformat"):
                    row_dict[col] = val.isoformat()
                else:
                    row_dict[col] = str(val)
            writer.writerow(row_dict)

        buffer.seek(0)
        yield buffer.read()

    return StreamingResponse(
        _generate_csv(),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=shodan_exposures.csv",
            "Cache-Control": "no-cache",
        },
    )


# ---------------------------------------------------------------------------
# GET /api/exposures/{id}
# ---------------------------------------------------------------------------

@router.get(
    "/{exposure_id}",
    response_model=ExposureResponse,
    summary="Get single exposure record",
    description="Returns the full detail of a single exposure record by its database ID.",
)
@limiter.limit("100/minute")
async def get_exposure(
    request: Request,
    exposure_id: int,
) -> ExposureResponse:
    """Fetch a single exposure record by primary key."""

    sql = f"SELECT {_SELECT_COLUMNS} FROM shodan_exposures WHERE id = $1"

    try:
        async with get_connection() as conn:
            row = await conn.fetchrow(sql, exposure_id)
    except Exception as exc:
        logger.error(f"exposures/{exposure_id} query failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve exposure record.",
        )

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exposure with id={exposure_id} not found.",
        )

    return ExposureResponse(**_parse_row(row))
