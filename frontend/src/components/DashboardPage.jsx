
// ── Helpers ────────────────────────────────────────────────────────────────

const GCC_COLORS = {
  AE: "#00c8ff",
  SA: "#34d399",
  JO: "#f59e0b",
  QA: "#a78bfa",
  OM: "#fb923c",
  KW: "#f87171",
};

const GCC_NAMES = {
  AE: "UAE",
  SA: "Saudi Arabia",
  JO: "Jordan",
  QA: "Qatar",
  OM: "Oman",
  KW: "Kuwait",
};

function GCCPieChart({ data }) {
  if (!data || data.length === 0) {
    return <p style={{ fontSize: 12, color: "#4a5568", fontStyle: "italic", fontFamily: "'Space Mono',monospace" }}>Loading…</p>;
  }
  const total = data.reduce((s, d) => s + d.count, 0);
  const cx = 90, cy = 90, R = 76, r = 46;

  let angle = -Math.PI / 2;
  const slices = data.map(d => {
    const start = angle;
    const sweep = (d.count / total) * 2 * Math.PI;
    angle += sweep;
    return { ...d, start, end: angle, sweep, color: GCC_COLORS[d.country_code] || "#555" };
  });

  function arcPath({ start, end, sweep }) {
    const x1 = cx + R * Math.cos(start), y1 = cy + R * Math.sin(start);
    const x2 = cx + R * Math.cos(end),   y2 = cy + R * Math.sin(end);
    const ix1 = cx + r * Math.cos(end),  iy1 = cy + r * Math.sin(end);
    const ix2 = cx + r * Math.cos(start),iy2 = cy + r * Math.sin(start);
    const lg = sweep > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${R} ${R} 0 ${lg} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${r} ${r} 0 ${lg} 0 ${ix2} ${iy2} Z`;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flex: 1, minHeight: 0 }}>
      <svg viewBox="0 0 180 180" style={{ width: 150, height: 150, flexShrink: 0 }}>
        {slices.map(s => (
          <path key={s.country_code} d={arcPath(s)} fill={s.color} opacity={0.9} />
        ))}
        <text x={cx} y={cy - 8} textAnchor="middle" fill="#e2e8f0" fontSize={17} fontWeight={700} fontFamily="'Space Mono',monospace">
          {total.toLocaleString()}
        </text>
        <text x={cx} y={cy + 9}  textAnchor="middle" fill="#4a5568" fontSize={9} fontFamily="'Space Mono',monospace">TOTAL</text>
        <text x={cx} y={cy + 21} textAnchor="middle" fill="#4a5568" fontSize={9} fontFamily="'Space Mono',monospace">EXPOSURES</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
        {slices.map(s => (
          <div key={s.country_code} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12, color: "#e2e8f0", fontFamily: "'Space Grotesk', system-ui, sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.country_name || GCC_NAMES[s.country_code] || s.country_code}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: s.color, fontFamily: "'Space Mono', monospace" }}>
              {s.count.toLocaleString()}
            </span>
            <span style={{ fontSize: 10, color: "#4a5568", fontFamily: "'Space Mono', monospace", minWidth: 34, textAlign: "right" }}>
              {Math.round((s.count / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Pure-SVG sparkline
function Sparkline({ data, color = "#F5A800" }) {
  if (!data || data.length < 2) return <p style={{ fontSize: 12, color: "#4a5568", fontStyle: "italic", fontFamily: "'Space Mono',monospace" }}>No data</p>;
  const W = 600, H = 90;
  const max = Math.max(...data.map(d => d.count), 1);
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - (d.count / max) * (H - 6);
    return [x, y];
  });
  const line = pts.map(([x, y]) => `${x},${y}`).join(" L ");
  const area = `M ${line} L ${W},${H} L 0,${H} Z`;
  const ticks = [0, Math.floor(data.length / 2), data.length - 1];
  return (
    <div style={{ width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H + 20}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <defs>
          <linearGradient id="dbGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
          <filter id="lineGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Subtle horizontal grid lines */}
        {[0.25, 0.5, 0.75].map(t => (
          <line key={t} x1={0} y1={H * t + 3} x2={W} y2={H * t + 3}
            stroke="rgba(255,255,255,0.04)" strokeDasharray="4 6" />
        ))}
        {/* Baseline */}
        <line x1={0} y1={H} x2={W} y2={H} stroke="rgba(0,200,255,0.1)" />
        {/* Area fill */}
        <path d={area} fill="url(#dbGrad)" />
        {/* Glowing data line */}
        <path d={`M ${line}`} stroke={color} strokeWidth={2} fill="none"
          filter="url(#lineGlow)" />
        {/* Tick labels */}
        {ticks.map(i => (
          <text key={i} x={pts[i][0]} y={H + 15} textAnchor="middle"
            fill="#4a5568" fontSize={10} fontFamily="'Space Mono',monospace">
            {data[i]?.date ? data[i].date.slice(5) : ""}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ── Inline SVG Icons ─────────────────────────────────────────────────────────

function IconShield({ color, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconServer({ color, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}

function IconBuilding({ color, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
  );
}

function IconAlert({ color, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconBug({ color, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13" r="4" />
      <path d="M12 9V4M8.5 9.5L5 6M15.5 9.5L19 6M5 13H2M22 13h-3M5 20l2.5-2.5M19 20l-2.5-2.5" />
    </svg>
  );
}

function IconShieldOff({ color, size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <line x1="9" y1="12" x2="15" y2="12" />
    </svg>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

function DashboardPage({ orgsExposed, timeline, riskScore, topOrgs, criticalIPs, criticalIPsLoading, topPorts, topCities, topProducts, gccExposure }) {
  const maxPortCount    = Math.max(...(topPorts    || []).map(p => p.count), 1);
  const maxCityCount    = Math.max(...(topCities   || []).map(c => c.count), 1);
  const maxProductCount = Math.max(...(topProducts || []).map(p => p.count), 1);

  const kpis = [
    {
      label: "Total Exposures",
      value: riskScore?.total_exposures?.toLocaleString() ?? "—",
      color: "#F5A800",
      icon: <IconShield color="#F5A800" />,
    },
    {
      label: "Unique IPs",
      value: riskScore?.unique_ips?.toLocaleString() ?? "—",
      color: "#00c8ff",
      icon: <IconServer color="#00c8ff" />,
    },
    {
      label: "Orgs Exposed",
      value: orgsExposed.toLocaleString(),
      color: "#a78bfa",
      icon: <IconBuilding color="#a78bfa" />,
    },
    {
      label: "Critical OT Ports",
      value: riskScore?.critical_port_exposures?.toLocaleString() ?? "—",
      color: "#ff4444",
      icon: <IconAlert color="#ff4444" />,
    },
    {
      label: "CVE Hosts",
      value: riskScore?.total_vulns?.toLocaleString() ?? "—",
      color: "#fb923c",
      icon: <IconBug color="#fb923c" />,
    },
  ];

  return (
    <div style={s.page}>

      {/* ── KPI Row ── */}
      <div style={s.kpiRow}>
        {kpis.map(k => (
          <div
            key={k.label}
            style={{
              ...s.kpiCard,
              borderTop: `3px solid ${k.color}`,
              boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 16px ${k.color}14, inset 0 1px 0 rgba(255,255,255,0.04)`,
            }}
          >
            <div style={{ ...s.kpiIcon, color: k.color }}>{k.icon}</div>
            <span style={{ ...s.kpiValue, color: k.color }}>{k.value}</span>
            <span style={s.kpiLabel}>{k.label}</span>
          </div>
        ))}
      </div>

      {/* ── Middle Row: Cities / Ports / Orgs / Products / Timeline ── */}
      <div style={s.midRow}>

        {/* Top Cities */}
        <div style={{ ...s.card, borderTop: "3px solid #00c8ff" }}>
          <p style={{ ...s.cardTitle, color: "#00c8ff", borderLeftColor: "#00c8ff" }}>TOP CITIES</p>
          <div style={s.barList}>
            {(topCities || []).map(city => {
              const pct = Math.round((city.count / maxCityCount) * 100);
              return (
                <div key={city.city ?? "unknown"} style={s.barRow}>
                  <span style={s.barLabel}>{city.city || "Unknown"}</span>
                  <div style={s.barTrack}>
                    <div style={{ ...s.barFill, width: `${pct}%`, background: "linear-gradient(90deg, #00c8ff88, #00c8ff)" }} />
                  </div>
                  <span style={{ ...s.barCount, color: "#00c8ff" }}>{city.count.toLocaleString()}</span>
                </div>
              );
            })}
            {!topCities?.length && <p style={s.empty}>Loading…</p>}
          </div>
        </div>

        {/* Top Ports */}
        <div style={{ ...s.card, borderTop: "3px solid #F5A800" }}>
          <p style={{ ...s.cardTitle, color: "#F5A800", borderLeftColor: "#F5A800" }}>TOP PORTS</p>
          <div style={s.barList}>
            {(topPorts || []).map(p => {
              const pct = Math.round((p.count / maxPortCount) * 100);
              return (
                <div key={p.port} style={s.barRow}>
                  <span style={{ ...s.barLabel, fontFamily: "'Space Mono', monospace", color: "#a5f3fc" }}>{p.port}</span>
                  <div style={s.barTrack}>
                    <div style={{ ...s.barFill, width: `${pct}%`, background: "linear-gradient(90deg, #F5A80088, #F5A800)" }} />
                  </div>
                  <span style={{ ...s.barCount, color: "#F5A800" }}>{p.count.toLocaleString()}</span>
                </div>
              );
            })}
            {!topPorts?.length && <p style={s.empty}>Loading…</p>}
          </div>
        </div>

        {/* Top Orgs */}
        <div style={{ ...s.card, borderTop: "3px solid #a78bfa" }}>
          <p style={{ ...s.cardTitle, color: "#a78bfa", borderLeftColor: "#a78bfa" }}>TOP ORGS</p>
          <div style={s.barList}>
            {(topOrgs || []).map(org => {
              const pct = Math.round((org.exposure_count / Math.max(...(topOrgs).map(o => o.exposure_count), 1)) * 100);
              return (
                <div key={org.org ?? "unknown"} style={s.barRow}>
                  <span style={s.barLabel}>{org.org || "Unknown"}</span>
                  <div style={s.barTrack}>
                    <div style={{ ...s.barFill, width: `${pct}%`, background: "linear-gradient(90deg, #a78bfa88, #a78bfa)" }} />
                  </div>
                  <span style={{ ...s.barCount, color: "#a78bfa" }}>{org.exposure_count.toLocaleString()}</span>
                </div>
              );
            })}
            {!topOrgs?.length && <p style={s.empty}>Loading…</p>}
          </div>
        </div>

        {/* Top Products */}
        <div style={{ ...s.card, borderTop: "3px solid #34d399" }}>
          <p style={{ ...s.cardTitle, color: "#34d399", borderLeftColor: "#34d399" }}>TOP PRODUCTS</p>
          <div style={s.barList}>
            {(topProducts || []).map(p => {
              const pct = Math.round((p.count / maxProductCount) * 100);
              return (
                <div key={p.product ?? "unknown"} style={s.barRow}>
                  <span style={s.barLabel}>{p.product || "Unknown"}</span>
                  <div style={s.barTrack}>
                    <div style={{ ...s.barFill, width: `${pct}%`, background: "linear-gradient(90deg, #34d39988, #34d399)" }} />
                  </div>
                  <span style={{ ...s.barCount, color: "#34d399" }}>{p.count.toLocaleString()}</span>
                </div>
              );
            })}
            {!topProducts?.length && <p style={s.empty}>Loading…</p>}
          </div>
        </div>

        {/* Timeline Sparkline */}
        <div style={{ ...s.card, borderTop: "3px solid #00c8ff" }}>
          <p style={{ ...s.cardTitle, color: "#00c8ff", borderLeftColor: "#00c8ff" }}>EXPOSURE TREND (90 DAYS)</p>
          <Sparkline data={timeline} color="#00c8ff" />
          {timeline?.length > 0 && (
            <div style={s.tlineFooter}>
              <span style={s.tlineLabel}>Peak: {Math.max(...timeline.map(d => d.count)).toLocaleString()} / day</span>
              <span style={s.tlineLabel}>Total: {timeline.reduce((a, d) => a + d.count, 0).toLocaleString()}</span>
            </div>
          )}
        </div>

      </div>

      {/* ── Bottom Row: GCC Pie + Critical IPs ── */}
      <div style={s.bottomRow}>

        {/* GCC Modbus Exposure Pie Chart */}
        <div style={{ ...s.card, flex: 1, overflow: "hidden", borderTop: "3px solid #a78bfa" }}>
          <p style={{ ...s.cardTitle, color: "#a78bfa", borderLeftColor: "#a78bfa" }}>EXPOSURE — GCC</p>
          <GCCPieChart data={gccExposure} />
        </div>

        {/* Critical IPs */}
        <div style={{ ...s.card, flex: 2, overflow: "hidden", borderTop: "3px solid #ff4444" }}>
          <p style={{ ...s.cardTitle, color: "#ff4444", borderLeftColor: "#ff4444" }}>CRITICAL IPs — KNOWN CVEs</p>
          <div style={s.ipList}>
            {criticalIPsLoading ? (
              <p style={s.empty}>Loading…</p>
            ) : criticalIPs && criticalIPs.length > 0 ? (
              <>
                <div style={s.ipHeader}>
                  <span>IP Address</span>
                  <span>Category</span>
                  <span>Organization</span>
                  <span>Port</span>
                  <span>Country</span>
                  <span>Last Seen</span>
                  <span>CVEs</span>
                </div>
                {criticalIPs.map(ip => {
                  const cveCount = ip.vulns ? Object.keys(ip.vulns).length : 0;
                  const country = ip.country_code || ip.country_name || "—";
                  const lastSeen = ip.timestamp
                    ? new Date(ip.timestamp).toISOString().slice(0, 10)
                    : "—";
                  return (
                    <div key={ip.id} style={s.ipRow}>
                      <span style={s.ipMono}>{ip.ip_str || "—"}</span>
                      <span style={s.ipField}>{ip.api ? ip.api.replace(/^shodan\//, "") : "—"}</span>
                      <span style={{ ...s.ipField, color: "#7a8599" }}>{ip.org || "—"}</span>
                      <span style={{ ...s.ipField, fontFamily: "'Space Mono', monospace" }}>{ip.port ?? "—"}</span>
                      <span style={s.ipField}>{country}</span>
                      <span style={{ ...s.ipField, fontFamily: "'Space Mono', monospace", color: "#5a6a8a" }}>{lastSeen}</span>
                      {cveCount > 0
                        ? <span style={s.cveBadge}>{cveCount} CVE</span>
                        : <span />}
                    </div>
                  );
                })}
              </>
            ) : (
              <div style={s.emptyState}>
                <IconShieldOff color="#2a3a4a" size={38} />
                <p style={s.emptyStateTitle}>No CVE-exposed hosts found</p>
                <p style={s.emptyStateSubtitle}>No hosts with known CVEs are currently in the dataset.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const CARD = {
  background: "rgba(10,14,22,0.94)",
  border: "1px solid rgba(0,200,255,0.08)",
  borderRadius: 10,
  padding: "18px 20px 16px",
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  backdropFilter: "blur(16px)",
  boxShadow: "0 4px 28px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.03)",
};

const CARD_TITLE = {
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: "3px",
  marginBottom: 16,
  flexShrink: 0,
  textTransform: "uppercase",
  fontFamily: "'Space Mono', monospace",
  paddingLeft: 10,
  borderLeft: "3px solid",
};

const s = {
  /* ── Page shell ── */
  page: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    padding: "18px 22px",
    overflowY: "auto",
    background: "#060a10",
    color: "#f0f4f8",
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    position: "relative",
    zIndex: 1,
  },

  /* ── KPI strip ── */
  kpiRow: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 10,
    flexShrink: 0,
  },
  kpiCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    background: "rgba(10,14,22,0.94)",
    border: "1px solid rgba(0,200,255,0.08)",
    borderRadius: 10,
    padding: "14px 10px 14px",
    backdropFilter: "blur(16px)",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    gap: 4,
  },
  kpiIcon: {
    marginBottom: 6,
    opacity: 0.9,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: 700,
    lineHeight: 1.1,
    fontFamily: "'Space Mono', monospace",
    letterSpacing: "-0.5px",
  },
  kpiLabel: {
    fontSize: 9.5,
    color: "#8892a4",
    textTransform: "uppercase",
    letterSpacing: "1.4px",
    marginTop: 5,
    textAlign: "center",
    fontFamily: "'Space Mono', monospace",
  },

  /* ── Mid + bottom rows ── */
  midRow: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr 1fr 1fr 1.2fr",
    gap: 12,
    flexShrink: 0,
  },
  bottomRow: {
    display: "flex",
    gap: 12,
    flex: 1,
    minHeight: 0,
  },

  /* ── Generic glassmorphism card ── */
  card: CARD,
  cardTitle: CARD_TITLE,

  /* ── Bar chart ── */
  barList: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    overflowY: "auto",
    flex: 1,
  },
  barRow: {
    display: "grid",
    gridTemplateColumns: "1fr 76px 42px",
    alignItems: "center",
    gap: 8,
  },
  barLabel: {
    fontSize: 11,
    color: "#8892a4",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
  },
  barTrack: {
    height: 8,
    background: "rgba(255,255,255,0.05)",
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
    transition: "width 0.65s cubic-bezier(0.4,0,0.2,1)",
  },
  barCount: {
    fontSize: 11,
    fontWeight: 700,
    textAlign: "right",
    fontFamily: "'Space Mono', monospace",
  },

  /* ── Timeline chart ── */
  tlineFooter: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 6,
    borderTop: "1px solid rgba(255,255,255,0.05)",
  },
  tlineLabel: {
    fontSize: 10,
    color: "#4a5568",
    fontFamily: "'Space Mono', monospace",
  },

  /* ── Critical IPs table ── */
  ipList: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
    overflowY: "auto",
    flex: 1,
  },
  ipHeader: {
    display: "grid",
    gridTemplateColumns: "118px 1fr 1fr 46px 90px 82px 58px",
    gap: 8,
    padding: "6px 8px 8px",
    borderBottom: "1px solid rgba(255,68,68,0.18)",
    fontSize: 9.5,
    color: "#ff4444",
    fontWeight: 700,
    letterSpacing: "2px",
    textTransform: "uppercase",
    fontFamily: "'Space Mono', monospace",
    position: "sticky",
    top: 0,
    zIndex: 1,
    flexShrink: 0,
    background: "#060a10",
    borderRadius: "6px 6px 0 0",
  },
  ipRow: {
    display: "grid",
    gridTemplateColumns: "118px 1fr 1fr 46px 90px 82px 58px",
    gap: 8,
    alignItems: "center",
    padding: "5px 8px",
    borderBottom: "1px solid rgba(255,255,255,0.025)",
    transition: "background 0.12s ease",
  },
  ipMono: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 12,
    color: "#a5f3fc",
    letterSpacing: "0.2px",
  },
  ipField: {
    fontSize: 11,
    color: "#8892a4",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
  },
  cveBadge: {
    fontSize: 9.5,
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.28)",
    color: "#f87171",
    borderRadius: 20,
    padding: "2px 7px",
    whiteSpace: "nowrap",
    fontFamily: "'Space Mono', monospace",
    letterSpacing: "0.3px",
  },

  /* ── Empty / loading states ── */
  empty: {
    fontSize: 12,
    color: "#4a5568",
    fontStyle: "italic",
    fontFamily: "'Space Mono', monospace",
    padding: "12px 0",
  },
  emptyState: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "32px 16px",
    opacity: 0.7,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#4a5568",
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    letterSpacing: "0.5px",
  },
  emptyStateSubtitle: {
    fontSize: 11,
    color: "#2e3a4a",
    fontFamily: "'Space Mono', monospace",
    textAlign: "center",
    lineHeight: 1.5,
  },
};

export default DashboardPage;
