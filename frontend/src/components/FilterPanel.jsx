export const API_CATEGORIES = [
  "Building Automation (OT-BMS) Exposure",
  "Exposed Engineering Workstations (EWS)",
  "Exposed ICS Web Dashboards",
  "Exposed OT Historians",
  "Exposed OT Remote Vendor Access",
  "Exposed PLC/RTU Protocols",
  "Exposed SCADA/HMI Interfaces",
  "ICS Default Credential Exposure",
  "Industrial Protocol Gateways(MQTT/AMQP)",
  "Industrial Protocol Gateways(Management & Proxy)",
  "Industrial Protocol Gateways(Orchestration/API)",
  "Industrial Wireless Exposure",
  "OT Firmware & Update Server Exposure",
  "Modbus TCP Exposure – GCC & Jordan",
];

// Must match API_COLORS in MapView.jsx
export const CATEGORY_COLORS = {
  "Building Automation (OT-BMS) Exposure":              "#CC66FF",
  "Exposed Engineering Workstations (EWS)":             "#E2231A",
  "Exposed ICS Web Dashboards":                         "#FF7800",
  "Exposed OT Historians":                              "#FFD700",
  "Exposed OT Remote Vendor Access":                    "#FFC300",
  "Exposed PLC/RTU Protocols":                          "#8B0000",
  "Exposed SCADA/HMI Interfaces":                       "#444444",
  "ICS Default Credential Exposure":                    "#999999",
  "Industrial Protocol Gateways(MQTT/AMQP)":            "#2ECC71",
  "Industrial Protocol Gateways(Management & Proxy)":   "#1A7A4A",
  "Industrial Protocol Gateways(Orchestration/API)":   "#5F9EA0",
  "Industrial Wireless Exposure":                       "#2980B9",
  "OT Firmware & Update Server Exposure":               "#1A3A6A",
  "Modbus TCP Exposure – GCC & Jordan":                 "#00BCD4",
};

const TILE_OPTIONS = [
  { label: "Satellite", value: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" },
  { label: "Voyager",   value: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" },
  { label: "Dark Matter", value: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" },
];

function FilterPanel({ activeCategories, onToggleCategory, markerCount, tileUrl, onTileChange }) {
  const allActive = API_CATEGORIES.every(c => activeCategories.has(c));

  function handleToggleAll() {
    const shouldActivate = !allActive;
    API_CATEGORIES.forEach(c => onToggleCategory(c, shouldActivate));
  }

  return (
    <div style={s.panel}>
      {/* Section: Map Style */}
      <div style={s.section}>
        <p style={s.sectionTitle}>MAP STYLE</p>
        <div style={s.tileGroup}>
          {TILE_OPTIONS.map(t => (
            <button
              key={t.value}
              onClick={() => onTileChange(t.value)}
              style={{
                ...s.tileBtn,
                ...(tileUrl === t.value ? s.tileBtnActive : {}),
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={s.divider} />

      {/* Section: Exposure Categories */}
      <div style={s.section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <p style={s.sectionTitle}>EXPOSURE CATEGORIES</p>
          <button onClick={handleToggleAll} style={s.toggleAllBtn}>
            {allActive ? "Deselect All" : "Select All"}
          </button>
        </div>

        <div style={s.categoryList}>
          {API_CATEGORIES.map(cat => {
            const active = activeCategories.has(cat);
            return (
              <label key={cat} style={{ ...s.categoryRow, opacity: active ? 1 : 0.45 }}>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={e => onToggleCategory(cat, e.target.checked)}
                  style={{ display: "none" }}
                />
                <span
                  style={{
                    ...s.colorDot,
                    background: CATEGORY_COLORS[cat],
                    boxShadow: active ? `0 0 6px ${CATEGORY_COLORS[cat]}99` : "none",
                  }}
                />
                <span style={s.catLabel}>{cat}</span>
                <span style={{ ...s.checkMark, visibility: active ? "visible" : "hidden" }}>✓</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div style={s.footer}>
        <span style={s.footerText}>
          {markerCount.toLocaleString()} location{markerCount !== 1 ? "s" : ""} visible
        </span>
      </div>
    </div>
  );
}

const s = {
  panel: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 1000,
    background: "linear-gradient(160deg, #0f0f1e 0%, #1a1a2e 100%)",
    border: "1px solid rgba(245,168,0,0.25)",
    borderRadius: 10,
    boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(245,168,0,0.05)",
    width: 290,
    maxHeight: "calc(100vh - 90px)",
    overflowY: "auto",
    color: "#e0e6f0",
    scrollbarWidth: "thin",
    scrollbarColor: "#F5A800 #1a1a2e",
  },
  section: {
    padding: "14px 16px",
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: "#F5A800",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    background: "rgba(245,168,0,0.15)",
    margin: "0 12px",
  },
  tileGroup: {
    display: "flex",
    gap: 6,
  },
  tileBtn: {
    flex: 1,
    padding: "5px 4px",
    fontSize: 11,
    fontWeight: 600,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 5,
    color: "#aab4c8",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  tileBtnActive: {
    background: "rgba(245,168,0,0.15)",
    border: "1px solid #F5A800",
    color: "#F5A800",
  },
  toggleAllBtn: {
    fontSize: 10,
    padding: "3px 8px",
    background: "rgba(245,168,0,0.1)",
    border: "1px solid rgba(245,168,0,0.3)",
    borderRadius: 4,
    color: "#F5A800",
    cursor: "pointer",
    fontWeight: 600,
    letterSpacing: 0.5,
  },
  categoryList: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  categoryRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "5px 8px",
    borderRadius: 6,
    cursor: "pointer",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.04)",
    transition: "all 0.15s",
    userSelect: "none",
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    flexShrink: 0,
    transition: "box-shadow 0.2s",
  },
  catLabel: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 1.3,
    color: "#cdd5e0",
  },
  checkMark: {
    fontSize: 11,
    color: "#F5A800",
    fontWeight: 700,
    flexShrink: 0,
  },
  footer: {
    padding: "8px 16px 12px",
    borderTop: "1px solid rgba(245,168,0,0.1)",
  },
  footerText: {
    fontSize: 11,
    color: "#5a6480",
  },
};

export default FilterPanel;
