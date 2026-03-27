"""
-----
1. Shodan   — fetches OT/ICS exposure records → upserts into shodan_exposures
2. SpiderSilk — fetches asset scan records    → inserts into spidersilk_assets

"""

import asyncio
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import psycopg
import requests
import shodan
from dotenv import load_dotenv
from loguru import logger

# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
load_dotenv(PROJECT_ROOT / ".env")

# ---------------------------------------------------------------------------
# Shodan configuration
# ---------------------------------------------------------------------------

SHODAN_API_KEY: str = os.getenv("SHODAN_API_KEY", "")
MAX_PAGES: int = int(os.getenv("SHODAN_MAX_PAGES", 20))
MAX_ITEMS_PER_PAGE: int = int(os.getenv("SHODAN_MAX_ITEMS_PER_PAGE", 100))

OT_EXPOSURE_CATEGORIES = {
    "Exposed SCADA/HMI Interfaces":                  "port:80,443,8080,8000,8443,102,44818,20000,2404,47808,1911 country:ae tag:ics",
    "Exposed PLC/RTU Protocols":                     "port:502,102,44818,20000,47808 country:ae tag:ics",
    "Exposed Engineering Workstations (EWS)":        "port:102,502,44818,20000,2404,47808,1911,4911,80,443,8080,8443 country:ae tag:ics",
    "Exposed OT Remote Vendor Access":               "port:5900,3389,554 country:ae tag:ics",
    "Exposed OT Historians":                         "port:5450,5457,14000,14099,54365,5522,8088 country:ae tag:ics",
    "Industrial Protocol Gateways(Products)":        '"Moxa" OR "Anybus" OR "HMS Networks" country:ae tag:ics',
    "Industrial Protocol Gateways(MQTT/AMQP)":      "port:1883,8883,5671,5672 country:ae tag:ics",
    "Industrial Protocol Gateways(Web/Dashboards)":  "port:80,81,82,83,84,85,87,89,90,1880,3000-3005,8880 country:ae tag:ics",
    "Industrial Protocol Gateways(Orchestration/API)": "port:4505,4506,6443,7946,8525,8855 country:ae tag:ics",
    "Industrial Protocol Gateways(Management & Proxy)": "port:7547,8118,13000 country:ae tag:ics",
    "Industrial Wireless Exposure":                  "port:5683,9434,102,161,502,44818,47808,20000,4840,20000,23,5094,5683 country:ae tag:ics",
    "ICS Default Credential Exposure":               "port:443,8080,8000,8443,23,5900,102,44818,20000 country:ae tag:ics",
    "Exposed ICS Web Dashboards":                    "port:102,502,44818,20000,47808,1911,2404 country:ae tag:ics",
    "Building Automation (OT-BMS) Exposure":         "port:47808 country:ae tag:ics",
    "OT Firmware & Update Server Exposure":          "port:102,502,44818,20000,2404,47808 country:ae tag:ics",
    "Modbus TCP Exposure – GCC & Jordan":            "country:AE,KW,QA,SA,OM,JO tag:ics",
}

SHODAN_COLUMNS = [
    "hash", "asn", "http", "os", "timestamp", "isp", "transport", "_shodan",
    "hostnames", "location", "ip", "domains", "org", "data", "port", "ip_str",
    "api", "city", "region_code", "area_code", "longitude", "latitude",
    "country_code", "country_name", "cloud", "product", "tags", "cpe23", "cpe",
    "version", "vulns", "ssl",
]

# ---------------------------------------------------------------------------
# SpiderSilk configuration
# ---------------------------------------------------------------------------

SS_API_KEY: str = os.getenv("SPIDERSILK_API_KEY", "")
SS_BASE_URL: str = os.getenv("SPIDERSILK_BASE_URL", "https://api.spidersilk.com")
SS_ENDPOINT: str = SS_BASE_URL.rstrip("/") + "/v1/assets"
SS_START_PAGE: int = int(os.getenv("PAGE", "1"))
SS_MAX_PAGES: int = int(os.getenv("SS_MAX_PAGES", "5"))
SS_PER_PAGE: int = int(os.getenv("PER_PAGE", "100"))
SS_SORT: Optional[str] = os.getenv("SORT")
SS_OUTPUT_FILE: str = os.getenv("OUTPUT_FILE", "spidersilk_output.json")

SS_DB_CONFIG: Dict[str, Any] = {
    "host": os.getenv("POSTGRES_HOST", "localhost"),
    "port": int(os.getenv("POSTGRES_PORT", "5432")),
    "dbname": os.getenv("POSTGRES_DB", "shodan_ot"),
    "user": os.getenv("POSTGRES_USER", "shodan_user"),
    "password": os.getenv("POSTGRES_PASSWORD", ""),
}

SS_CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS spidersilk_assets (
    id                    BIGSERIAL PRIMARY KEY,
    ip                    INET,
    port                  INTEGER,
    service               VARCHAR(255),
    scan_region           VARCHAR(255),
    tag                   VARCHAR(255),
    response_code         INTEGER,
    title                 TEXT,
    asn_number            INTEGER,
    asn_organization      VARCHAR(255),
    isp_name              VARCHAR(255),
    isp_organization      VARCHAR(255),
    location_continent    VARCHAR(100),
    location_country_iso  VARCHAR(10),
    location_country_name VARCHAR(255),
    location_city         VARCHAR(100),
    location_lat          DOUBLE PRECISION,
    location_long         DOUBLE PRECISION,
    headers_json          JSONB,
    ip_profile            JSONB,
    rdns_profile          JSONB,
    tech_stack_json       JSONB,
    vulnerabilities_json  JSONB,
    certificate_json      JSONB,
    ingested_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

SS_INSERT_SQL = """
INSERT INTO spidersilk_assets (
    ip, port, service, scan_region, tag, response_code, title,
    asn_number, asn_organization,
    isp_name, isp_organization,
    location_continent, location_country_iso, location_country_name,
    location_city, location_lat, location_long,
    headers_json, ip_profile, rdns_profile, tech_stack_json,
    vulnerabilities_json, certificate_json
)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
RETURNING id;
"""

# ===========================================================================
# Shodan helpers
# ===========================================================================

def fetch_shodan_data() -> pd.DataFrame:
    client = shodan.Shodan(SHODAN_API_KEY)
    rows = []

    for category, query in OT_EXPOSURE_CATEGORIES.items():
        try:
            total_items = client.search(query)["total"]
        except Exception as exc:
            logger.error(f"[Shodan] Error fetching total for '{category}': {exc}")
            continue

        num_pages = min(
            (total_items + MAX_ITEMS_PER_PAGE - 1) // MAX_ITEMS_PER_PAGE,
            MAX_PAGES,
        )
        logger.info(f"[Shodan] {category} — total: {total_items}, fetching {num_pages} pages")

        for page_no in range(num_pages):
            if (page_no + 1) % 5 == 0:
                logger.info(f"[Shodan] {category} — page {page_no + 1}/{num_pages}")
            try:
                info = client.search(query, page=page_no + 1)
            except Exception as exc:
                logger.error(f"[Shodan] Error on page {page_no + 1} for '{category}': {exc}")
                continue

            for match in info["matches"]:
                match["api"] = f"shodan/{category}"
                match["city"] = match["location"].get("city")
                match["region_code"] = match["location"].get("region_code")
                match["area_code"] = match["location"].get("area_code")
                match["longitude"] = match["location"].get("longitude")
                match["latitude"] = match["location"].get("latitude")
                match["country_code"] = match["location"].get("country_code")
                match["country_name"] = match["location"].get("country_name")
                rows.append({k: match.get(k) for k in SHODAN_COLUMNS})

    df = pd.DataFrame(rows, columns=SHODAN_COLUMNS)
    logger.info(f"[Shodan] Fetched {len(df)} total records")
    return df


async def run_shodan() -> None:
    from db.connection import close_pool, get_pool
    from db.insert import upsert_batch

    logger.info("=" * 60)
    logger.info("STEP 1 — Shodan ingestion")
    logger.info("=" * 60)

    df = fetch_shodan_data()

    if df.empty:
        logger.warning("[Shodan] No data fetched — skipping DB insert")
        return

    await get_pool()
    try:
        inserted = await upsert_batch(df)
        logger.success(f"[Shodan] {inserted} rows upserted into shodan_exposures")
    finally:
        await close_pool()


# ===========================================================================
# SpiderSilk helpers
# ===========================================================================

def _ss_to_int(x: Any) -> Optional[int]:
    try:
        return None if x is None else int(x)
    except (TypeError, ValueError):
        return None


def _ss_to_float(x: Any) -> Optional[float]:
    try:
        return None if x is None else float(x)
    except (TypeError, ValueError):
        return None


def _ss_request(
    session: requests.Session,
    url: str,
    headers: Dict[str, str],
    params: Dict[str, Any],
    retries: int = 3,
    backoff_base: float = 2.0,
) -> Tuple[int, Dict[str, Any]]:
    last_err = "unknown"
    for attempt in range(1, retries + 1):
        try:
            resp = session.request("POST", url, headers=headers, params=params, timeout=(10, 30))
            return resp.status_code, resp.json()
        except requests.RequestException as exc:
            last_err = f"{type(exc).__name__}: {exc}"
            if attempt < retries:
                time.sleep(backoff_base ** attempt)
    return 0, {"_request_error": last_err}


def _ss_extract_rows(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    results: List[Any] = (payload.get("data") or {}).get("results") or []
    rows = []
    for item in results:
        if not isinstance(item, dict):
            continue
        loc = item.get("location") if isinstance(item.get("location"), dict) else {}
        rows.append({
            "ip": item.get("ip"),
            "port": _ss_to_int(item.get("port")),
            "service": item.get("service"),
            "scan_region": item.get("scan_region"),
            "tag": item.get("tag"),
            "response_code": _ss_to_int(item.get("response_code")),
            "title": item.get("title"),
            "asn_number": _ss_to_int(item.get("asn_number")),
            "asn_organization": item.get("asn_organization"),
            "isp_name": item.get("isp_name"),
            "isp_organization": item.get("isp_organization"),
            "location_continent": loc.get("continent_name"),
            "location_country_iso": loc.get("country_iso"),
            "location_country_name": loc.get("country_name"),
            "location_city": loc.get("city_name"),
            "location_lat": _ss_to_float(loc.get("lat")),
            "location_long": _ss_to_float(loc.get("long")),
            "headers_json": item.get("headers") if isinstance(item.get("headers"), dict) else None,
            "ip_profile": item.get("ip_profile") if isinstance(item.get("ip_profile"), list) else None,
            "rdns_profile": item.get("r_dns_profile") if isinstance(item.get("r_dns_profile"), list) else None,
            "tech_stack_json": item.get("tech_stack") if isinstance(item.get("tech_stack"), list) else None,
            "vulnerabilities_json": item.get("vulnerabilities") if isinstance(item.get("vulnerabilities"), list) else None,
            "certificate_json": item.get("certificate") if isinstance(item.get("certificate"), dict) else None,
        })
    return rows


def run_spidersilk() -> None:
    """Sync function — safe to call from asyncio.to_thread()."""
    logger.info("=" * 60)
    logger.info("STEP 2 — SpiderSilk ingestion")
    logger.info("=" * 60)

    if not SS_API_KEY:
        logger.warning("[SpiderSilk] SPIDERSILK_API_KEY not set — skipping.")
        return

    headers = {
        "X-API-Key": SS_API_KEY,
        "accept": "application/json",
        "User-Agent": "spidersilk-assets-extractor/1.0",
    }

    logger.info(f"[SpiderSilk] Fetching up to {SS_MAX_PAGES} pages (per_page={SS_PER_PAGE})…")

    all_rows: List[Dict[str, Any]] = []

    with requests.Session() as session:
        for page_no in range(SS_START_PAGE, SS_START_PAGE + SS_MAX_PAGES):
            params: Dict[str, Any] = {"page": page_no, "per_page": SS_PER_PAGE}
            if SS_SORT:
                params["sort"] = SS_SORT

            status_code, payload = _ss_request(session, SS_ENDPOINT, headers, params)

            if status_code != 200 or not isinstance(payload, dict) or payload.get("status") != "success":
                logger.error(f"[SpiderSilk] Page {page_no} failed (HTTP {status_code}): {str(payload)[:300]}")
                break

            page_rows = _ss_extract_rows(payload)
            logger.info(f"[SpiderSilk] Page {page_no}: {len(page_rows)} records")
            all_rows.extend(page_rows)

            if len(page_rows) < SS_PER_PAGE:
                logger.info("[SpiderSilk] Last page reached — stopping early.")
                break

    logger.info(f"[SpiderSilk] Total extracted: {len(all_rows)} records.")

    if not all_rows:
        logger.warning("[SpiderSilk] No records extracted — skipping DB insert.")
        return

    try:
        with psycopg.connect(**SS_DB_CONFIG) as conn:
            with conn.cursor() as cur:
                cur.execute(SS_CREATE_TABLE_SQL)
                for row in all_rows:
                    cur.execute(SS_INSERT_SQL, (
                        row["ip"], row["port"], row["service"], row["scan_region"],
                        row["tag"], row["response_code"], row["title"],
                        row["asn_number"], row["asn_organization"],
                        row["isp_name"], row["isp_organization"],
                        row["location_continent"], row["location_country_iso"],
                        row["location_country_name"], row["location_city"],
                        row["location_lat"], row["location_long"],
                        json.dumps(row["headers_json"]) if row["headers_json"] else None,
                        json.dumps(row["ip_profile"]) if row["ip_profile"] else None,
                        json.dumps(row["rdns_profile"]) if row["rdns_profile"] else None,
                        json.dumps(row["tech_stack_json"]) if row["tech_stack_json"] else None,
                        json.dumps(row["vulnerabilities_json"]) if row["vulnerabilities_json"] else None,
                        json.dumps(row["certificate_json"]) if row["certificate_json"] else None,
                    ))
            conn.commit()
        logger.success(f"[SpiderSilk] {len(all_rows)} rows inserted into spidersilk_assets.")
    except Exception as exc:
        logger.error(f"[SpiderSilk] DB error: {exc}")
        return

    output = {
        "status": "success",
        "pages_fetched": SS_MAX_PAGES,
        "per_page": SS_PER_PAGE,
        "count": len(all_rows),
        "items": all_rows,
    }
    with open(SS_OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    logger.info(f"[SpiderSilk] Saved {len(all_rows)} items → {SS_OUTPUT_FILE}")


# ===========================================================================
# Combined entry point
# ===========================================================================

async def main() -> None:
    if not SHODAN_API_KEY:
        logger.error("SHODAN_API_KEY not set — aborting.")
        sys.exit(1)

    logger.info("Combined ingestion pipeline started")

    # Step 1 — Shodan (async)
    await run_shodan()

    # Step 2 — SpiderSilk (sync, runs in thread to avoid blocking event loop)
    await asyncio.to_thread(run_spidersilk)

    logger.info("Combined ingestion pipeline complete.")


if __name__ == "__main__":
    asyncio.run(main())
