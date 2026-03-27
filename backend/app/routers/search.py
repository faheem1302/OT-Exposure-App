"""
app/routers/search.py
Natural language → PostgreSQL SQL generation and safe execution.

Endpoints
---------
POST /api/search/nl2sql    — Generate a SELECT query from a plain-English question
POST /api/search/execute   — Execute a validated SELECT query and return results
"""

import re
from typing import Any, List, Optional

from fastapi import APIRouter, HTTPException, Request, status
from loguru import logger
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings
from db.connection import get_connection

router = APIRouter(
    prefix="/api/search",
    tags=["Search"],
)

limiter = Limiter(key_func=get_remote_address)


# ---------------------------------------------------------------------------
# Database schema context fed to the LLM
# ---------------------------------------------------------------------------

_TABLE_SCHEMA = """
Table: shodan_exposures
Columns:
  id            BIGSERIAL PRIMARY KEY
  hash          TEXT                  -- Shodan record hash
  asn           TEXT                  -- Autonomous System Number (e.g. "AS15169")
  isp           TEXT                  -- Internet Service Provider name
  transport     TEXT                  -- "tcp" or "udp"
  hostnames     TEXT[]                -- Array of reverse-DNS hostnames
  ip            BIGINT                -- IP address as integer
  ip_str        TEXT                  -- IP address as dotted string (e.g. "1.2.3.4")
  domains       TEXT[]                -- Array of associated domains
  org           TEXT                  -- Organisation that owns the IP
  data          TEXT                  -- Raw banner / service data
  port          INT                   -- Network port number
  api           TEXT                  -- OT/ICS exposure category (see values below)
  city          TEXT                  -- City name
  region_code   TEXT                  -- ISO region/state code
  latitude      DOUBLE PRECISION      -- Geographic latitude
  longitude     DOUBLE PRECISION      -- Geographic longitude
  country_name  TEXT                  -- Full country name
  country_code  TEXT                  -- ISO 2-letter country code
  product       TEXT                  -- Device/software product name
  tags          TEXT[]                -- Shodan tag array
  cpe23         TEXT[]                -- CPE 2.3 identifiers
  cpe           TEXT[]                -- CPE identifiers
  version       TEXT                  -- Software / firmware version
  vulns         JSONB                 -- CVEs: {"CVE-XXXX-XXXX": {...}, ...}
  http          JSONB                 -- HTTP response details
  ssl           JSONB                 -- SSL/TLS certificate details
  _shodan       JSONB                 -- Internal Shodan metadata
  location      JSONB                 -- Full location object
  cloud         JSONB                 -- Cloud provider metadata
  timestamp     TIMESTAMPTZ           -- When Shodan last scanned this host
  created_at    TIMESTAMPTZ           -- Record insertion time
  updated_at    TIMESTAMPTZ           -- Last update time

Values for the `api` column (OT/ICS exposure categories — use exact strings):
  'shodan/Exposed SCADA/HMI Interfaces'
  'shodan/Exposed PLC/RTU Protocols'
  'shodan/Exposed Engineering Workstations (EWS)'
  'shodan/Exposed OT Remote Vendor Access'
  'shodan/Exposed OT Historians'
  'shodan/Industrial Protocol Gateways(Products)'
  'shodan/Industrial Protocol Gateways(MQTT/AMQP)'
  'shodan/Industrial Protocol Gateways(Web/Dashboards)'
  'shodan/Industrial Protocol Gateways(Orchestration/API)'
  'shodan/Industrial Protocol Gateways(Management & Proxy)'
  'shodan/Industrial Wireless Exposure'
  'shodan/ICS Default Credential Exposure'
  'shodan/Exposed ICS Web Dashboards'
  'shodan/Building Automation (OT-BMS) Exposure'
  'shodan/OT Firmware & Update Server Exposure'
  'shodan/Modbus TCP Exposure – GCC & Jordan'

Common country codes: AE=UAE, SA=Saudi Arabia, KW=Kuwait, QA=Qatar, OM=Oman, JO=Jordan
Critical OT ports: 102 (Siemens S7), 502 (Modbus TCP), 20000 (DNP3), 44818 (EtherNet/IP)
""".strip()

_SYSTEM_PROMPT = f"""You are a PostgreSQL expert for an OT/ICS cybersecurity exposure database.
Convert the user's plain-English question into a single, safe SELECT query.

Schema:
{_TABLE_SCHEMA}

Rules:
1. Output ONLY the raw SQL — no markdown, no code fences, no comments, no explanation.
2. Only SELECT statements. Never INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, TRUNCATE, GRANT, REVOKE.
3. Always add LIMIT (default 100, max 500) unless the user specifies "all" explicitly.
4. To check for CVEs: vulns IS NOT NULL AND vulns != '{{}}'::jsonb
5. For TEXT[] columns (hostnames, domains, tags, cpe23) use @> or unnest().
6. Use meaningful column aliases for readability.
7. If the question is ambiguous, write the most helpful plausible query.
"""


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class NL2SQLRequest(BaseModel):
    question: str = Field(
        ..., min_length=3, max_length=1000,
        description="Plain-English question about the exposure data",
    )


class NL2SQLResponse(BaseModel):
    sql: str
    question: str


class ExecuteRequest(BaseModel):
    sql: str = Field(
        ..., min_length=10, max_length=5000,
        description="A SELECT query to run against shodan_exposures",
    )


class ExecuteResponse(BaseModel):
    columns: List[str]
    rows: List[List[Optional[str]]]
    row_count: int
    truncated: bool


# ---------------------------------------------------------------------------
# Safety guard
# ---------------------------------------------------------------------------

_FORBIDDEN = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|COPY|EXECUTE|CALL|DO)\b",
    re.IGNORECASE,
)


def _assert_safe_select(sql: str) -> None:
    stripped = sql.strip()
    if not re.match(r"^SELECT\b", stripped, re.IGNORECASE):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only SELECT queries are permitted.",
        )
    if _FORBIDDEN.search(stripped):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query contains a forbidden keyword.",
        )


# ---------------------------------------------------------------------------
# POST /api/search/nl2sql
# ---------------------------------------------------------------------------

@router.post(
    "/nl2sql",
    response_model=NL2SQLResponse,
    summary="Natural language → SQL",
    description=(
        "Sends the plain-English question to Claude and returns a "
        "ready-to-run PostgreSQL SELECT query."
    ),
)
@limiter.limit("20/minute")
async def nl2sql(request: Request, body: NL2SQLRequest) -> NL2SQLResponse:
    try:
        import anthropic  # lazy import — keeps startup fast when key is absent

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        message = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=1024,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": body.question}],
        )
        raw = message.content[0].text.strip()

        # Strip any markdown code fences the model may have added
        raw = re.sub(r"^```[a-z]*\n?", "", raw, flags=re.IGNORECASE)
        raw = re.sub(r"\n?```$", "", raw)
        sql = raw.strip().rstrip(";")

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"NL2SQL generation error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI SQL generation failed: {exc}",
        )

    return NL2SQLResponse(sql=sql, question=body.question)


# ---------------------------------------------------------------------------
# POST /api/search/execute
# ---------------------------------------------------------------------------

_MAX_ROWS = 500


@router.post(
    "/execute",
    response_model=ExecuteResponse,
    summary="Execute SQL query",
    description=(
        "Runs a validated, read-only SELECT query against the "
        "shodan_exposures table and returns up to 500 rows."
    ),
)
@limiter.limit("30/minute")
async def execute_query(request: Request, body: ExecuteRequest) -> ExecuteResponse:
    _assert_safe_select(body.sql)

    # Strip trailing semicolon before wrapping (semicolons break subquery syntax)
    clean_sql = body.sql.rstrip().rstrip(";").rstrip()
    # Wrap in a subquery to cap rows without mutating the user's SQL
    capped_sql = f"SELECT * FROM ({clean_sql}) _q LIMIT {_MAX_ROWS + 1}"

    try:
        async with get_connection() as conn:
            rows = await conn.fetch(capped_sql)
    except Exception as exc:
        logger.error(f"Query execution error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Query execution failed: {exc}",
        )

    truncated = len(rows) > _MAX_ROWS
    rows = rows[:_MAX_ROWS]

    if not rows:
        return ExecuteResponse(columns=[], rows=[], row_count=0, truncated=False)

    columns = list(rows[0].keys())
    result_rows: List[List[Optional[str]]] = [
        [str(v) if v is not None else None for v in row.values()]
        for row in rows
    ]

    return ExecuteResponse(
        columns=columns,
        rows=result_rows,
        row_count=len(result_rows),
        truncated=truncated,
    )
