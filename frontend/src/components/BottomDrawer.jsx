import StatsCharts   from "./panels/StatsCharts";
import RiskDashboard from "./panels/RiskDashboard";
import ExposuresTable from "./panels/ExposuresTable";

const TABS = [
  { id: "stats",     label: "📊  STATS"     },
  { id: "risk",      label: "🛡️  RISK"      },
  { id: "data",      label: "🔍  EXPOSURES" },
];

const DRAWER_HEIGHT = "47vh";
const HANDLE_HEIGHT = 36;

function BottomDrawer({
  isOpen, onToggle,
  activeTab, onTabChange,
  categoryStats, timeline,
  riskScore, topOrgs, criticalIPs, topPorts,
}) {
  function handleTabClick(tabId) {
    if (!isOpen) {
      onTabChange(tabId);
      onToggle();
    } else if (activeTab === tabId) {
      onToggle();           // clicking active tab collapses
    } else {
      onTabChange(tabId);
    }
  }

  return (
    <div style={{
      ...s.drawer,
      height: isOpen ? DRAWER_HEIGHT : `${HANDLE_HEIGHT}px`,
    }}>

      {/* ── Handle / Tab Bar ── */}
      <div style={s.handle}>
        <span style={s.handleLabel}>INTELLIGENCE DASHBOARD</span>

        <div style={s.tabs}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => handleTabClick(t.id)}
              style={{
                ...s.tab,
                ...(activeTab === t.id && isOpen ? s.tabActive : {}),
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button onClick={onToggle} style={s.chevron} aria-label="toggle drawer">
          {isOpen ? "▼" : "▲"}
        </button>
      </div>

      {/* ── Panel Content ── */}
      {isOpen && (
        <div style={s.content}>
          {activeTab === "stats" && (
            <StatsCharts categoryStats={categoryStats} timeline={timeline} />
          )}
          {activeTab === "risk" && (
            <RiskDashboard riskScore={riskScore} topOrgs={topOrgs} criticalIPs={criticalIPs} topPorts={topPorts} />
          )}
          {activeTab === "data" && (
            <ExposuresTable />
          )}
        </div>
      )}
    </div>
  );
}

const s = {
  drawer: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1500,
    background: "linear-gradient(180deg, #111124 0%, #0d0d1a 100%)",
    borderTop: "1px solid rgba(245,168,0,0.3)",
    boxShadow: "0 -4px 24px rgba(0,0,0,0.6)",
    display: "flex",
    flexDirection: "column",
    transition: "height 0.3s cubic-bezier(0.4,0,0.2,1)",
    overflow: "hidden",
  },
  handle: {
    height: 36,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    padding: "0 14px",
    gap: 12,
    borderBottom: "1px solid rgba(245,168,0,0.1)",
    userSelect: "none",
  },
  handleLabel: {
    fontSize: 8.5,
    fontWeight: 700,
    color: "#3a4055",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },
  tabs: {
    display: "flex",
    gap: 4,
    flex: 1,
  },
  tab: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.8,
    padding: "4px 12px",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 4,
    color: "#5a6480",
    cursor: "pointer",
    transition: "all 0.15s",
    whiteSpace: "nowrap",
  },
  tabActive: {
    background: "rgba(245,168,0,0.12)",
    border: "1px solid rgba(245,168,0,0.4)",
    color: "#F5A800",
  },
  chevron: {
    fontSize: 11,
    color: "#5a6480",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 4,
    padding: "2px 8px",
    cursor: "pointer",
    marginLeft: "auto",
    transition: "color 0.2s",
  },
  content: {
    flex: 1,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
};

export default BottomDrawer;
