# OT/ICS Cybersecurity Exposure Dashboard — Frontend Documentation

> **Stack:** React 19 · TanStack Query v5 · Axios · Leaflet · react-leaflet
> **Build tool:** Create React App (react-scripts 5)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Directory Structure](#3-directory-structure)
4. [Environment Variables](#4-environment-variables)
5. [Pages & Navigation](#5-pages--navigation)
6. [Component Reference](#6-component-reference)
7. [API Layer](#7-api-layer)
8. [Hooks Reference](#8-hooks-reference)
9. [Map Configuration](#9-map-configuration)
10. [Data Caching Strategy](#10-data-caching-strategy)
11. [Authentication](#11-authentication)
12. [Docker & Nginx](#12-docker--nginx)
13. [Setup & Development](#13-setup--development)

---

## 1. Project Overview

React single-page application that visualises internet-facing OT/ICS device exposures discovered by **Shodan** and **SpiderSilk**. It connects to the FastAPI backend and provides three main views:

- **Dashboard** — KPI cards, GCC country breakdown pie chart, sparkline timeline, top organisations, critical IPs
- **Search** — Natural language → SQL interface powered by Claude AI
- **Map** — Interactive Leaflet map with clustered markers, category filters, and tile switcher

---

## 2. Architecture

```
src/
│
├── index.js              ← React root, QueryClientProvider, ErrorBoundary
├── App.js                ← Layout shell, nav, page routing, top-level data fetching
│
├── api/                  ← Axios functions (one file per backend router)
│   └── client.js         ← Shared axios instance + request/response interceptors
│
├── hooks/                ← TanStack Query wrappers (one file per domain)
│
└── components/           ← UI components (pages + panels)
```

**Data flow:**

```
Backend API
    │
    ▼
api/*.js  (axios calls)
    │
    ▼
hooks/*.js  (useQuery wrappers — cache, loading, error state)
    │
    ▼
App.js  (calls hooks, passes data as props)
    │
    ▼
components/  (pure presentational, render props)
```

All server state lives in **TanStack Query**. No Redux or Context is used for data.

---

## 3. Directory Structure

```
uae-map-app/
│
├── DOCUMENTATION.md          # This file
├── package.json
├── .env.development          # Dev environment variables
├── .env.production           # Prod environment variables
├── .env.example              # Safe template (no secrets)
├── nginx.conf                # Nginx config for production container
│
├── frontend/
│   └── Dockerfile            # Production Docker image (nginx)
│
├── public/
│   ├── index.html
│   ├── manifest.json
│   └── favicon.ico
│
└── src/
    ├── index.js              # App entry point — QueryClient, ErrorBoundary
    ├── App.js                # Root component — nav, routing, global data hooks
    ├── App.css               # Global layout styles
    ├── ErrorBoundary.js      # Class-based error boundary for API failures
    │
    ├── api/                  # Axios API functions
    │   ├── client.js         # Base axios instance, interceptors
    │   ├── exposuresApi.js   # /api/exposures/* endpoints
    │   ├── gccApi.js         # /api/gcc_exposure/* endpoints
    │   ├── mapApi.js         # /api/map/* endpoints
    │   ├── riskApi.js        # /api/risk/* endpoints
    │   ├── searchApi.js      # /api/search/* endpoints
    │   ├── spidersilkApi.js  # /api/spidersilk/* endpoints
    │   └── statsApi.js       # /api/stats/* endpoints
    │
    ├── hooks/                # TanStack Query hooks
    │   ├── useExposures.js   # useExposures, useExposure
    │   ├── useGCCExposure.js # useGCCExposure
    │   ├── useMapData.js     # useMapData, useMapClusters
    │   ├── useRisk.js        # useTopOrgs, useCriticalIPs, useRiskScore
    │   ├── useSpiderSilk.js  # useSSByService, useSSByCountry, etc.
    │   └── useStats.js       # useStatsSummary, useStatsTimeline, etc.
    │
    ├── components/
    │   ├── DashboardPage.jsx # Full-screen dashboard with charts & KPIs
    │   ├── SearchPage.jsx    # NL → SQL search interface
    │   ├── MapView.jsx       # Leaflet map with clustered markers
    │   ├── FilterPanel.jsx   # Category filter sidebar + tile switcher
    │   ├── BottomDrawer.jsx  # Slide-up panel (Stats / Risk / Exposures tabs)
    │   └── panels/
    │       ├── StatsCharts.jsx    # Category sparklines + bar charts
    │       ├── RiskDashboard.jsx  # Critical IPs table + org risk bars
    │       └── ExposuresTable.jsx # Paginated exposure data table
    │
    ├── assets/
    │   └── cpx-logo.svg
    │
    └── data/
        ├── shodanData.json   # Static fallback data (dev use)
        └── uaeMarkers.js     # Legacy static markers
```

---

## 4. Environment Variables

Create `.env.development` and `.env.production` from `.env.example`.

| Variable | Required | Description |
|---|---|---|
| `REACT_APP_API_URL` | Yes | Base URL of the FastAPI backend (e.g. `http://localhost:8000`) |
| `REACT_APP_API_KEY` | Yes | API key sent as `X-API-Key` header on every request |

> **Note:** React env vars must be prefixed `REACT_APP_` to be embedded at build time. They are **not** available at runtime — the app must be rebuilt when these values change.

**Example `.env.development`:**
```
REACT_APP_API_URL=http://localhost:8000
REACT_APP_API_KEY=your_api_key_here
```

**Example `.env.production`:**
```
REACT_APP_API_URL=http://your-server-ip:8000
REACT_APP_API_KEY=your_api_key_here
```

---

## 5. Pages & Navigation

Navigation is tab-based, managed by `activePage` state in `App.js`. The default landing page is **Dashboard**.

| Page | `activePage` value | Component | Description |
|---|---|---|---|
| Dashboard | `"dashboard"` | `DashboardPage` | KPI cards, charts, risk overview |
| Search | `"search"` | `SearchPage` | NL → SQL query interface |
| Map | `"map"` | `MapView` + `BottomDrawer` + `FilterPanel` | Interactive exposure map |

**Nav order:** Dashboard → Search → Map

Switching pages does **not** re-fetch data — TanStack Query cache keeps all data in memory across page switches for the duration of the `gcTime` (10 minutes).

---

## 6. Component Reference

### `App.js`

Root component. Responsibilities:
- Renders the top navigation bar with the CPX logo
- Manages `activePage`, `activeCategories`, `tileUrl` state
- Calls all top-level data hooks and passes data as props to child pages
- Groups map markers by organisation + category for the map view

**Key state:**

| State | Type | Description |
|---|---|---|
| `activePage` | `string` | Current page: `"dashboard"` \| `"search"` \| `"map"` |
| `activeCategories` | `Set<string>` | Categories visible on the map |
| `tileUrl` | `string` | Active map tile layer URL |
| `drawerOpen` | `boolean` | Whether the BottomDrawer is expanded |
| `activeTab` | `string` | Active BottomDrawer tab |

---

### `DashboardPage.jsx`

Full-page cybersecurity dashboard. Receives all data as props from `App.js`.

**KPI cards (top row):**

| Card | Source | Description |
|---|---|---|
| Total Exposures | `riskScore.total_exposures` | COUNT(*) from shodan_exposures |
| Unique IPs | `riskScore.unique_ips` | COUNT(DISTINCT ip_str) |
| Orgs Exposed | `orgsExposed` (local) | Unique orgs in map data |
| Critical OT Ports | `riskScore.critical_port_exposures` | Exposures on ports 102, 502, 44818, 20000 |
| Known CVEs | `riskScore.total_vulns` | Records with at least one CVE |

**Chart sections:**

| Section | Data source | Chart type |
|---|---|---|
| Exposure Timeline | `useStatsTimeline` | SVG sparkline area chart |
| Top Ports | `useStatsByPort` | Horizontal bar chart |
| Top Cities | `useStatsByCity` | Horizontal bar chart |
| Top Products | `useStatsByProduct` | Horizontal bar chart |
| GCC Exposure | `useGCCExposure` | Donut pie chart (pure SVG) |
| Critical IPs | `useCriticalIPs` | Scrollable card list |

**Inline SVG charts:** All charts are implemented as hand-coded SVG — no third-party charting library is used.

**Sub-components in this file:**

| Component | Description |
|---|---|
| `GCCPieChart` | Donut chart for GCC & Jordan country breakdown |
| `Sparkline` | Area sparkline for timeline data |
| `IconShield`, `IconServer`, `IconBuilding`, `IconAlert`, `IconBug` | Inline SVG icon components |

---

### `SearchPage.jsx`

Natural language query interface.

**How it works:**
1. User types a question (or clicks a suggested chip)
2. `generateSQL()` POSTs to `/api/search/nl2sql` → Claude AI returns a SQL query
3. User reviews the generated SQL (can edit it)
4. `executeSQL()` POSTs to `/api/search/execute` → results returned as rows/columns
5. Results rendered in a scrollable table

**Suggested queries** (built-in chips):
- "Show top 10 organizations with the most CVEs"
- "List all exposed Modbus devices in UAE"
- "Which cities have the most SCADA/HMI exposures?"
- "Find all critical OT ports exposed in Saudi Arabia"
- … and 6 more

**Features:**
- Copy-to-clipboard button for generated SQL
- Row count and truncation notice
- Loading spinner during both generation and execution phases

---

### `MapView.jsx`

Leaflet map rendering OT/ICS exposure markers.

**Map features:**
- **Tile layers:** Satellite (ArcGIS), Voyager (CartoCDN), Dark Matter (CartoCDN)
- **Clustering:** `react-leaflet-cluster` groups nearby markers automatically
- **Marker colours:** Each of the 14 OT/ICS categories has a distinct Leaflet colour
- **Popups:** Clicking a cluster or marker shows IP addresses, organisation, category, port

**Category → colour mapping** (matches `FilterPanel.jsx`):

| Category | Map colour |
|---|---|
| Building Automation (OT-BMS) Exposure | violet |
| Exposed Engineering Workstations (EWS) | red |
| Exposed ICS Web Dashboards | orange |
| Exposed OT Historians | yellow |
| Exposed OT Remote Vendor Access | gold |
| Exposed PLC/RTU Protocols | darkred |
| Exposed SCADA/HMI Interfaces | black |
| ICS Default Credential Exposure | grey |
| Industrial Protocol Gateways (MQTT/AMQP) | green |
| Industrial Protocol Gateways (Management & Proxy) | darkgreen |
| Industrial Protocol Gateways (Orchestration/API) | cadetblue |
| Industrial Wireless Exposure | blue |
| OT Firmware & Update Server Exposure | darkblue |
| Modbus TCP Exposure – GCC & Jordan | lightblue |

---

### `FilterPanel.jsx`

Left sidebar on the Map page.

- Checkbox list for the 14 OT/ICS exposure categories
- Colour swatches matching map marker colours
- Tile layer radio buttons (Satellite / Voyager / Dark Matter)
- Select All / Clear All controls

Exports:
- `API_CATEGORIES` — ordered array of all 14 category names
- `CATEGORY_COLORS` — hex colour map (used by `StatsCharts.jsx` for bar colours)

---

### `BottomDrawer.jsx`

Slide-up panel on the Map page with 3 tabs:

| Tab | Component | Content |
|---|---|---|
| STATS | `StatsCharts` | Timeline sparkline + category/port/city breakdowns |
| RISK | `RiskDashboard` | Critical IPs with CVE count + org risk score bars |
| EXPOSURES | `ExposuresTable` | Full paginated + filterable exposure data table |

Clicking a tab when drawer is closed → opens drawer to that tab.
Clicking the active tab again → collapses the drawer.

---

### `panels/StatsCharts.jsx`

Statistics charts for the BottomDrawer Stats tab:

- **Timeline sparkline** — SVG area chart of daily ingestion counts
- **Category bar chart** — horizontal bars per OT/ICS category, coloured by `CATEGORY_COLORS`
- **Top ports** — horizontal bar chart

---

### `panels/RiskDashboard.jsx`

Risk overview for the BottomDrawer Risk tab:

- **Critical IPs table** — IP, Category, Organisation, Port, CVE count badge
- **Top organisations** — horizontal bar chart with risk score (0–100), colour-coded: green < 40, orange 40–70, red ≥ 70

**Risk score colour thresholds:**

| Score range | Colour |
|---|---|
| ≥ 70 | Red `#ff2d2d` |
| 40–69 | Orange `#FF7800` |
| < 40 | Green `#2ECC71` |

---

### `panels/ExposuresTable.jsx`

Paginated, filterable data table for the BottomDrawer Exposures tab.

**Columns:** IP Address · Category · Organisation · City · Port · Seen (timestamp)

**Filter controls:**
- Free-text search (debounced 400 ms)
- Category dropdown (all 14 categories)
- City text filter
- Column header click to sort (asc/desc toggle)

**Pagination:** 20 rows per page, previous/next controls.

**CSV export:** Calls `getExposuresCsvUrl()` which streams the full dataset as a `.csv` download directly from the backend.

---

## 7. API Layer

All API calls go through a single **axios instance** (`src/api/client.js`).

### `client.js`

```
baseURL  = REACT_APP_API_URL (default: http://localhost:8000)
timeout  = 30 000 ms
headers  = Content-Type: application/json
```

**Request interceptor** — attaches `X-API-Key` header from `REACT_APP_API_KEY` on every outgoing request.

**Response interceptor** — logs `[API Error] <url> <status> <message>` to console on any non-2xx response.

---

### API files

| File | Backend router | Functions |
|---|---|---|
| `exposuresApi.js` | `/api/exposures` | `getExposures(params)`, `getExposureById(id)`, `getExposuresCsvUrl()` |
| `gccApi.js` | `/api/gcc_exposure` | `getGCCExposureByCountry()` |
| `mapApi.js` | `/api/map` | `getMapExposures(params)`, `getMapClusters(params)` |
| `riskApi.js` | `/api/risk` | `getTopOrgs(params)`, `getCriticalIPs(params)`, `getRiskScore()` |
| `searchApi.js` | `/api/search` | `generateSQL(question)`, `executeSQL(sql)` |
| `spidersilkApi.js` | `/api/spidersilk` | `getSSByService()`, `getSSByCountry()`, `getSSVulnByCountry()`, `getSSSummary()` |
| `statsApi.js` | `/api/stats` | `getStatsSummary()`, `getStatsByCategory(params)`, `getStatsByCity(params)`, `getStatsByPort(params)`, `getStatsByProduct(params)`, `getStatsTimeline(params)` |

---

### `getExposures` query parameters

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | int | 1 | Page number |
| `page_size` | int | 50 | Rows per page |
| `category` | string | — | Filter by OT/ICS category |
| `city` | string | — | Filter by city |
| `port` | int | — | Filter by port number |
| `org` | string | — | Filter by organisation (partial) |
| `search` | string | — | Full-text search |
| `sort_by` | string | `"timestamp"` | Column to sort |
| `sort_order` | string | `"desc"` | `"asc"` or `"desc"` |

---

## 8. Hooks Reference

All hooks use **TanStack Query v5** (`@tanstack/react-query`). Default cache settings:

```js
staleTime: 5 * 60 * 1000   // 5 minutes — data considered fresh
gcTime:   10 * 60 * 1000   // 10 minutes — unused cache retained
```

Global defaults in `index.js`:
```js
retry: false                // no automatic retries on error
refetchOnWindowFocus: false // no background refetch when tab regains focus
```

### Hook index

| Hook | File | Query key | Returns |
|---|---|---|---|
| `useMapData(params)` | `useMapData.js` | `["map","exposures", params]` | Transformed `MapPoint[]` |
| `useMapClusters(params)` | `useMapData.js` | `["map","clusters", params]` | `ClusterPoint[]` |
| `useStatsSummary()` | `useStats.js` | `["stats","summary"]` | `StatsSummary` |
| `useStatsByCategory(params)` | `useStats.js` | `["stats","by-category", params]` | `CategoryStat[]` (prefix stripped) |
| `useStatsByCity(params)` | `useStats.js` | `["stats","by-city", params]` | `CityStat[]` |
| `useStatsByPort(params)` | `useStats.js` | `["stats","by-port", params]` | `PortStat[]` |
| `useStatsByProduct(params)` | `useStats.js` | `["stats","by-product", params]` | `ProductStat[]` |
| `useStatsTimeline(params)` | `useStats.js` | `["stats","timeline", params]` | `TimelinePoint[]` |
| `useRiskScore()` | `useRisk.js` | `["risk","score"]` | `RiskScore` |
| `useTopOrgs(params)` | `useRisk.js` | `["risk","top-orgs", params]` | `TopOrg[]` |
| `useCriticalIPs(params)` | `useRisk.js` | `["risk","critical-ips", params]` | `CriticalIP[]` |
| `useGCCExposure()` | `useGCCExposure.js` | `["gcc_exposure","by-country"]` | `GCCCountryStat[]` |
| `useExposures(params)` | `useExposures.js` | `["exposures","list", params]` | `PaginatedResponse<Exposure>` |
| `useExposure(id)` | `useExposures.js` | `["exposures","detail", id]` | `Exposure` (disabled when `id` null) |
| `useSSByService()` | `useSpiderSilk.js` | `["ss","by-service"]` | `ServiceStat[]` |
| `useSSByCountry()` | `useSpiderSilk.js` | `["ss","by-country"]` | `CountryStat[]` |
| `useSSVulnByCountry()` | `useSpiderSilk.js` | `["ss","vuln-by-country"]` | `VulnCountryStat[]` |
| `useSSSummary()` | `useSpiderSilk.js` | `["ss","summary"]` | `SpiderSilkSummary` |

### `useMapData` — coordinate transform

The map API returns `{ latitude, longitude }` but `MapView` expects `{ lat, lng }`. `useMapData` applies this transform automatically:

```js
{
  lat: point.latitude,
  lng: point.longitude,
  api: point.api.replace(/^shodan\//, ""),  // strip "shodan/" prefix
  ips: [point.ip_str],
  count: 1,
}
```

---

## 9. Map Configuration

### Tile layers

| Label | Provider | URL pattern |
|---|---|---|
| Satellite | ArcGIS World Imagery | `server.arcgisonline.com/…/World_Imagery/…` |
| Voyager | CartoCDN | `basemaps.cartocdn.com/rastertiles/voyager/…` |
| Dark Matter | CartoCDN | `basemaps.cartocdn.com/dark_all/…` |

Default tile: **Satellite**

### OT/ICS categories

14 categories are defined in `FilterPanel.jsx` as `API_CATEGORIES`. These map 1-to-1 with the Shodan search query names used in the backend ingestion script.

The `FilterPanel` and `MapView` both import or mirror the same category → colour mapping to ensure visual consistency between the legend and markers.

---

## 10. Data Caching Strategy

TanStack Query is configured globally in `index.js`:

```js
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      console.error(`[QueryCache Error] key=${JSON.stringify(query.queryKey)}`, error?.message);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime:   10 * 60 * 1000,
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});
```

**Implications:**
- All API data is cached for 5 minutes — switching between pages does not re-fetch
- After 10 minutes of no active subscribers, cache entries are garbage collected
- Failed requests are **not** retried automatically (backend errors are not transient)
- Tab focus does not trigger background refetches

---

## 11. Authentication

The frontend attaches the API key automatically via an **Axios request interceptor** in `client.js`:

```js
apiClient.interceptors.request.use((config) => {
  const key = process.env.REACT_APP_API_KEY;
  if (key) config.headers["X-API-Key"] = key;
  return config;
});
```

This runs on **every request** — no manual header management needed in individual API files.

The key value is read from `REACT_APP_API_KEY` in the `.env` file at **build time**. It must match `DASHBOARD_API_KEY` in the backend `.env`.

---

## 12. Docker & Nginx

### Production build

The `frontend/Dockerfile` builds a static production bundle served by Nginx:

```
Stage 1 (node:18-alpine) — npm run build → /app/build
Stage 2 (nginx:alpine)   — copies build output → /usr/share/nginx/html
```

### Nginx configuration (`nginx.conf`)

Key settings:
- Serves `index.html` for all routes (SPA fallback) — supports client-side routing
- Proxies `/api/*` requests to the backend (`fastapi_app:8000`) — avoids CORS in production
- Gzip compression enabled for JS/CSS/HTML

### Running with Docker

```bash
# Build and start (production)
docker compose up -d --build

# Frontend available at
http://localhost:3000   # (or configured port)
```

---

## 13. Setup & Development

### Prerequisites

- Node.js 18+
- npm 9+

### Install dependencies

```bash
cd "Python Scripts/React/uae-map-app"
npm install
```

### Configure environment

```bash
cp .env.example .env.development
# Edit .env.development — set REACT_APP_API_URL and REACT_APP_API_KEY
```

### Start development server

```bash
npm start
# Opens http://localhost:3000
# Hot-reloads on file save
```

### Build for production

```bash
npm run build
# Output in build/ directory
```

### Run tests

```bash
npm test
```

### Adding a new API endpoint

1. Add the axios function to the relevant file in `src/api/`
2. Add a `useQuery` hook in the relevant file in `src/hooks/`
3. Call the hook in `App.js` (or the component that needs it)
4. Pass data as a prop to the component

**Example:**

```js
// src/api/statsApi.js
export async function getStatsByRegion({ limit = 10 } = {}) {
  const { data } = await apiClient.get("/api/stats/by-region", { params: { limit } });
  return data;
}

// src/hooks/useStats.js
export function useStatsByRegion(params = {}) {
  return useQuery({
    queryKey: ["stats", "by-region", params],
    queryFn: () => getStatsByRegion(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
```

---

*Generated for OT/ICS Cybersecurity Exposure Dashboard — React Frontend v1.0.0*
