"""
app/routers/risk.py
Risk-assessment endpoints for the OT/ICS Cybersecurity Exposure Dashboard.

Endpoints
---------
GET /api/risk/top-orgs      — organisations ranked by exposure + vuln risk
GET /api/risk/critical-ips  — hosts with known CVEs
GET /api/risk/score         — composite dataset-wide risk score
"""

from __future__ import annotations

import json
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, Request, status
from loguru import logger
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.schemas.exposure import CriticalIP, RiskScore, TopOrg
from db.connection import get_connection

router = APIRouter(
    prefix="/api/risk",
    tags=["Risk"],
)

limiter = Limiter(key_func=get_remote_address)

# ---------------------------------------------------------------------------
# OT / ICS critical ports — Siemens S7 (102), Modbus (502),
# EtherNet/IP (44818), DNP3 (20000)
# ---------------------------------------------------------------------------
_OT_CRITICAL_PORTS = [102, 502, 44818, 20000]


def _compute_risk_score(exposure_count: int, vuln_count: int) -> float:
    """
    Simple linear risk score:
      raw = exposure_count * 2 + vuln_count * 10
      score = min(100, raw)
    """
    raw = exposure_count * 2 + vuln_count * 10
    return float(min(100, raw))


# ---------------------------------------------------------------------------
# GET /api/risk/top-orgs
# ---------------------------------------------------------------------------

@router.get(
    "/top-orgs",
    response_model=List[TopOrg],
    summary="Top organisations by risk",
    description=(
        "Returns organisations ranked by a composite risk score calculated "
        "from total exposure count and the number of hosts with known CVEs. "
        "risk_score = min(100, exposure_count × 2 + vuln_count × 10)."
    ),
)
@limiter.limit("100/minute")
async def get_top_orgs(
    request: Request,
    limit: int = Query(20, ge=1, le=100, description="Maximum organisations to return"),
) -> List[TopOrg]:
    """Return organisations sorted by exposure + vulnerability risk."""

    # Use vulns::text comparison to avoid JSONB operator issues with the
    # custom asyncpg text codec. Text representation of an empty JSONB object
    # is '{}' and JSON null is 'null' — both are excluded.
    sql = """
        SELECT
            org,
            COUNT(*)::int AS exposure_count,
            COUNT(
                CASE
                    WHEN vulns IS NOT NULL
                     AND vulns::text NOT IN ('null', '{}', '')
                    THEN 1
                END
            )::int AS vuln_count
        FROM shodan_exposures
        GROUP BY org
        ORDER BY (
            COUNT(*) * 2
            + COUNT(
                CASE
                    WHEN vulns IS NOT NULL
                     AND vulns::text NOT IN ('null', '{}', '')
                    THEN 1
                END
              ) * 10
        ) DESC
        LIMIT $1
    """

    try:
        async with get_connection() as conn:
            rows = await conn.fetch(sql, limit)
    except Exception as exc:
        logger.exception("risk/top-orgs query failed")   # full traceback in logs
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve top-org risk data: {exc}",
        )

    result: List[TopOrg] = [
        TopOrg(
            org=row["org"],
            exposure_count=row["exposure_count"],
            vuln_count=row["vuln_count"],
            risk_score=_compute_risk_score(row["exposure_count"], row["vuln_count"]),
        )
        for row in rows
    ]
    logger.info(f"risk/top-orgs returning {len(result)} organisations.")
    return result


# ---------------------------------------------------------------------------
# GET /api/risk/critical-ips
# ---------------------------------------------------------------------------

@router.get(
    "/critical-ips",
    response_model=List[CriticalIP],
    summary="Critical IP addresses (with known CVEs)",
    description=(
        "Returns hosts that have at least one known vulnerability (CVE) "
        "recorded in the Shodan data.  Ordered by timestamp descending."
    ),
)
@limiter.limit("100/minute")
async def get_critical_ips(
    request: Request,
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    country_code: Optional[str] = Query(None, description="Filter by ISO 2-letter country code"),
    org: Optional[str] = Query(None, description="Filter by organisation (partial match)"),
) -> List[CriticalIP]:
    """Return hosts that have known CVEs recorded in Shodan data."""

    conditions = [
        "vulns IS NOT NULL",
        "vulns::text NOT IN ('null', '{}', '')",
    ]
    params: list = []
    idx = 1

    if country_code:
        conditions.append(f"UPPER(country_code) = UPPER(${idx})")
        params.append(country_code)
        idx += 1

    if org:
        conditions.append(f"org ILIKE ${idx}")
        params.append(f"%{org}%")
        idx += 1

    where = "WHERE " + " AND ".join(conditions)
    params.append(limit)
    limit_placeholder = f"${idx}"

    sql = f"""
        SELECT
            id,
            ip_str,
            org,
            city,
            country_code,
            port,
            api,
            vulns,
            timestamp
        FROM shodan_exposures
        {where}
        ORDER BY timestamp DESC NULLS LAST
        LIMIT {limit_placeholder}
    """

    try:
        async with get_connection() as conn:
            rows = await conn.fetch(sql, *params)
    except Exception as exc:
        logger.exception("risk/critical-ips query failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve critical IP data: {exc}",
        )

    result: List[CriticalIP] = []
    for row in rows:
        row_dict = dict(row)
        if isinstance(row_dict.get("vulns"), str):
            try:
                row_dict["vulns"] = json.loads(row_dict["vulns"])
            except (json.JSONDecodeError, TypeError):
                row_dict["vulns"] = None
        result.append(CriticalIP(**row_dict))

    logger.info(f"risk/critical-ips returning {len(result)} hosts.")
    return result


# ---------------------------------------------------------------------------
# GET /api/risk/score
# ---------------------------------------------------------------------------

@router.get(
    "/score",
    response_model=RiskScore,
    summary="Composite dataset risk score",
    description=(
        "Calculates a composite risk score (0–100) for the entire dataset "
        "based on: total exposure count, critical OT port exposure "
        "(Modbus 502, S7 102, EtherNet/IP 44818, DNP3 20000), "
        "and total vulnerability count."
    ),
)
@limiter.limit("100/minute")
async def get_risk_score(request: Request) -> RiskScore:
    """Return a dataset-wide composite risk score."""

    port_placeholders = ", ".join(f"${i+1}" for i in range(len(_OT_CRITICAL_PORTS)))

    sql = f"""
        SELECT
            COUNT(*)::int                                          AS total_exposures,
            COUNT(DISTINCT ip_str)::int                            AS unique_ips,
            COUNT(CASE WHEN port IN ({port_placeholders}) THEN 1 END)::int
                                                                   AS critical_port_exposures,
            COUNT(
                CASE
                    WHEN vulns IS NOT NULL
                     AND vulns::text NOT IN ('null', '{{}}', '')
                    THEN 1
                END
            )::int                                                 AS total_vulns
        FROM shodan_exposures
    """

    try:
        async with get_connection() as conn:
            row = await conn.fetchrow(sql, *_OT_CRITICAL_PORTS)
    except Exception as exc:
        logger.exception("risk/score query failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate risk score: {exc}",
        )

    if row is None:
        # Empty table
        return RiskScore(
            total_score=0.0,
            total_exposures=0,
            unique_ips=0,
            critical_port_exposures=0,
            total_vulns=0,
            breakdown={"exposure_component": 0.0, "critical_port_component": 0.0, "vuln_component": 0.0},
        )

    total_exposures: int = row["total_exposures"] or 0
    unique_ips: int = row["unique_ips"] or 0
    critical_port_exposures: int = row["critical_port_exposures"] or 0
    total_vulns: int = row["total_vulns"] or 0

    # -----------------------------------------------------------------------
    # Scoring formula
    # Each component is normalised to a 0-100 range independently, then
    # combined with weights that reflect OT/ICS threat priorities:
    #   - Vulnerability presence is the heaviest indicator      (weight 0.50)
    #   - Critical OT protocol exposure is severe               (weight 0.35)
    #   - Raw exposure volume provides context                  (weight 0.15)
    # -----------------------------------------------------------------------

    # Exposure component: every 100 exposed hosts adds 10 points, capped at 100
    exposure_component = min(100.0, (total_exposures / 10.0))

    # Critical port component: every critical-port host adds 5 points, cap 100
    critical_port_component = min(100.0, critical_port_exposures * 5.0)

    # Vuln component: every vuln host adds 10 points, cap 100
    vuln_component = min(100.0, total_vulns * 10.0)

    total_score = round(
        exposure_component * 0.15
        + critical_port_component * 0.35
        + vuln_component * 0.50,
        2,
    )

    breakdown = {
        "exposure_component": round(exposure_component, 2),
        "critical_port_component": round(critical_port_component, 2),
        "vuln_component": round(vuln_component, 2),
    }

    logger.info(
        f"risk/score: total={total_exposures}, "
        f"critical_ports={critical_port_exposures}, "
        f"vulns={total_vulns}, score={total_score}"
    )

    return RiskScore(
        total_score=total_score,
        total_exposures=total_exposures,
        unique_ips=unique_ips,
        critical_port_exposures=critical_port_exposures,
        total_vulns=total_vulns,
        breakdown=breakdown,
    )
