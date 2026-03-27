// Risk score color thresholds
function scoreColor(v) {
  return v >= 70 ? "#ff2d2d" : v >= 40 ? "#FF7800" : "#2ECC71";
}

function RiskDashboard({ topOrgs, criticalIPs }) {
  const maxOrgScore = Math.max(...(topOrgs || []).map(o => o.risk_score), 1);

  return (
    <div style={s.wrap}>

      {/* ── Critical IPs ── */}
      <div style={s.section}>
        <p style={s.title}>CRITICAL IPs — KNOWN CVEs</p>
        <div style={s.ipTableWrap}>
          <table style={s.ipTable}>
            <thead>
              <tr>
                <th style={s.ipTh}>IP Address</th>
                <th style={s.ipTh}>Category</th>
                <th style={s.ipTh}>Organization</th>
                <th style={s.ipTh}>Port</th>
                <th style={s.ipTh}>CVEs</th>
              </tr>
            </thead>
            <tbody>
              {(criticalIPs || []).map(ip => {
                const cveCount = ip.vulns ? Object.keys(ip.vulns).length : 0;
                return (
                  <tr key={ip.id} style={s.ipTr}>
                    <td style={{ ...s.ipTd, fontFamily: "monospace", color: "#c8d4e8" }}>{ip.ip_str || "—"}</td>
                    <td style={{ ...s.ipTd, fontSize: 9 }}>{ip.api || "—"}</td>
                    <td style={{ ...s.ipTd, color: "#7a8599" }}>{ip.org || "—"}</td>
                    <td style={{ ...s.ipTd, fontFamily: "monospace" }}>{ip.port ?? "—"}</td>
                    <td style={s.ipTd}>
                      {cveCount > 0 && <span style={s.ipCve}>{cveCount} CVE</span>}
                    </td>
                  </tr>
                );
              })}
              {!criticalIPs?.length && (
                <tr><td colSpan={5} style={s.ipEmpty}>Loading…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Top Orgs Leaderboard ── */}
      <div style={s.section}>
        <p style={s.title}>TOP ORGS BY RISK</p>
        <div style={s.orgList}>
          {(topOrgs || []).map((org, i) => {
            const pct = Math.round((org.risk_score / maxOrgScore) * 100);
            const color = scoreColor(org.risk_score);
            return (
              <div key={org.org ?? i} style={s.orgRow}>
                <span style={s.orgRank}>{i + 1}</span>
                <span style={s.orgName} title={org.org}>{org.org || "Unknown"}</span>
                <div style={s.orgBarTrack}>
                  <div style={{ ...s.orgBarFill, width: `${pct}%`, background: color }} />
                </div>
                <span style={{ ...s.orgScore, color }}>{Math.round(org.risk_score)}</span>
                <span style={s.orgCount}>{org.exposure_count}</span>
                {org.vuln_count > 0 && (
                  <span style={s.vulnBadge}>{org.vuln_count} CVE</span>
                )}
              </div>
            );
          })}
          {!topOrgs?.length && <p style={e.empty}>Loading…</p>}
        </div>
      </div>

    </div>
  );
}

const s = {
  wrap: {
    display: "grid",
    gridTemplateColumns: "1fr 280px",
    gridTemplateRows: "1fr",
    gap: 12,
    flex: 1,
    minHeight: 0,
    padding: "10px 14px 6px",
    overflow: "hidden",
    minWidth: 0,
  },
  title: {
    fontSize: 9,
    fontWeight: 700,
    color: "#F5A800",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
  },
  orgList: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    overflowY: "auto",
    flex: 1,
  },
  orgRow: {
    display: "grid",
    gridTemplateColumns: "16px 1fr 60px 28px 36px",
    alignItems: "center",
    gap: 6,
    padding: "3px 0",
  },
  orgRank: {
    fontSize: 9,
    color: "#5a6480",
    textAlign: "right",
  },
  orgName: {
    fontSize: 10,
    color: "#cdd5e0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  orgBarTrack: {
    height: 4,
    background: "rgba(255,255,255,0.07)",
    borderRadius: 2,
    overflow: "hidden",
  },
  orgBarFill: {
    height: "100%",
    borderRadius: 2,
    transition: "width 0.5s ease",
  },
  orgScore: {
    fontSize: 10,
    fontWeight: 700,
    textAlign: "right",
  },
  orgCount: {
    fontSize: 9,
    color: "#5a6480",
    textAlign: "right",
  },
  vulnBadge: {
    fontSize: 8,
    background: "rgba(255,45,45,0.15)",
    border: "1px solid rgba(255,45,45,0.35)",
    color: "#ff2d2d",
    borderRadius: 3,
    padding: "1px 4px",
    whiteSpace: "nowrap",
  },
  ipTableWrap: {
    overflowY: "auto",
    overflowX: "hidden",
    maxHeight: "calc(47vh - 90px)",
  },
  ipTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 10,
  },
  ipTh: {
    padding: "3px 6px",
    background: "#0d0f1e",
    borderBottom: "1px solid rgba(245,168,0,0.1)",
    fontSize: 8,
    color: "#F5A800",
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    textAlign: "left",
    position: "sticky",
    top: 0,
    zIndex: 1,
  },
  ipTr: {
    borderBottom: "1px solid rgba(255,255,255,0.03)",
  },
  ipTd: {
    padding: "3px 6px",
    fontSize: 9.5,
    color: "#aab4c8",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 0,
  },
  ipEmpty: {
    padding: "12px 6px",
    fontSize: 10,
    color: "#5a6480",
    fontStyle: "italic",
  },
  ipCve: {
    fontSize: 8,
    background: "rgba(255,45,45,0.15)",
    border: "1px solid rgba(255,45,45,0.35)",
    color: "#ff2d2d",
    borderRadius: 3,
    padding: "1px 4px",
    whiteSpace: "nowrap",
  },
};

const e = {
  empty: { fontSize: 10, color: "#5a6480", fontStyle: "italic" },
};

export default RiskDashboard;
