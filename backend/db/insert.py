"""
db/insert.py
Batch upsert of Shodan exposure records into PostgreSQL using asyncpg.

Key behaviours
--------------
- Serialises JSONB columns to JSON strings before insertion.
- Processes the DataFrame in configurable batch sizes (default 500).
- ON CONFLICT (ip_str, port, timestamp) → updates all mutable fields.
- Retry logic via tenacity: exponential back-off, max 3 attempts.
- Structured logging via loguru.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

import pandas as pd
from loguru import logger
from tenacity import (
    after_log,
    before_sleep_log,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from db.connection import get_connection

import asyncpg
import logging

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BATCH_SIZE = 500

# Columns that must be serialised to JSON strings before sending to Postgres
JSONB_COLUMNS = {"http", "ssl", "vulns", "_shodan", "location", "cloud"}

# Columns that are stored as TEXT[] in Postgres
ARRAY_COLUMNS = {"tags", "cpe23", "cpe", "hostnames", "domains"}

# All writable columns in insertion order (matches the upsert SQL below)
INSERT_COLUMNS = [
    "hash", "asn", "http", "os", "timestamp", "isp", "transport",
    "_shodan", "hostnames", "location", "ip", "domains", "org", "data",
    "port", "ip_str", "api", "city", "region_code", "area_code",
    "longitude", "latitude", "country_code", "country_name", "cloud",
    "product", "tags", "cpe23", "cpe", "version", "vulns", "ssl",
]

# ---------------------------------------------------------------------------
# SQL
# ---------------------------------------------------------------------------

_UPSERT_SQL = """
INSERT INTO shodan_exposures (
    hash, asn, http, os, timestamp, isp, transport,
    _shodan, hostnames, location, ip, domains, org, data,
    port, ip_str, api, city, region_code, area_code,
    longitude, latitude, country_code, country_name, cloud,
    product, tags, cpe23, cpe, version, vulns, ssl
) VALUES (
    $1,  $2,  $3,  $4,  $5,  $6,  $7,
    $8,  $9,  $10, $11, $12, $13, $14,
    $15, $16, $17, $18, $19, $20,
    $21, $22, $23, $24, $25,
    $26, $27, $28, $29, $30, $31, $32
)
ON CONFLICT (ip_str, port, timestamp)
DO UPDATE SET
    hash         = EXCLUDED.hash,
    asn          = EXCLUDED.asn,
    http         = EXCLUDED.http,
    os           = EXCLUDED.os,
    isp          = EXCLUDED.isp,
    transport    = EXCLUDED.transport,
    _shodan      = EXCLUDED._shodan,
    hostnames    = EXCLUDED.hostnames,
    location     = EXCLUDED.location,
    ip           = EXCLUDED.ip,
    domains      = EXCLUDED.domains,
    org          = EXCLUDED.org,
    data         = EXCLUDED.data,
    api          = EXCLUDED.api,
    city         = EXCLUDED.city,
    region_code  = EXCLUDED.region_code,
    area_code    = EXCLUDED.area_code,
    longitude    = EXCLUDED.longitude,
    latitude     = EXCLUDED.latitude,
    country_code = EXCLUDED.country_code,
    country_name = EXCLUDED.country_name,
    cloud        = EXCLUDED.cloud,
    product      = EXCLUDED.product,
    tags         = EXCLUDED.tags,
    cpe23        = EXCLUDED.cpe23,
    cpe          = EXCLUDED.cpe,
    version      = EXCLUDED.version,
    vulns        = EXCLUDED.vulns,
    ssl          = EXCLUDED.ssl,
    updated_at   = NOW()
"""


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _safe_json(value: Any) -> Optional[str]:
    """Serialise a value to a JSON string; returns None if value is null-like."""
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    if isinstance(value, str):
        # Already a JSON string — parse then re-serialise so the output is
        # always canonical, valid JSON (fixes Python-lenient escapes like \-
        # that PostgreSQL rejects).
        try:
            parsed = json.loads(value)
            return json.dumps(parsed, default=str).replace("\\u0000", "").replace("\x00", "")
        except (json.JSONDecodeError, ValueError):
            return None
    try:
        return json.dumps(value, default=str).replace("\\u0000", "").replace("\x00", "")
    except (TypeError, ValueError):
        return None


def _safe_array(value: Any) -> Optional[List[str]]:
    """
    Coerce a value into a Python list of strings for TEXT[] columns.
    Returns None for null-like inputs.
    """
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    if isinstance(value, list):
        return [str(v).replace("\x00", "") for v in value if v is not None]
    if isinstance(value, str):
        # May be a JSON-encoded list
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return [str(v).replace("\x00", "") for v in parsed if v is not None]
        except json.JSONDecodeError:
            pass
        # Treat as a single-element array
        return [value.replace("\x00", "")] if value.strip() else None
    return [str(value).replace("\x00", "")]


def _safe_int(value: Any) -> Optional[int]:
    """Convert to int, returning None for null-like values."""
    if value is None:
        return None
    try:
        if isinstance(value, float) and pd.isna(value):
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _safe_float(value: Any) -> Optional[float]:
    """Convert to float, returning None for null-like values."""
    if value is None:
        return None
    try:
        if isinstance(value, float) and pd.isna(value):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_str(value: Any) -> Optional[str]:
    """Convert to str, returning None for null-like values."""
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    s = str(value).strip().replace("\x00", "")
    return s if s else None


def _row_to_tuple(row: Dict[str, Any]) -> tuple:
    """
    Convert a DataFrame row (dict) into an ordered tuple matching INSERT_COLUMNS.
    Handles type coercion for every column category.
    """
    return (
        _safe_str(row.get("hash")),           # $1  hash
        _safe_str(row.get("asn")),             # $2  asn
        _safe_json(row.get("http")),           # $3  http      JSONB
        _safe_str(row.get("os")),              # $4  os
        row.get("timestamp"),                  # $5  timestamp  (pandas Timestamp / datetime / None)
        _safe_str(row.get("isp")),             # $6  isp
        _safe_str(row.get("transport")),       # $7  transport
        _safe_json(row.get("_shodan")),        # $8  _shodan   JSONB
        _safe_array(row.get("hostnames")),     # $9  hostnames TEXT[]
        _safe_json(row.get("location")),       # $10 location  JSONB
        _safe_int(row.get("ip")),              # $11 ip        BIGINT
        _safe_array(row.get("domains")),       # $12 domains   TEXT[]
        _safe_str(row.get("org")),             # $13 org
        _safe_str(row.get("data")),            # $14 data
        _safe_int(row.get("port")),            # $15 port
        _safe_str(row.get("ip_str")),          # $16 ip_str
        _safe_str(row.get("api")),             # $17 api
        _safe_str(row.get("city")),            # $18 city
        _safe_str(row.get("region_code")),     # $19 region_code
        _safe_str(row.get("area_code")),       # $20 area_code
        _safe_float(row.get("longitude")),     # $21 longitude
        _safe_float(row.get("latitude")),      # $22 latitude
        _safe_str(row.get("country_code")),    # $23 country_code
        _safe_str(row.get("country_name")),    # $24 country_name
        _safe_json(row.get("cloud")),          # $25 cloud     JSONB
        _safe_str(row.get("product")),         # $26 product
        _safe_array(row.get("tags")),          # $27 tags      TEXT[]
        _safe_array(row.get("cpe23")),         # $28 cpe23     TEXT[]
        _safe_array(row.get("cpe")),           # $29 cpe       TEXT[]
        _safe_str(row.get("version")),         # $30 version
        _safe_json(row.get("vulns")),          # $31 vulns     JSONB
        _safe_json(row.get("ssl")),            # $32 ssl       JSONB
    )


# ---------------------------------------------------------------------------
# Retry decorator
# ---------------------------------------------------------------------------

_tenacity_retry = retry(
    retry=retry_if_exception_type((asyncpg.PostgresConnectionError, OSError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    before_sleep=before_sleep_log(logging.getLogger("tenacity"), logging.WARNING),
    after=after_log(logging.getLogger("tenacity"), logging.INFO),
    reraise=True,
)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

@_tenacity_retry
async def _insert_batch(records: List[tuple]) -> int:
    """
    Insert a single batch of pre-processed tuples.
    Returns the number of rows inserted/updated.
    """
    async with get_connection() as conn:
        result = await conn.executemany(_UPSERT_SQL, records)
        # executemany returns a status string like "INSERT 0 N"
        # asyncpg returns None for executemany; we return len as proxy
        return len(records)


async def upsert_batch(df: pd.DataFrame, batch_size: int = BATCH_SIZE) -> int:
    """
    Upsert all rows in *df* into ``shodan_exposures``, committing in batches
    of *batch_size* rows.

    Parameters
    ----------
    df:
        DataFrame whose columns match the Shodan schema.
    batch_size:
        Number of rows per database round-trip (default 500).

    Returns
    -------
    int
        Total number of rows processed (inserted + updated).
    """
    if df.empty:
        logger.warning("upsert_batch called with an empty DataFrame — nothing to do.")
        return 0

    total_rows = len(df)
    logger.info(f"Starting upsert of {total_rows} rows in batches of {batch_size}.")

    # Normalise timestamp column to Python datetime objects
    if "timestamp" in df.columns:
        df = df.copy()
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce", utc=True)
        # Replace NaT with None
        df["timestamp"] = df["timestamp"].where(df["timestamp"].notna(), other=None)

    rows_processed = 0
    batch_num = 0

    for start in range(0, total_rows, batch_size):
        batch_num += 1
        chunk = df.iloc[start : start + batch_size]
        records = [_row_to_tuple(row) for row in chunk.to_dict(orient="records")]

        try:
            await _insert_batch(records)
            rows_processed += len(records)
            logger.info(
                f"Batch {batch_num}: inserted/updated {len(records)} rows "
                f"({rows_processed}/{total_rows} total)."
            )
        except Exception as exc:
            logger.error(
                f"Batch {batch_num} failed after retries "
                f"(rows {start}–{start + len(records) - 1}): {exc}"
            )
            raise

    logger.success(f"Upsert complete — {rows_processed} rows processed.")
    return rows_processed
