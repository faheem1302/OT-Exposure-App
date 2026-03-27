import { useState, useMemo } from "react";
import MapView from "./components/MapView";
import FilterPanel, { API_CATEGORIES } from "./components/FilterPanel";
import DashboardPage from "./components/DashboardPage";
import SearchPage from "./components/SearchPage";
// Data hooks
import { useMapData } from "./hooks/useMapData";
import { useStatsSummary, useStatsTimeline, useStatsByPort, useStatsByCity, useStatsByProduct } from "./hooks/useStats";
import { useRiskScore, useTopOrgs, useCriticalIPs } from "./hooks/useRisk";
import { useGCCExposure } from "./hooks/useGCCExposure";
import cpxLogo from "./assets/cpx-logo.svg";
import "./App.css";

const DEFAULT_TILE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

function App() {
  const [activeCategories, setActiveCategories] = useState(
    () => new Set(API_CATEGORIES)
  );
  const [tileUrl, setTileUrl] = useState(DEFAULT_TILE);
  const [activePage, setActivePage] = useState("dashboard"); // "map" | "dashboard" | "search"

  function handleToggleCategory(cat, on) {
    setActiveCategories(prev => {
      const next = new Set(prev);
      if (on) next.add(cat);
      else next.delete(cat);
      return next;
    });
  }

  // ── Map data (GET /api/map/exposures) ─────────────────────────────────────
  const { data: mapData = [] } = useMapData({ limit: 10000 });

  // ── Header KPIs (GET /api/stats/summary) — kept for future use ───────────
  useStatsSummary();

  // ── Stats panel (GET /api/stats/by-category + /api/stats/timeline) ────────
  const { data: timeline = [] } = useStatsTimeline({ days: 90 });

  // ── Risk panel (GET /api/risk/score + /top-orgs + /critical-ips) ──────────
  const { data: riskScore }         = useRiskScore();
  const { data: topOrgs = [] }      = useTopOrgs({ limit: 10 });
  const { data: criticalIPs = [], isLoading: criticalIPsLoading } = useCriticalIPs({ limit: 100 });
  const { data: topPorts = [] }     = useStatsByPort({ limit: 15 });
  const { data: topCities = [] }    = useStatsByCity({ limit: 15 });
  const { data: topProducts = [] }  = useStatsByProduct({ limit: 15 });
  const { data: gccExposure = [] }  = useGCCExposure();

  // ── Client-side category filter applied to live map data ──────────────────
  const filtered = useMemo(
    () => mapData.filter(m => activeCategories.has(m.api)),
    [mapData, activeCategories]
  );

  // ── Exposed IPs: total individual IP records visible ──────────────────────
  const totalIPs = useMemo(() => filtered.length, [filtered]);

  // ── Orgs Exposed: unique organisations in the filtered dataset ───────────
  const orgsExposed = useMemo(
    () => new Set(filtered.map(m => m.org).filter(Boolean)).size,
    [filtered]
  );

  // ── Group markers: same org + same category → one pin, all IPs collected ──
  const groupedMarkers = useMemo(() => {
    const map = new Map();
    for (const m of filtered) {
      const key = `${m.org || ""}||${m.api}`;
      if (map.has(key)) {
        const g = map.get(key);
        g.count += 1;
        if (m.ips) g.ips.push(...m.ips);
      } else {
        map.set(key, { ...m, ips: m.ips ? [...m.ips] : [] });
      }
    }
    return Array.from(map.values());
  }, [filtered]);

  // ── Locations: number of pins actually placed on the map ─────────────────
  const uniqueLocations = groupedMarkers.length;

  return (
    <div className="app-root">
      {/* ── Top Header Bar ── */}
      <header className="app-header">
        <div className="header-left">
          <div className="header-logo-wrap">
            <img src={cpxLogo} alt="CPX" className="header-logo" />
          </div>
          <div className="header-divider" />
          <div className="header-titles">
            <span className="header-title">Threat Intelligence</span>
            <span className="header-subtitle">UAE OT/ICS Cyber Exposure Map</span>
          </div>
        </div>
        {activePage === "map" && (
          <div className="header-stats">
            <div className="stat-card">
              <span className="stat-value">{uniqueLocations.toLocaleString()}</span>
              <span className="stat-label">Locations</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{totalIPs.toLocaleString()}</span>
              <span className="stat-label">Exposed IPs</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{activeCategories.size}</span>
              <span className="stat-label">Categories</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{orgsExposed.toLocaleString()}</span>
              <span className="stat-label">Orgs Exposed</span>
            </div>
          </div>
        )}
        <div className="header-right">
          {/* ── Page Nav ── */}
          <div className="page-nav">
            <button
              className={`page-nav-btn${activePage === "dashboard" ? " page-nav-active" : ""}`}
              onClick={() => setActivePage("dashboard")}
            >
              📊 Dashboard
            </button>
            <button
              className={`page-nav-btn${activePage === "search" ? " page-nav-active" : ""}`}
              onClick={() => setActivePage("search")}
            >
              🔍 Search
            </button>
            <button
              className={`page-nav-btn${activePage === "map" ? " page-nav-active" : ""}`}
              onClick={() => setActivePage("map")}
            >
              🗺 Map
            </button>
          </div>
        </div>
      </header>

      {/* ── Map Page ── */}
      {activePage === "map" && (
        <div className="map-wrapper">
          <FilterPanel
            activeCategories={activeCategories}
            onToggleCategory={handleToggleCategory}
            markerCount={groupedMarkers.length}
            tileUrl={tileUrl}
            onTileChange={setTileUrl}
          />
          <MapView markers={groupedMarkers} tileUrl={tileUrl} />
        </div>
      )}

      {/* ── Search Page ── */}
      {activePage === "search" && <SearchPage />}

      {/* ── Dashboard Page ── */}
      {activePage === "dashboard" && (
        <DashboardPage
          orgsExposed={orgsExposed}
          timeline={timeline}
          riskScore={riskScore}
          topOrgs={topOrgs}
          criticalIPs={criticalIPs}
          criticalIPsLoading={criticalIPsLoading}
          topPorts={topPorts}
          topCities={topCities}
          topProducts={topProducts}
          gccExposure={gccExposure}
        />
      )}

    </div>
  );
}

export default App;
