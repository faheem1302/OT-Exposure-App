"""
app/routers/gcc_exposure.py
GCC & Jordan Modbus TCP (port 502) exposure breakdown by country.

Endpoints
---------
GET /api/gcc_exposure/by-country   — port-502 exposure count per country
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, HTTPException, Request, status
from loguru import logger
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.schemas.exposure import GCCCountryStat
from db.connection import get_connection

router = APIRouter(
    prefix="/api/gcc_exposure",
    tags=["GCC Exposure"],
)

limiter = Limiter(key_func=get_remote_address)

# GCC + Jordan ISO codes covered by the Modbus query
GCC_COUNTRIES = ("AE", "KW", "QA", "SA", "OM", "JO")


# ---------------------------------------------------------------------------
# GET /api/gcc_exposure/by-country
# ---------------------------------------------------------------------------

@router.get(
    "/by-country",
    response_model=List[GCCCountryStat],
    summary="Modbus TCP (port 502) exposure by country",
    description=(
        "Returns the port-502 exposure count for each GCC country and Jordan, "
        "ordered by count descending. Only rows where port = 502 are included."
    ),
)
@limiter.limit("100/minute")
async def get_gcc_exposure_by_country(request: Request) -> List[GCCCountryStat]:
    """Port-502 exposure count per country for AE, KW, QA, SA, OM, JO."""

    sql = """
        SELECT country_name, country_code, COUNT(*) AS exposure_count
        FROM shodan_exposures
        GROUP BY country_name, country_code
        ORDER BY exposure_count DESC
    """

    try:
        async with get_connection() as conn:
            rows = await conn.fetch(sql)
    except Exception as exc:
        logger.error(f"gcc_exposure/by-country query failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve GCC exposure statistics.",
        )

    return [
        GCCCountryStat(
            country_code=row["country_code"],
            country_name=row["country_name"],
            count=row["exposure_count"],
        )
        for row in rows
    ]
