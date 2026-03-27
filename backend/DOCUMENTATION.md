# OT/ICS Cybersecurity Exposure Dashboard — Backend Documentation

> **Stack:** Python 3.11 · FastAPI · PostgreSQL 15 · asyncpg · Docker Compose
> **Version:** 1.0.0

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Directory Structure](#3-directory-structure)
4. [Docker Services](#4-docker-services)
5. [Environment Variables](#5-environment-variables)
6. [Database Schema](#6-database-schema)
7. [API Reference](#7-api-reference)
8. [Authentication](#8-authentication)
9. [Data Ingestion Pipeline](#9-data-ingestion-pipeline)
10. [Rate Limiting](#10-rate-limiting)
11. [Setup & Deployment](#11-setup--deployment)
12. [Common Operations](#12-common-operations)

---

## 1. Project Overview

This backend powers an OT/ICS (Operational Technology / Industrial Control System) Cybersecurity Exposure Dashboard. It aggregates internet-facing device data from two external threat intelligence sources — **Shodan** and **SpiderSilk** — stores it in PostgreSQL, and exposes a REST API consumed by a React frontend.

**Key capabilities:**

- **Exposure tracking** — discovers ICS/SCADA devices exposed to the internet across 16 Shodan query categories
- **Risk scoring** — composite risk score based on exposure volume, critical OT ports, and CVEs
- **Geographic analysis** — per-country breakdowns for GCC nations (AE, KW, QA, SA, OM) and Jordan (JO)
- **SpiderSilk integration** — parallel asset dataset with tech stack, vulnerability, and certificate metadata
- **Natural language search** — Claude AI (Anthropic) converts plain-English questions into SQL queries
- **Scheduled ingestion** — cron job runs daily at 05:00 AM to refresh data

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Docker Network (app-network)          │
│                                                           │
│  ┌─────────────────┐    ┌──────────────────────────────┐ │
│  │  shodan_postgres │    │        shodan_api             │ │
│  │  PostgreSQL 15   │◄───│   FastAPI (uvicorn, port 8000)│ │
│  │  port 5432       │    │   asyncpg connection pool     │ │
│  └─────────────────┘    └──────────────────────────────┘ │
│          ▲                                                 │
│          │                                                 │
│  ┌───────┴──────────┐    ┌──────────────────────────────┐ │
│  │ shodan_scheduler  │    │   shodan_pgadmin (optional)  │ │
│  │  cron @ 05:00 AM  │    │   pgAdmin 4, port 5050       │ │
│  │  ingest.py        │    │   --profile admin only        │ │
│  └──────────────────┘    └──────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘

External APIs:
  Shodan API ──────► shodan_scheduler
  SpiderSilk API ──► shodan_scheduler
  Anthropic API ───► shodan_api (search router)
```

**Data flow:**

1. `shodan_scheduler` calls Shodan API + SpiderSilk API → writes to PostgreSQL
2. React frontend → `X-API-Key` header → `shodan_api` → PostgreSQL → JSON response

---

## 3. Directory Structure

```
Shodan/
│
├── DOCUMENTATION.md            # This file
├── Dockerfile                  # Multi-stage Python 3.11-slim image
├── docker-compose.yml          # 4-service composition
├── requirements.txt            # Python dependencies
├── .env                        # Secrets & config (never commit)
├── .env.example                # Safe template to share
├── .gitignore
│
├── app/                        # FastAPI application
│   ├── main.py                 # App factory, middleware, lifespan, health probes
│   ├── auth.py                 # API key header authentication dependency
│   ├── config.py               # Pydantic Settings (reads .env)
│   │
│   ├── routers/                # One file per API domain
│   │   ├── exposures.py        # Paginated exposure list, detail, CSV export
│   │   ├── gcc_exposure.py     # GCC & Jordan country breakdown
│   │   ├── map.py              # MapPoint / ClusterPoint for map rendering
│   │   ├── risk.py             # Risk score, top orgs, critical IPs
│   │   ├── search.py           # NL → SQL via Claude AI
│   │   ├── spidersilk.py       # SpiderSilk asset data endpoints
│   │   └── stats.py            # Dashboard KPIs, timeline, breakdowns
│   │
│   └── schemas/                # Pydantic response models
│       ├── exposure.py         # Exposure, MapPoint, RiskScore, …
│       └── spidersilk.py       # SpiderSilkAsset, SpiderSilkSummary, …
│
├── db/
│   ├── connection.py           # asyncpg pool singleton (get_pool / close_pool)
│   └── insert.py               # Upsert helpers for shodan_exposures
│
├── ingestion/
│   └── ingest.py               # Combined Shodan + SpiderSilk ETL script
│
└── sql/
    ├── create_tables.sql       # DDL for shodan_exposures, spidersilk_assets
    └── create_indexes.sql      # Performance indexes
```

---

## 4. Docker Services

### `postgres` — PostgreSQL 15

| Property | Value |
|---|---|
| Image | `postgres:15-alpine` |
| Container | `shodan_postgres` |
| Internal port | `5432` |
| Init scripts | `sql/create_tables.sql`, `sql/create_indexes.sql` (run once on first boot) |
| Healthcheck | `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB` every 10 s |
| Persistence | Named volume `postgres_data` |

### `fastapi_app` — REST API

| Property | Value |
|---|---|
| Build | `Dockerfile` (same image as scheduler) |
| Container | `shodan_api` |
| Port | `8000:8000` |
| Command | `uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1` |
| Healthcheck | `curl --fail http://localhost:8000/health` every 30 s |
| Depends on | `postgres` (healthy) |

### `shodan_scheduler` — Ingestion Cron

| Property | Value |
|---|---|
| Build | Same `Dockerfile` |
| Container | `shodan_scheduler` |
| Schedule | Daily at **05:00 AM** (`0 5 * * *`) |
| Script | `python /app/ingestion/ingest.py` |
| Logs | `/var/log/shodan_cron.log` inside container |
| Depends on | `postgres` (healthy) |

### `pgadmin` — Database GUI (optional)

| Property | Value |
|---|---|
| Image | `dpage/pgadmin4:latest` |
| Container | `shodan_pgadmin` |
| Port | `5050:80` |
| Activation | `docker compose --profile admin up` |
| Auth | `PGADMIN_DEFAULT_EMAIL` / `PGADMIN_DEFAULT_PASSWORD` from `.env` |

---

## 5. Environment Variables

Copy `.env.example` to `.env` and fill in all values. **Never commit `.env`.**

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_USER` | Yes | Database username |
| `POSTGRES_PASSWORD` | Yes | Database password |
| `POSTGRES_DB` | Yes | Database name |
| `POSTGRES_HOST` | Yes | Hostname (use `postgres` inside Docker) |
| `POSTGRES_PORT` | Yes | Port (default `5432`) |
| `SHODAN_API_KEY` | Yes | Shodan API key from account.shodan.io |
| `SPIDERSILK_API_KEY` | Yes | SpiderSilk API key |
| `SPIDERSILK_BASE_URL` | Yes | SpiderSilk base URL (e.g. `https://silknet.spidersilk.com`) |
| `ANTHROPIC_API_KEY` | Yes | Claude API key for NL→SQL search feature |
| `DASHBOARD_API_KEY` | Yes | Shared secret sent as `X-API-Key` header by the frontend |
| `SHODAN_MAX_PAGES` | No | Max pages to fetch per Shodan query (default `20`) |
| `SHODAN_MAX_ITEMS_PER_PAGE` | No | Items per Shodan page (default `100`) |
| `SS_MAX_PAGES` | No | SpiderSilk pages to fetch per run (default `5`) |
| `API_HOST` | No | Bind host (default `0.0.0.0`) |
| `API_PORT` | No | Bind port (default `8000`) |
| `CORS_ORIGINS` | No | JSON array of allowed origins (e.g. `["http://localhost:3000"]`) |
| `PGADMIN_DEFAULT_EMAIL` | No | pgAdmin login email |
| `PGADMIN_DEFAULT_PASSWORD` | No | pgAdmin login password |

---

## 6. Database Schema

### `shodan_exposures`

Primary table for Shodan-sourced ICS/OT exposure records.

| Column | Type | Notes |
|---|---|---|
| `id` | `BIGSERIAL PK` | Auto-increment |
| `hash` | `BIGINT UNIQUE` | Shodan record hash — used for upsert deduplication |
| `ip_str` | `VARCHAR(45)` | IP address string |
| `ip` | `BIGINT` | Numeric IP |
| `port` | `INTEGER` | Exposed port |
| `transport` | `VARCHAR(10)` | `tcp` or `udp` |
| `asn` | `VARCHAR(50)` | Autonomous system number |
| `isp` | `TEXT` | Internet service provider |
| `org` | `TEXT` | Organisation name |
| `country_code` | `VARCHAR(5)` | ISO 3166-1 alpha-2 |
| `country_name` | `VARCHAR(100)` | Full country name |
| `city` | `VARCHAR(100)` | City |
| `region_code` | `VARCHAR(20)` | Region/state code |
| `latitude` | `DOUBLE PRECISION` | |
| `longitude` | `DOUBLE PRECISION` | |
| `data` | `TEXT` | Raw Shodan banner text |
| `product` | `VARCHAR(255)` | Detected product name |
| `version` | `VARCHAR(100)` | Detected product version |
| `os` | `VARCHAR(100)` | Operating system |
| `tags` | `TEXT[]` | Shodan tags (e.g. `{ics}`) |
| `vulns` | `JSONB` | CVE map from Shodan |
| `ssl` | `JSONB` | SSL certificate metadata |
| `api` | `TEXT` | Source category (e.g. `shodan/Exposed SCADA/HMI Interfaces`) |
| `timestamp` | `TIMESTAMP` | Shodan scan timestamp |
| `ingested_at` | `TIMESTAMP` | When this row was written |

### `spidersilk_assets`

SpiderSilk internet asset exposure records.

| Column | Type | Notes |
|---|---|---|
| `id` | `BIGSERIAL PK` | Auto-increment |
| `ip` | `INET` | IP address |
| `port` | `INTEGER` | |
| `service` | `VARCHAR(255)` | Detected service name |
| `scan_region` | `VARCHAR(255)` | SpiderSilk scan region |
| `tag` | `VARCHAR(255)` | Asset tag |
| `response_code` | `INTEGER` | HTTP response code |
| `title` | `TEXT` | Page title |
| `asn_number` | `INTEGER` | ASN number |
| `asn_organization` | `VARCHAR(255)` | ASN org name |
| `isp_name` | `VARCHAR(255)` | ISP name |
| `isp_organization` | `VARCHAR(255)` | ISP org |
| `location_continent` | `VARCHAR(100)` | |
| `location_country_iso` | `VARCHAR(10)` | ISO country code |
| `location_country_name` | `VARCHAR(255)` | Full country name |
| `location_city` | `VARCHAR(100)` | |
| `location_lat` | `DOUBLE PRECISION` | |
| `location_long` | `DOUBLE PRECISION` | |
| `headers_json` | `JSONB` | HTTP response headers |
| `ip_profile` | `JSONB` | IP reputation profile |
| `rdns_profile` | `JSONB` | Reverse DNS data |
| `tech_stack_json` | `JSONB` | Detected technologies |
| `vulnerabilities_json` | `JSONB` | Known vulnerabilities |
| `certificate_json` | `JSONB` | TLS certificate details |
| `ingested_at` | `TIMESTAMP` | Insert timestamp |

---

## 7. API Reference

All endpoints require the `X-API-Key` header (see [Authentication](#8-authentication)).
Interactive docs available at `http://localhost:8000/docs` when running.

### Health (no auth required)

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness probe — always `200 OK` |
| `GET` | `/ready` | Readiness probe — `200` if DB reachable, `503` otherwise |

### Map — `/api/map`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/map/exposures` | All exposure points for map rendering (`MapPoint[]`) |
| `GET` | `/api/map/clusters` | Clustered points for heatmap/cluster view |

### Statistics — `/api/stats`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/stats/summary` | Total exposures, unique IPs, orgs, port count |
| `GET` | `/api/stats/by-category` | Count per Shodan query category |
| `GET` | `/api/stats/by-city` | Top cities by exposure count |
| `GET` | `/api/stats/top-ports` | Most common exposed ports |
| `GET` | `/api/stats/top-products` | Most common detected products |
| `GET` | `/api/stats/timeline` | Daily ingestion counts over time |

### Exposures — `/api/exposures`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/exposures` | Paginated list with filter/sort query params |
| `GET` | `/api/exposures/{id}` | Single exposure detail |
| `GET` | `/api/exposures/export/csv` | Streaming CSV export of full dataset |

**Query parameters for list endpoint:**

| Param | Type | Description |
|---|---|---|
| `page` | int | Page number (default 1) |
| `page_size` | int | Items per page (default 50, max 200) |
| `country_code` | str | Filter by country (e.g. `AE`) |
| `port` | int | Filter by port |
| `org` | str | Filter by organisation (partial match) |
| `sort_by` | str | Column to sort by |
| `sort_dir` | str | `asc` or `desc` |

### Risk — `/api/risk`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/risk/score` | Composite risk score + breakdown components |
| `GET` | `/api/risk/top-orgs` | Top organisations ranked by exposure + CVE count |
| `GET` | `/api/risk/critical-ips` | IPs with known CVEs, sorted by severity |

**Risk score formula:**

```
score = (exposure_component × 0.4) + (critical_port_component × 0.35) + (vuln_component × 0.25)
```

Each component is independently normalised to 0–100.

### GCC Exposure — `/api/gcc_exposure`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/gcc_exposure` | Exposure count per country (AE, KW, QA, SA, OM, JO) |

Returns `country_code`, `country_name`, and `count` for each country with records.

### Search — `/api/search`

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/search` | Natural language → SQL → results |

**Request body:**

```json
{ "query": "Show me all exposed Modbus devices in Saudi Arabia" }
```

**How it works:**
1. Sends the question + table schema to Claude (Anthropic API)
2. Claude returns a `SELECT` statement
3. The backend validates it is read-only (no DML) and executes it
4. Results returned as JSON rows

### SpiderSilk — `/api/spidersilk`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/spidersilk/assets` | Paginated asset list |
| `GET` | `/api/spidersilk/summary` | KPIs: total assets, unique IPs, countries |
| `GET` | `/api/spidersilk/by-country` | Asset count per country |
| `GET` | `/api/spidersilk/by-service` | Top services by asset count |
| `GET` | `/api/spidersilk/by-port` | Top ports by asset count |
| `GET` | `/api/spidersilk/vuln-by-country` | Vulnerable vs clean assets per country |

---

## 8. Authentication

All API routes (except `/health` and `/ready`) are protected by an API key check.

**Header name:** `X-API-Key`
**Value:** matches `DASHBOARD_API_KEY` in `.env`

```bash
curl -H "X-API-Key: your_key_here" http://localhost:8000/api/stats/summary
```

Requests without a valid key return:

```json
{ "detail": "Invalid or missing API key." }
```
HTTP status: `401 Unauthorized`

**Implementation:** `app/auth.py` — FastAPI `Security` dependency using `APIKeyHeader`, applied globally via `dependencies=[Depends(verify_api_key)]` on the `FastAPI()` instance.

---

## 9. Data Ingestion Pipeline

The combined ingestion script (`ingestion/ingest.py`) runs in two sequential steps:

### Step 1 — Shodan (async)

Queries 16 OT/ICS Shodan search categories for UAE and GCC countries:

| Category | Protocol/Focus |
|---|---|
| Exposed SCADA/HMI Interfaces | HTTP/S, ICS ports |
| Exposed PLC/RTU Protocols | Modbus, S7, EtherNet/IP |
| Exposed Engineering Workstations | Multi-protocol |
| Exposed OT Remote Vendor Access | VNC, RDP, RTSP |
| Exposed OT Historians | OSIsoft PI, Wonderware |
| Industrial Protocol Gateways | MQTT, AMQP, Web dashboards |
| Industrial Wireless Exposure | Zigbee, LoRa, CoAP |
| ICS Default Credential Exposure | Common admin ports |
| Exposed ICS Web Dashboards | Visualisation platforms |
| Building Automation (OT-BMS) | BACnet (port 47808) |
| OT Firmware & Update Servers | ICS update endpoints |
| Modbus TCP Exposure – GCC & Jordan | Port 502 across 6 countries |

Records are **upserted** on `hash` to avoid duplicates across runs.

### Step 2 — SpiderSilk (sync, threaded)

Fetches up to `SS_MAX_PAGES` pages (default 5 × 100 = 500 records) from the SpiderSilk `/v1/assets` endpoint using `POST` requests. Records are **inserted** into `spidersilk_assets` on each run (no deduplication — truncate table first if re-running).

```python
# Entry point
async def main():
    await run_shodan()                      # async — uses asyncpg
    await asyncio.to_thread(run_spidersilk) # sync — uses psycopg3, run in thread
```

### Running ingestion manually

```bash
docker exec shodan_scheduler sh -c "python /app/ingestion/ingest.py"
```

### Adjusting page limits

```bash
# Fetch 10 SpiderSilk pages in this run only
docker exec shodan_scheduler sh -c "SS_MAX_PAGES=10 python /app/ingestion/ingest.py"
```

---

## 10. Rate Limiting

All endpoints are rate-limited via **SlowAPI** (wraps Redis-less in-memory limiting).

| Limit | Scope |
|---|---|
| 100 requests / minute | Per IP address (default global limit) |

When the limit is exceeded the API returns `429 Too Many Requests`.

To adjust the default limit, modify in `app/main.py`:

```python
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
```

---

## 11. Setup & Deployment

### Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine + Compose plugin (Linux)
- Git

### First-time setup

```bash
# 1. Clone the repo and enter the Shodan directory
cd "Python Scripts/Shodan"

# 2. Create your .env from the template
cp .env.example .env
# Edit .env and fill in all required values

# 3. Start all services (builds images on first run)
docker compose up -d --build

# 4. Verify everything is healthy
docker compose ps

# 5. Trigger first ingestion run manually
docker exec shodan_scheduler sh -c "python /app/ingestion/ingest.py"

# 6. Check API is responding
curl -H "X-API-Key: your_key" http://localhost:8000/health
```

### Rebuilding after code changes

```bash
# Rebuild only the affected service
docker compose up -d --build fastapi_app
docker compose up -d --build shodan_scheduler
```

### Viewing logs

```bash
# Live logs for all services
docker compose logs -f

# Single service
docker compose logs -f fastapi_app
docker compose logs -f shodan_scheduler

# Cron ingestion log inside scheduler container
docker exec shodan_scheduler cat /var/log/shodan_cron.log
```

### Starting pgAdmin (database GUI)

```bash
docker compose --profile admin up -d
# Open http://localhost:5050
# Server: postgres | Port: 5432 | DB: shodan_ot | User: shodan_user
```

### Stopping everything

```bash
docker compose down          # stop containers, keep volumes
docker compose down -v       # stop and delete all data volumes (destructive)
```

---

## 12. Common Operations

### Check record counts

```bash
# Shodan exposures
docker exec shodan_postgres psql -U shodan_user -d shodan_ot \
  -c "SELECT COUNT(*) FROM shodan_exposures;"

# SpiderSilk assets
docker exec shodan_postgres psql -U shodan_user -d shodan_ot \
  -c "SELECT COUNT(*) FROM spidersilk_assets;"
```

### Check SpiderSilk data by country

```bash
docker exec shodan_postgres psql -U shodan_user -d shodan_ot \
  -c "SELECT location_country_name, COUNT(*) FROM spidersilk_assets GROUP BY 1 ORDER BY 2 DESC LIMIT 10;"
```

### Verify API endpoints

```bash
# Risk score
curl -s -H "X-API-Key: your_key" http://localhost:8000/api/risk/score | python -m json.tool

# SpiderSilk summary
curl -s -H "X-API-Key: your_key" http://localhost:8000/api/spidersilk/summary | python -m json.tool

# GCC exposure breakdown
curl -s -H "X-API-Key: your_key" http://localhost:8000/api/gcc_exposure | python -m json.tool
```

### Clear and re-ingest SpiderSilk data

```bash
# Truncate the table first (SpiderSilk inserts are not deduplicated)
docker exec shodan_postgres psql -U shodan_user -d shodan_ot \
  -c "TRUNCATE TABLE spidersilk_assets RESTART IDENTITY;"

# Re-run ingestion
docker exec shodan_scheduler sh -c "python /app/ingestion/ingest.py"
```

### Interactive psql session

```bash
docker exec shodan_postgres psql -U shodan_user -d shodan_ot
```

---

*Generated for OT/ICS Cybersecurity Exposure Dashboard v1.0.0*
