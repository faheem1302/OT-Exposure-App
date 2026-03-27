import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl:       require("leaflet/dist/images/marker-icon.png"),
  shadowUrl:     require("leaflet/dist/images/marker-shadow.png"),
});

const API_COLORS = {
  "Building Automation (OT-BMS) Exposure":              "violet",
  "Exposed Engineering Workstations (EWS)":             "red",
  "Exposed ICS Web Dashboards":                         "orange",
  "Exposed OT Historians":                              "yellow",
  "Exposed OT Remote Vendor Access":                    "gold",
  "Exposed PLC/RTU Protocols":                          "darkred",
  "Exposed SCADA/HMI Interfaces":                       "black",
  "ICS Default Credential Exposure":                    "grey",
  "Industrial Protocol Gateways(MQTT/AMQP)":            "green",
  "Industrial Protocol Gateways(Management & Proxy)":   "darkgreen",
  "Industrial Protocol Gateways(Orchestration/API)":   "cadetblue",
  "Industrial Wireless Exposure":                       "blue",
  "OT Firmware & Update Server Exposure":               "darkblue",
  "Modbus TCP Exposure – GCC & Jordan":                 "lightblue",
};

const CATEGORY_ICONS = {
  "Building Automation (OT-BMS) Exposure":              "🏢",
  "Exposed Engineering Workstations (EWS)":             "💻",
  "Exposed ICS Web Dashboards":                         "🖥️",
  "Exposed OT Historians":                              "📊",
  "Exposed OT Remote Vendor Access":                    "🔗",
  "Exposed PLC/RTU Protocols":                          "⚙️",
  "Exposed SCADA/HMI Interfaces":                       "⚠️",
  "ICS Default Credential Exposure":                    "🔓",
  "Industrial Protocol Gateways(MQTT/AMQP)":            "📡",
  "Industrial Protocol Gateways(Management & Proxy)":   "🔀",
  "Industrial Protocol Gateways(Orchestration/API)":   "🌐",
  "Industrial Wireless Exposure":                       "📶",
  "OT Firmware & Update Server Exposure":               "💾",
  "Modbus TCP Exposure – GCC & Jordan":                 "⚡",
};

const RISK_LEVELS = {
  "Exposed OT Remote Vendor Access":                    { label: "CRITICAL", color: "#ff2d2d" },
  "ICS Default Credential Exposure":                    { label: "CRITICAL", color: "#ff2d2d" },
  "Exposed PLC/RTU Protocols":                          { label: "CRITICAL", color: "#ff2d2d" },
  "Exposed SCADA/HMI Interfaces":                       { label: "HIGH",     color: "#FF7800" },
  "Exposed Engineering Workstations (EWS)":             { label: "HIGH",     color: "#FF7800" },
  "Building Automation (OT-BMS) Exposure":              { label: "HIGH",     color: "#FF7800" },
  "Exposed ICS Web Dashboards":                         { label: "MEDIUM",   color: "#FFD700" },
  "Exposed OT Historians":                              { label: "MEDIUM",   color: "#FFD700" },
  "Industrial Protocol Gateways(MQTT/AMQP)":            { label: "MEDIUM",   color: "#FFD700" },
  "Industrial Protocol Gateways(Management & Proxy)":   { label: "MEDIUM",   color: "#FFD700" },
  "Industrial Protocol Gateways(Orchestration/API)":   { label: "MEDIUM",   color: "#FFD700" },
  "Industrial Wireless Exposure":                       { label: "MEDIUM",   color: "#FFD700" },
  "OT Firmware & Update Server Exposure":               { label: "LOW",      color: "#2ECC71" },
};

function createIcon(api) {
  const color = API_COLORS[api] || "grey";
  return new L.Icon({
    iconUrl:    `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl:  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
    iconSize:   [25, 41],
    iconAnchor: [12, 41],
    popupAnchor:[1, -34],
    shadowSize: [41, 41],
  });
}

function MarkerPopup({ m, maxCount }) {
  const risk = RISK_LEVELS[m.api] || { label: "LOW", color: "#2ECC71" };
  const icon = CATEGORY_ICONS[m.api] || "⚙️";
  const barPct = Math.min(100, Math.round((m.count / Math.max(maxCount, 1)) * 100));
  const displayIps = m.ips ? m.ips.slice(0, 8) : [];
  const extraIps = m.ips ? m.ips.length - displayIps.length : 0;

  return (
    <div style={ps.card}>
      {/* Header */}
      <div style={ps.header}>
        <span style={ps.iconBadge}>{icon}</span>
        <div style={ps.headerText}>
          <span style={ps.categoryName}>{m.api}</span>
          <span style={ps.orgName}>{m.org || "Unknown Organization"}</span>
        </div>
        <span style={{ ...ps.riskBadge, background: risk.color + "22", border: `1px solid ${risk.color}55`, color: risk.color }}>
          {risk.label}
        </span>
      </div>

      {/* Divider */}
      <div style={ps.divider} />

      {/* Location / City */}
      <div style={ps.infoSection}>
        <div style={ps.infoRow}>
          <span style={ps.infoIcon}>📍</span>
          <span style={ps.infoValue}>{m.lat.toFixed(5)}, {m.lng.toFixed(5)}</span>
        </div>
        <div style={ps.infoRow}>
          <span style={ps.infoIcon}>🏙️</span>
          <span style={ps.infoValue}>{m.city || "Unknown City"}</span>
        </div>
      </div>

      {/* Stat bar */}
      <div style={ps.statSection}>
        <div style={ps.statHeader}>
          <span style={ps.statLabel}>Exposure Count</span>
          <span style={{ ...ps.statValue, color: risk.color }}>{m.count}</span>
        </div>
        <div style={ps.statBarBg}>
          <div style={{ ...ps.statBarFill, width: `${barPct}%`, background: risk.color }} />
        </div>
      </div>

      {/* IP chips */}
      {displayIps.length > 0 && (
        <div style={ps.ipsSection}>
          <span style={ps.sectionLabel}>EXPOSED IPs ({m.ips.length})</span>
          <div style={ps.chipsWrap}>
            {displayIps.map(ip => (
              <span key={ip} style={ps.ipChip}>{ip}</span>
            ))}
            {extraIps > 0 && (
              <span style={{ ...ps.ipChip, ...ps.moreChip }}>+{extraIps} more</span>
            )}
          </div>
        </div>
      )}

      {/* Domains */}
      {m.domains && m.domains.length > 0 && (
        <div style={ps.ipsSection}>
          <span style={ps.sectionLabel}>DOMAINS ({m.domains.length})</span>
          <div style={ps.chipsWrap}>
            {m.domains.slice(0, 4).map(d => (
              <span key={d} style={{ ...ps.ipChip, color: "#aab4c8" }}>{d}</span>
            ))}
            {m.domains.length > 4 && (
              <span style={{ ...ps.ipChip, ...ps.moreChip }}>+{m.domains.length - 4} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MapView({ markers, tileUrl }) {
  const maxCount = useMemo(
    () => markers.reduce((max, m) => Math.max(max, m.count), 1),
    [markers]
  );

  return (
    <MapContainer
      center={[24.4539, 54.3773]}
      zoom={7}
      style={{ height: "100vh", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
        url={tileUrl}
      />
      <MarkerClusterGroup chunkedLoading>
        {markers.map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={createIcon(m.api)}
          >
            <Popup maxWidth={320} className="dark-popup">
              <MarkerPopup m={m} maxCount={maxCount} />
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}

// Popup inline styles
const ps = {
  card: {
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    color: "#e0e6f0",
    padding: "14px 14px 10px",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  iconBadge: {
    fontSize: 22,
    lineHeight: 1,
    flexShrink: 0,
    marginTop: 2,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: 700,
    color: "#e0e6f0",
    lineHeight: 1.3,
    wordBreak: "break-word",
  },
  orgName: {
    fontSize: 10.5,
    color: "#6a7590",
    lineHeight: 1.3,
    wordBreak: "break-word",
  },
  riskBadge: {
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: 1,
    padding: "3px 7px",
    borderRadius: 4,
    flexShrink: 0,
    marginTop: 2,
    whiteSpace: "nowrap",
  },
  divider: {
    height: 1,
    background: "rgba(245,168,0,0.12)",
    margin: "0 0 10px",
  },
  infoSection: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    marginBottom: 10,
  },
  infoRow: {
    display: "flex",
    alignItems: "center",
    gap: 7,
  },
  infoIcon: {
    fontSize: 13,
    flexShrink: 0,
  },
  infoValue: {
    fontSize: 11.5,
    color: "#aab4c8",
  },
  statSection: {
    marginBottom: 10,
  },
  statHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 9.5,
    color: "#6a7590",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: 600,
  },
  statValue: {
    fontSize: 11,
    fontWeight: 700,
  },
  statBarBg: {
    height: 5,
    background: "rgba(255,255,255,0.08)",
    borderRadius: 3,
    overflow: "hidden",
  },
  statBarFill: {
    height: "100%",
    borderRadius: 3,
    transition: "width 0.4s ease",
  },
  ipsSection: {
    marginBottom: 8,
  },
  sectionLabel: {
    display: "block",
    fontSize: 9,
    fontWeight: 700,
    color: "#F5A800",
    letterSpacing: 1.2,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  chipsWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
  },
  ipChip: {
    fontSize: 10,
    fontFamily: "'Courier New', monospace",
    color: "#c8d4e8",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 4,
    padding: "2px 6px",
    lineHeight: 1.4,
  },
  moreChip: {
    color: "#F5A800",
    background: "rgba(245,168,0,0.1)",
    border: "1px solid rgba(245,168,0,0.25)",
  },
};

export default MapView;
