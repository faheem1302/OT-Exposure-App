import { CATEGORY_COLORS } from "../FilterPanel";

// Pure-SVG area sparkline — no chart library required
function Sparkline({ data, color }) {
  if (!data || data.length < 2) return <p style={e.empty}>No data</p>;
  const W = 600, H = 90;
  const max = Math.max(...data.map(d => d.count), 1);
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - (d.count / max) * (H - 6);
    return [x, y];
  });
  const line = pts.map(([x, y]) => `${x},${y}`).join(" L ");
  const area = `M ${line} L ${W},${H} L 0,${H} Z`;
  const path = `M ${line}`;
  // x-axis tick labels (first, middle, last)
  const ticks = [0, Math.floor(data.length / 2), data.length - 1];

  return (
    <div style={{ width: "100%", overflowX: "hidden" }}>
      <svg viewBox={`0 0 ${W} ${H + 18}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <defs>
          <linearGradient id="spGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {/* Grid line */}
        <line x1={0} y1={H} x2={W} y2={H} stroke="rgba(255,255,255,0.05)" />
        {/* Area fill */}
        <path d={area} fill="url(#spGrad)" />
        {/* Line */}
        <path d={path} stroke={color} strokeWidth={1.8} fill="none" />
        {/* Tick labels */}
        {ticks.map(i => (
          <text key={i} x={pts[i][0]} y={H + 14} textAnchor="middle"
            fill="#5a6480" fontSize={9} fontFamily="'Segoe UI', sans-serif">
            {data[i]?.date ? data[i].date.slice(5) : ""}
          </text>
        ))}
      </svg>
    </div>
  );
}

function StatsCharts({ categoryStats, timeline }) {
  const maxCount = Math.max(...(categoryStats || []).map(c => c.count), 1);

  return (
    <div style={s.wrap}>

      {/* ── Category Horizontal Bars ── */}
      <div style={s.col}>
        <p style={s.title}>EXPOSURE BY CATEGORY</p>
        <div style={s.barList}>
          {(categoryStats || []).map(cat => {
            const color = CATEGORY_COLORS[cat.api] || "#F5A800";
            const pct = Math.round((cat.count / maxCount) * 100);
            return (
              <div key={cat.api ?? "unknown"} style={s.barRow}>
                <span style={s.barLabel}>{cat.api || "Unknown"}</span>
                <div style={s.barTrack}>
                  <div style={{ ...s.barFill, width: `${pct}%`, background: color }} />
                </div>
                <span style={{ ...s.barCount, color }}>{cat.count.toLocaleString()}</span>
              </div>
            );
          })}
          {!categoryStats?.length && <p style={e.empty}>Loading…</p>}
        </div>
      </div>

      {/* ── Timeline Sparkline ── */}
      <div style={s.col}>
        <p style={s.title}>EXPOSURE TREND (90 DAYS)</p>
        <Sparkline data={timeline} color="#F5A800" />
        {timeline?.length > 0 && (
          <div style={s.tlineFooter}>
            <span style={s.tlineLabel}>
              Peak: {Math.max(...timeline.map(d => d.count)).toLocaleString()} records/day
            </span>
            <span style={s.tlineLabel}>
              Total: {timeline.reduce((a, d) => a + d.count, 0).toLocaleString()} records
            </span>
          </div>
        )}
      </div>

    </div>
  );
}

const s = {
  wrap: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    height: "100%",
    padding: "10px 14px 6px",
    overflowY: "auto",
  },
  col: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
  },
  title: {
    fontSize: 9,
    fontWeight: 700,
    color: "#F5A800",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  barList: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    overflowY: "auto",
    flex: 1,
  },
  barRow: {
    display: "grid",
    gridTemplateColumns: "1fr 100px 44px",
    alignItems: "center",
    gap: 6,
  },
  barLabel: {
    fontSize: 9.5,
    color: "#aab4c8",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  barTrack: {
    height: 5,
    background: "rgba(255,255,255,0.07)",
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
    transition: "width 0.5s ease",
  },
  barCount: {
    fontSize: 9.5,
    fontWeight: 700,
    textAlign: "right",
  },
  tlineFooter: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 4,
  },
  tlineLabel: {
    fontSize: 9,
    color: "#5a6480",
  },
};

const e = {
  empty: { fontSize: 10, color: "#5a6480", fontStyle: "italic" },
};

export default StatsCharts;
