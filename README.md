# OT/ICS Cybersecurity Exposure Dashboard

> A full-stack threat intelligence platform that discovers, tracks, and visualises internet-facing OT/ICS device exposures across the UAE and GCC region — powered by **Shodan** and **SpiderSilk**

---

## Overview

This project aggregates internet-facing industrial control system (ICS/SCADA) exposure data from two threat intelligence sources, stores it in PostgreSQL, and renders it through an interactive React dashboard. It is designed to give cybersecurity analysts a real-time picture of OT exposure risk across critical infrastructure sectors.

**What it shows:**
- Internet-exposed PLCs, HMIs, SCADA systems, OT historians, and engineering workstations
- Exposure by organisation, city, port, and product across UAE + GCC countries
- Risk scoring based on exposure volume, critical OT protocol ports, and known CVEs
- Natural language → SQL search interface
- Interactive Leaflet map with 14 categorised OT/ICS threat layers

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Docker Network (app-network)           │
│                                                          │
│  ┌──────────────────┐   ┌────────────────────────────┐  │
│  │  shodan_postgres  │   │        shodan_api           │  │
│  │  PostgreSQL 15    │◄──│  FastAPI · uvicorn :8000   │  │
│  │  port 5432        │   │  asyncpg connection pool   │  │
│  └──────────────────┘   └────────────────────────────┘  │
│           ▲                                              │
│  ┌────────┴─────────┐   ┌────────────────────────────┐  │
│  │ shodan_scheduler  │   │  shodan_pgadmin (optional) │  │
│  │  cron @ 05:00 AM  │   │  pgAdmin 4, port 5050      │  │
│  │  ingest.py        │   │  --profile admin only      │  │
│  └───────────────────┘   └────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘

                    ┌──────────────────────────┐
                    │   React Frontend (Nginx)  │
                    │   port 3000 / 80          │
                    │   TanStack Query · Leaflet│
                    └──────────────────────────┘

External APIs:
  Shodan API      ──► shodan_scheduler
  SpiderSilk API  ──► shodan_scheduler
  Anthropic API   ──► shodan_api (NL → SQL search)
```

**Data flow:**

```
Shodan API + SpiderSilk API
        │
        ▼
 ingestion/ingest.py  (ETL — upsert into PostgreSQL)
        │
        ▼
  shodan_exposures / spidersilk_assets  (PostgreSQL tables)
        │
        ▼
  FastAPI  (REST API, X-API-Key auth)
        │
        ▼
  api/*.js  (Axios)  →  hooks/*.js  (TanStack Query)  →  React components
```

---

## Repository Structure

```
Python Scripts/
│
├── README.md                     # This file
│
├── Shodan/                       # Backend (Python · FastAPI · Docker)
│   ├── DOCUMENTATION.md
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── requirements.txt
│   ├── .env.example
│   │
│   ├── app/
│   │   ├── main.py               # FastAPI app factory, middleware, lifespan
│   │   ├── auth.py               # X-API-Key authentication dependency
│   │   ├── config.py             # Pydantic Settings
│   │   ├── routers/              # exposures, gcc_exposure, map, risk, search,
│   │   │                         #   spidersilk, stats
│   │   └── schemas/              # Pydantic response models
│   │
│   ├── db/
│   │   ├── connection.py         # asyncpg pool singleton
│   │   └── insert.py             # Upsert helpers
│   │
│   ├── ingestion/
│   │   └── ingest.py             # Combined Shodan + SpiderSilk ETL
│   │
│   └── sql/
│       ├── create_tables.sql
│       └── create_indexes.sql
│
└── React/uae-map-app/            # Frontend (React 19 · TanStack Query · Leaflet)
    ├── DOCUMENTATION.md
    ├── package.json
    ├── nginx.conf
    ├── frontend/Dockerfile
    │
    └── src/
        ├── App.js                # Root — nav, routing, top-level data hooks
        ├── api/                  # Axios functions (one file per backend router)
        ├── hooks/                # TanStack Query wrappers
        └── components/           # DashboardPage, SearchPage, MapView, …
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Database | PostgreSQL 15 |
| Backend API | Python 3.11 · FastAPI · asyncpg · uvicorn |
| ETL / Ingestion | Shodan SDK · requests · pandas · psycopg3 |
| AI / NL Search | LLM API |
| Frontend | React 19 · TanStack Query v5 · Axios |
| Map | Leaflet · react-leaflet · react-leaflet-cluster |
| Auth | API key header (`X-API-Key`) — SlowAPI rate limiting |
| Containerisation | Docker Compose (4 services) |
| Frontend serving | Nginx (production), CRA dev server (development) |

---

## Dashboard Features

### KPI Cards

| Card | Metric |
|---|---|
| Total Exposures | `COUNT(*)` from `shodan_exposures` |
| Unique IPs | `COUNT(DISTINCT ip_str)` — deduplicated IPs |
| Orgs Exposed | Unique organisations in map data |
| Critical OT Ports | Exposures on ports 102, 502, 44818, 20000 |
| Known CVEs | Records with at least one CVE |

### Risk Score Formula

```
score = (exposure_component × 0.40)
      + (critical_port_component × 0.35)
      + (vuln_component × 0.25)
```

Each component is independently normalised to 0–100.

### Pages

| Page | Description |
|---|---|
| **Dashboard** | KPI cards, timeline sparkline, top orgs/ports/cities/products, GCC pie chart, critical IPs |
| **Search** | Type a plain-English question → LLM generates SQL → results table |
| **Map** | Interactive Leaflet map, 14 OT/ICS category layers, cluster markers, tile switcher |

### OT/ICS Exposure Categories (Shodan)

| Category | Protocols / Focus |
|---|---|
| Exposed SCADA/HMI Interfaces | HTTP/S, ICS ports |
| Exposed PLC/RTU Protocols | Modbus (502), S7 (102), EtherNet/IP (44818) |
| Exposed Engineering Workstations | Multi-protocol |
| Exposed OT Remote Vendor Access | VNC (5900), RDP (3389), RTSP (554) |
| Exposed OT Historians | OSIsoft PI, Wonderware ports |
| Industrial Protocol Gateways (Products) | Moxa, Anybus, HMS Networks |
| Industrial Protocol Gateways (MQTT/AMQP) | Port 1883, 8883, 5671, 5672 |
| Industrial Protocol Gateways (Web/Dashboards) | Port 1880, 3000–3005, 8880 |
| Industrial Protocol Gateways (Orchestration/API) | Salt, Kubernetes, Consul ports |
| Industrial Protocol Gateways (Management & Proxy) | TR-069, Squid, custom ports |
| Industrial Wireless Exposure | CoAP, ZigBee, LoRa, SNMP |
| ICS Default Credential Exposure | Admin ports with default creds |
| Exposed ICS Web Dashboards | Visualisation platforms |
| Building Automation (OT-BMS) Exposure | BACnet port 47808 |
| OT Firmware & Update Server Exposure | ICS update endpoints |
| Modbus TCP Exposure – GCC & Jordan | Port 502 across AE, KW, QA, SA, OM, JO |

---

## API Reference

All endpoints require `X-API-Key` header. Interactive docs at `http://localhost:8000/docs`.

| Group | Method | Path | Description |
|---|---|---|---|
| Health | GET | `/health` | Liveness probe (no auth) |
| Health | GET | `/ready` | Readiness — DB reachability check (no auth) |
| Map | GET | `/api/map/exposures` | All exposure map points |
| Map | GET | `/api/map/clusters` | Clustered map points |
| Stats | GET | `/api/stats/summary` | Total exposures, unique IPs, orgs, ports |
| Stats | GET | `/api/stats/by-category` | Count per Shodan category |
| Stats | GET | `/api/stats/by-city` | Top cities by exposure count |
| Stats | GET | `/api/stats/top-ports` | Most common exposed ports |
| Stats | GET | `/api/stats/top-products` | Most common detected products |
| Stats | GET | `/api/stats/timeline` | Daily ingestion counts over time |
| Exposures | GET | `/api/exposures` | Paginated list with filters |
| Exposures | GET | `/api/exposures/{id}` | Single exposure detail |
| Exposures | GET | `/api/exposures/export/csv` | Streaming CSV export |
| Risk | GET | `/api/risk/score` | Composite risk score + breakdown |
| Risk | GET | `/api/risk/top-orgs` | Top orgs by exposure + CVE count |
| Risk | GET | `/api/risk/critical-ips` | IPs with known CVEs |
| GCC | GET | `/api/gcc_exposure` | Exposure per GCC country |
| Search | POST | `/api/search` | NL query → SQL → results |
| SpiderSilk | GET | `/api/spidersilk/assets` | Paginated SpiderSilk assets |
| SpiderSilk | GET | `/api/spidersilk/summary` | SpiderSilk KPIs |
| SpiderSilk | GET | `/api/spidersilk/by-country` | Assets per country |
| SpiderSilk | GET | `/api/spidersilk/by-service` | Top services |
| SpiderSilk | GET | `/api/spidersilk/by-port` | Top ports |
| SpiderSilk | GET | `/api/spidersilk/vuln-by-country` | Vulnerable vs clean by country |

---

## Database Schema

### `shodan_exposures`

| Column | Type | Notes |
|---|---|---|
| `id` | `BIGSERIAL PK` | Auto-increment |
| `hash` | `BIGINT UNIQUE` | Shodan hash — upsert key |
| `ip_str` | `VARCHAR(45)` | IP address (string) |
| `port` | `INTEGER` | Exposed port |
| `transport` | `VARCHAR(10)` | `tcp` or `udp` |
| `asn` | `VARCHAR(50)` | Autonomous system number |
| `isp` | `TEXT` | Internet service provider |
| `org` | `TEXT` | Organisation |
| `country_code` | `VARCHAR(5)` | ISO 3166-1 alpha-2 |
| `city` | `VARCHAR(100)` | City |
| `latitude` / `longitude` | `DOUBLE PRECISION` | Geo coordinates |
| `product` / `version` | `VARCHAR` | Detected product & version |
| `vulns` | `JSONB` | CVE map from Shodan |
| `ssl` | `JSONB` | TLS certificate metadata |
| `api` | `TEXT` | Source category (`shodan/<Category>`) |
| `timestamp` | `TIMESTAMP` | Shodan scan time |
| `ingested_at` | `TIMESTAMP` | Row insert time |

### `spidersilk_assets`

| Column | Type | Notes |
|---|---|---|
| `id` | `BIGSERIAL PK` | Auto-increment |
| `ip` | `INET` | IP address |
| `port` | `INTEGER` | |
| `service` | `VARCHAR(255)` | Detected service |
| `scan_region` | `VARCHAR(255)` | SpiderSilk scan region |
| `response_code` | `INTEGER` | HTTP response code |
| `asn_number` / `asn_organization` | `INTEGER` / `VARCHAR` | ASN info |
| `isp_name` / `isp_organization` | `VARCHAR` | ISP info |
| `location_country_iso` | `VARCHAR(10)` | ISO country code |
| `location_city` | `VARCHAR(100)` | City |
| `location_lat` / `location_long` | `DOUBLE PRECISION` | Geo coordinates |
| `headers_json` | `JSONB` | HTTP response headers |
| `ip_profile` | `JSONB` | IP reputation profile |
| `tech_stack_json` | `JSONB` | Detected technologies |
| `vulnerabilities_json` | `JSONB` | Known vulnerabilities |
| `certificate_json` | `JSONB` | TLS certificate details |
| `ingested_at` | `TIMESTAMP` | Insert timestamp |

---

## Environment Variables

### Backend (`Shodan/.env`)

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_USER` | Yes | Database username |
| `POSTGRES_PASSWORD` | Yes | Database password |
| `POSTGRES_DB` | Yes | Database name |
| `POSTGRES_HOST` | Yes | `postgres` inside Docker |
| `POSTGRES_PORT` | Yes | Default `5432` |
| `SHODAN_API_KEY` | Yes | From account.shodan.io |
| `SPIDERSILK_API_KEY` | Yes | SpiderSilk API key |
| `SPIDERSILK_BASE_URL` | Yes | SpiderSilk base URL |
| `ANTHROPIC_API_KEY` | Yes | Claude API key (NL → SQL) |
| `DASHBOARD_API_KEY` | Yes | Shared secret for `X-API-Key` header |
| `SHODAN_MAX_PAGES` | No | Max pages per Shodan query (default `20`) |
| `SS_MAX_PAGES` | No | SpiderSilk pages per run (default `5`) |
| `API_PORT` | No | API bind port (default `8000`) |
| `CORS_ORIGINS` | No | JSON array of allowed frontend origins |

### Frontend (`React/uae-map-app/.env.development` / `.env.production`)

| Variable | Required | Description |
|---|---|---|
| `REACT_APP_API_URL` | Yes | FastAPI backend URL (e.g. `http://localhost:8000`) |
| `REACT_APP_API_KEY` | Yes | Same value as `DASHBOARD_API_KEY` |

---

## Setup & Deployment

### Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine + Compose plugin (Linux)
- Node.js 18+ (for local frontend development only)
- Git

### Backend — First-time Setup

```bash
cd "Python Scripts/Shodan"

# Create environment file
cp .env.example .env
# Edit .env — fill in all API keys and passwords

# Build and start all services
docker compose up -d --build

# Verify services are healthy
docker compose ps

# Trigger first data ingestion
docker exec shodan_scheduler sh -c "python /app/ingestion/ingest.py"

# Confirm API is responding
curl -H "X-API-Key: your_dashboard_key" http://localhost:8000/health
```

### Frontend — Development

```bash
cd "Python Scripts/React/uae-map-app"

# Create env file
cp .env.example .env.development
# Set REACT_APP_API_URL=http://localhost:8000
# Set REACT_APP_API_KEY=<your DASHBOARD_API_KEY>

npm install
npm start
# Opens http://localhost:3000
```

### Frontend — Production Docker Build

```bash
cd "Python Scripts/React/uae-map-app"
docker build -f frontend/Dockerfile -t uae-map-frontend .
docker run -p 80:80 uae-map-frontend
```

### Rebuild after code changes

```bash
# Backend
docker compose up -d --build fastapi_app
docker compose up -d --build shodan_scheduler

# Frontend (dev)
npm start   # hot-reloads automatically
```

---

## Common Operations

```bash
# View live logs
docker compose logs -f
docker compose logs -f fastapi_app

# Check ingestion cron log
docker exec shodan_scheduler cat /var/log/shodan_cron.log

# Run ingestion manually
docker exec shodan_scheduler sh -c "python /app/ingestion/ingest.py"

# Run SpiderSilk with more pages
docker exec shodan_scheduler sh -c "SS_MAX_PAGES=10 python /app/ingestion/ingest.py"

# Check record counts
docker exec shodan_postgres psql -U shodan_user -d shodan_ot \
  -c "SELECT COUNT(*) FROM shodan_exposures;"

docker exec shodan_postgres psql -U shodan_user -d shodan_ot \
  -c "SELECT COUNT(*) FROM spidersilk_assets;"

# Open pgAdmin GUI
docker compose --profile admin up -d
# → http://localhost:5050

# Stop all services (keep data)
docker compose down

# Stop all services and delete data volumes
docker compose down -v
```

---

## Authentication

All API routes (except `/health` and `/ready`) require:

```http
X-API-Key: <DASHBOARD_API_KEY>
```

Missing or invalid key returns `401 Unauthorized`:

```json
{ "detail": "Invalid or missing API key." }
```

Rate limit: **100 requests / minute per IP** — exceeding returns `429 Too Many Requests`.

---

## Data Ingestion Pipeline

The ingestion script (`Shodan/ingestion/ingest.py`) runs in two sequential steps on a **daily cron at 05:00 AM**:

1. **Shodan (async)** — Queries 16 OT/ICS search categories → upserts records into `shodan_exposures` using the Shodan `hash` as the deduplication key
2. **SpiderSilk (sync/threaded)** — Fetches up to `SS_MAX_PAGES × 100` asset records from `POST /v1/assets` → inserts into `spidersilk_assets`

```python
async def main():
    await run_shodan()                      # async — asyncpg
    await asyncio.to_thread(run_spidersilk) # sync — psycopg3, non-blocking via thread
```

---

## Detailed Documentation

- [Backend Documentation](Shodan/DOCUMENTATION.md) — full API reference, DB schema, Docker services, ingestion details
- [Frontend Documentation](React/uae-map-app/DOCUMENTATION.md) — component reference, hooks, map config, caching strategy
