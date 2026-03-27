import { useState, useRef, useCallback } from "react";
import { generateSQL, executeSQL } from "../api/searchApi";

// ── Suggested queries shown as clickable chips ──────────────────────────────
const SUGGESTIONS = [
  "Show top 10 organizations with the most CVEs",
  "List all exposed Modbus devices in UAE",
  "Which cities have the most SCADA/HMI exposures?",
  "Find all critical OT ports (502, 102, 44818, 20000) exposed in Saudi Arabia",
  "Show devices with default credentials still enabled",
  "List unique ISPs hosting exposed PLCs",
  "Count exposures by country",
  "Which products appear most frequently in critical port exposures?",
  "Find all Engineering Workstations in Qatar",
  "Show the 20 most recently scanned vulnerable hosts",
];

// ── Tiny AI-spark icon (inline SVG) ─────────────────────────────────────────
function SparkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M12 2L9.5 9.5L2 12L9.5 14.5L12 22L14.5 14.5L22 12L14.5 9.5L12 2Z"
        fill="#F5A800" stroke="#F5A800" strokeWidth="0.5" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ type, children }) {
  const colors = {
    success: { bg: "rgba(52,211,153,0.1)", border: "rgba(52,211,153,0.3)", color: "#34d399" },
    error:   { bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.3)",  color: "#f87171" },
    info:    { bg: "rgba(0,200,255,0.08)", border: "rgba(0,200,255,0.2)",  color: "#00c8ff" },
    warn:    { bg: "rgba(245,168,0,0.1)",  border: "rgba(245,168,0,0.3)",  color: "#F5A800" },
  };
  const c = colors[type] || colors.info;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 10.5, fontFamily: "'Space Mono', monospace",
      fontWeight: 600, letterSpacing: "0.5px",
      background: c.bg, border: `1px solid ${c.border}`, color: c.color,
      borderRadius: 20, padding: "3px 10px",
    }}>
      {children}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SearchPage() {
  const [question, setQuestion]     = useState("");
  const [sql, setSql]               = useState("");
  const [results, setResults]       = useState(null);   // { columns, rows, row_count, truncated }
  const [nlLoading, setNlLoading]   = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [nlError, setNlError]       = useState(null);
  const [runError, setRunError]     = useState(null);
  const [copied, setCopied]         = useState(false);
  const [execTime, setExecTime]     = useState(null);
  const sqlRef = useRef(null);

  // ── Generate SQL from natural language ─────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!question.trim()) return;
    setNlLoading(true);
    setNlError(null);
    setSql("");
    setResults(null);
    setRunError(null);
    setExecTime(null);
    try {
      const res = await generateSQL(question.trim());
      setSql(res.sql);
      // Auto-focus the SQL editor so user can review / tweak
      setTimeout(() => sqlRef.current?.focus(), 100);
    } catch (err) {
      setNlError(err?.response?.data?.detail || err.message || "SQL generation failed.");
    } finally {
      setNlLoading(false);
    }
  }, [question]);

  // ── Execute the SQL ─────────────────────────────────────────────────────────
  const handleRun = useCallback(async () => {
    if (!sql.trim()) return;
    setRunLoading(true);
    setRunError(null);
    setResults(null);
    setExecTime(null);
    const t0 = performance.now();
    try {
      const res = await executeSQL(sql.trim());
      setResults(res);
      setExecTime(((performance.now() - t0) / 1000).toFixed(2));
    } catch (err) {
      setRunError(err?.response?.data?.detail || err.message || "Query execution failed.");
    } finally {
      setRunLoading(false);
    }
  }, [sql]);

  // ── Copy SQL to clipboard ───────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    if (!sql) return;
    navigator.clipboard.writeText(sql).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [sql]);

  // ── Keyboard shortcut: Ctrl+Enter in NL textarea ───────────────────────────
  const onNLKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleGenerate();
    }
  };

  // ── Keyboard shortcut: Ctrl+Enter in SQL textarea ──────────────────────────
  const onSQLKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleRun();
    }
  };

  return (
    <div style={s.page}>

      {/* ── Page title bar ── */}
      <div style={s.titleRow}>
        <div style={s.titleLeft}>
          <span style={s.pageTitle}>Exposure Search</span>
          <span style={s.pageSubtitle}>Ask questions in Natural Language</span>
        </div>
      </div>

      {/* ── Two-column input zone ── */}
      <div style={s.inputZone}>

        {/* ── Left panel: Natural Language ── */}
        <div style={s.card}>
          <div style={s.cardHeader}>
            <div style={s.cardHeaderLeft}>
              <SparkIcon />
              <span style={s.cardTitle}>NATURAL LANGUAGE QUERY</span>
            </div>
            <span style={s.shortcutHint}>⌃↵ to generate</span>
          </div>

          <textarea
            style={s.nlTextarea}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={onNLKeyDown}
            placeholder="e.g. Show me all exposed SCADA devices in Dubai with known CVEs"
            rows={4}
            spellCheck={false}
          />

          {/* Suggestion chips */}
          <div style={s.chipsLabel}>QUICK EXAMPLES</div>
          <div style={s.chips}>
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                style={chipStyle(question === s)}
                onClick={() => setQuestion(s)}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Error */}
          {nlError && (
            <div style={s.errorBox}>
              <span style={s.errorIcon}>⚠</span>
              <span style={s.errorText}>{nlError}</span>
            </div>
          )}

          {/* Generate button */}
          <button
            style={{ ...s.primaryBtn, ...(nlLoading ? s.btnDisabled : {}) }}
            onClick={handleGenerate}
            disabled={nlLoading || !question.trim()}
          >
            {nlLoading
              ? <><span style={s.spinner} /> Generating SQL…</>
              : <><SparkIcon /> Generate SQL</>
            }
          </button>
        </div>

        {/* ── Right panel: Generated SQL ── */}
        <div style={s.card}>
          <div style={s.cardHeader}>
            <div style={s.cardHeaderLeft}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" strokeWidth="2" style={{ flexShrink: 0 }}>
                <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
              </svg>
              <span style={s.cardTitle}>GENERATED SQL</span>
              {sql && <StatusBadge type="info">EDITABLE</StatusBadge>}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={s.shortcutHint}>⌃↵ to run</span>
              {sql && (
                <button style={s.iconBtn} onClick={handleCopy} title="Copy SQL">
                  <CopyIcon />
                  <span style={{ fontSize: 10 }}>{copied ? "Copied!" : "Copy"}</span>
                </button>
              )}
            </div>
          </div>

          <textarea
            ref={sqlRef}
            style={s.sqlTextarea}
            value={sql}
            onChange={e => setSql(e.target.value)}
            onKeyDown={onSQLKeyDown}
            placeholder="SQL will appear here after you click Generate SQL…&#10;&#10;You can also type or paste a query directly and click Run Query."
            rows={7}
            spellCheck={false}
          />

          {/* Run error */}
          {runError && (
            <div style={s.errorBox}>
              <span style={s.errorIcon}>✗</span>
              <span style={s.errorText}>{runError}</span>
            </div>
          )}

          {/* Run button */}
          <button
            style={{ ...s.runBtn, ...(runLoading ? s.btnDisabled : {}) }}
            onClick={handleRun}
            disabled={runLoading || !sql.trim()}
          >
            {runLoading
              ? <><span style={{ ...s.spinner, borderTopColor: "#080c14" }} /> Running…</>
              : <><PlayIcon /> Run Query</>
            }
          </button>
        </div>
      </div>

      {/* ── Results panel ── */}
      <div style={s.resultsCard}>
        <div style={s.resultsHeader}>
          <div style={s.cardHeaderLeft}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" strokeWidth="2" style={{ flexShrink: 0 }}>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M3 15h18M9 3v18" />
            </svg>
            <span style={s.cardTitle}>RESULTS</span>
            {results && (
              <>
                <StatusBadge type="success">
                  {results.row_count.toLocaleString()} row{results.row_count !== 1 ? "s" : ""}
                </StatusBadge>
                {results.truncated && <StatusBadge type="warn">Truncated at 500</StatusBadge>}
                {execTime && (
                  <span style={s.execTime}>{execTime}s</span>
                )}
              </>
            )}
          </div>
        </div>

        <div style={s.tableWrap}>
          {/* Empty / idle state */}
          {!results && !runLoading && (
            <div style={s.emptyState}>
              <div style={s.emptyIcon}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(0,200,255,0.2)" strokeWidth="1.2">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <p style={s.emptyTitle}>No query run yet</p>
              <p style={s.emptyHint}>Type a question above, generate SQL, then click Run Query.</p>
            </div>
          )}

          {/* Loading rows shimmer */}
          {runLoading && (
            <div style={s.loadingState}>
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{ ...s.shimmerRow, opacity: 1 - i * 0.13 }} />
              ))}
            </div>
          )}

          {/* Actual results table */}
          {results && results.row_count > 0 && (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={{ ...s.th, ...s.thIndex }}>#</th>
                  {results.columns.map(col => (
                    <th key={col} style={s.th}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.rows.map((row, ri) => (
                  <tr key={ri} style={s.tr}>
                    <td style={{ ...s.td, ...s.tdIndex }}>{ri + 1}</td>
                    {row.map((cell, ci) => (
                      <td key={ci} style={cellStyle(results.columns[ci], cell)}>
                        {cell === null
                          ? <span style={s.nullCell}>NULL</span>
                          : cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Zero rows returned */}
          {results && results.row_count === 0 && (
            <div style={s.emptyState}>
              <p style={s.emptyTitle}>Query returned 0 rows</p>
              <p style={s.emptyHint}>Try broadening your filter criteria.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Dynamic cell styling: IPs cyan, CVE badges red, ports orange ──────────────
function cellStyle(col, value) {
  const base = { ...s.td };
  if (!value) return base;
  if (col === "ip_str" || col === "ip") return { ...base, ...s.tdMono, color: "#a5f3fc" };
  if (col === "port")     return { ...base, ...s.tdMono, color: "#F5A800" };
  if (col === "org")      return { ...base, color: "#e2e8f0" };
  if (col === "country_code") return { ...base, ...s.tdMono, color: "#34d399" };
  if (col === "city")     return { ...base, color: "#cbd5e0" };
  if (col === "vulns" && value && value !== "null" && value !== "{}")
    return { ...base, color: "#f87171", ...s.tdMono };
  if (col === "api")      return { ...base, color: "#a78bfa", fontSize: 10.5, ...s.tdMono };
  if (/count|score|total/i.test(col)) return { ...base, ...s.tdMono, color: "#F5A800", fontWeight: 700 };
  return base;
}

function chipStyle(active) {
  return {
    background: active ? "rgba(245,168,0,0.14)" : "rgba(255,255,255,0.04)",
    border: `1px solid ${active ? "rgba(245,168,0,0.45)" : "rgba(255,255,255,0.08)"}`,
    color: active ? "#F5A800" : "#8892a4",
    borderRadius: 20,
    padding: "4px 12px",
    fontSize: 11,
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 0.15s ease",
    outline: "none",
  };
}

// ── Styles ───────────────────────────────────────────────────────────────────
const CARD_BASE = {
  background: "rgba(13,17,23,0.95)",
  border: "1px solid rgba(0,200,255,0.09)",
  borderRadius: 12,
  backdropFilter: "blur(14px)",
  boxShadow: "0 4px 28px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)",
};

const MONO = { fontFamily: "'Space Mono', monospace" };

const s = {
  page: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    padding: "20px 24px",
    overflowY: "auto",
    background: "#080c14",
    color: "#f0f4f8",
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    minHeight: 0,
  },

  // ── Title bar ──
  titleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  },
  titleLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#e2e8f0",
    letterSpacing: "0.5px",
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
  },
  pageSubtitle: {
    fontSize: 12,
    color: "#4a5568",
    fontFamily: "'Space Mono', monospace",
  },
  titleBadges: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  poweredBy: {
    fontSize: 9,
    color: "#4a5568",
    letterSpacing: "1.5px",
    fontFamily: "'Space Mono', monospace",
    textTransform: "uppercase",
  },
  claudeBadge: {
    fontSize: 11,
    fontWeight: 800,
    color: "#F5A800",
    letterSpacing: "2px",
    background: "rgba(245,168,0,0.1)",
    border: "1px solid rgba(245,168,0,0.3)",
    borderRadius: 4,
    padding: "2px 8px",
    fontFamily: "'Space Mono', monospace",
  },
  dbBadge: {
    fontSize: 11,
    fontWeight: 700,
    color: "#00c8ff",
    letterSpacing: "1.5px",
    background: "rgba(0,200,255,0.08)",
    border: "1px solid rgba(0,200,255,0.25)",
    borderRadius: 4,
    padding: "2px 8px",
    fontFamily: "'Space Mono', monospace",
  },

  // ── Two-column input zone ──
  inputZone: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    flexShrink: 0,
  },

  // ── Cards ──
  card: {
    ...CARD_BASE,
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  },
  cardHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 10.5,
    fontWeight: 700,
    color: "#00c8ff",
    letterSpacing: "2.5px",
    textTransform: "uppercase",
    fontFamily: "'Space Mono', monospace",
  },
  shortcutHint: {
    fontSize: 10,
    color: "#2d3748",
    fontFamily: "'Space Mono', monospace",
    letterSpacing: "0.5px",
  },

  // ── NL textarea ──
  nlTextarea: {
    width: "100%",
    minHeight: 100,
    resize: "vertical",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(0,200,255,0.12)",
    borderRadius: 8,
    color: "#e2e8f0",
    fontSize: 14,
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    lineHeight: 1.6,
    padding: "12px 14px",
    outline: "none",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    boxSizing: "border-box",
  },

  // ── SQL textarea ──
  sqlTextarea: {
    width: "100%",
    minHeight: 160,
    resize: "vertical",
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(0,200,255,0.1)",
    borderRadius: 8,
    color: "#a5f3fc",
    fontSize: 12.5,
    fontFamily: "'Space Mono', 'Courier New', monospace",
    lineHeight: 1.7,
    padding: "12px 14px",
    outline: "none",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    boxSizing: "border-box",
    letterSpacing: "0.2px",
  },

  // ── Suggestion chips ──
  chipsLabel: {
    fontSize: 9,
    color: "#2d3748",
    letterSpacing: "2px",
    fontFamily: "'Space Mono', monospace",
    flexShrink: 0,
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    maxHeight: 88,
    overflowY: "auto",
  },

  // ── Error box ──
  errorBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.25)",
    borderRadius: 8,
    padding: "10px 14px",
  },
  errorIcon: {
    color: "#f87171",
    fontSize: 13,
    flexShrink: 0,
    marginTop: 1,
    fontFamily: "'Space Mono', monospace",
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 12,
    fontFamily: "'Space Mono', monospace",
    lineHeight: 1.5,
    wordBreak: "break-word",
  },

  // ── Buttons ──
  primaryBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "10px 22px",
    background: "linear-gradient(135deg, rgba(245,168,0,0.18) 0%, rgba(245,168,0,0.08) 100%)",
    border: "1px solid rgba(245,168,0,0.5)",
    borderRadius: 8,
    color: "#F5A800",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "'Space Mono', monospace",
    letterSpacing: "1px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    textTransform: "uppercase",
    alignSelf: "flex-start",
    boxShadow: "0 2px 12px rgba(245,168,0,0.08)",
  },
  runBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "10px 22px",
    background: "linear-gradient(135deg, rgba(0,200,255,0.15) 0%, rgba(0,200,255,0.06) 100%)",
    border: "1px solid rgba(0,200,255,0.45)",
    borderRadius: 8,
    color: "#00c8ff",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "'Space Mono', monospace",
    letterSpacing: "1px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    textTransform: "uppercase",
    alignSelf: "flex-start",
    boxShadow: "0 2px 12px rgba(0,200,255,0.08)",
  },
  btnDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
  },
  iconBtn: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 6,
    color: "#4a5568",
    fontSize: 11,
    fontFamily: "'Space Mono', monospace",
    padding: "4px 10px",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },

  // ── Spinner ──
  spinner: {
    display: "inline-block",
    width: 13,
    height: 13,
    border: "2px solid rgba(245,168,0,0.25)",
    borderTop: "2px solid #F5A800",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
    flexShrink: 0,
  },

  // ── Results card ──
  resultsCard: {
    ...CARD_BASE,
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 260,
    overflow: "hidden",
  },
  resultsHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px 14px",
    borderBottom: "1px solid rgba(0,200,255,0.07)",
    flexShrink: 0,
  },
  execTime: {
    fontSize: 10,
    color: "#2d3748",
    fontFamily: "'Space Mono', monospace",
    marginLeft: 4,
  },

  // ── Table wrapper ──
  tableWrap: {
    flex: 1,
    overflowX: "auto",
    overflowY: "auto",
    minHeight: 0,
  },

  // ── Table ──
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 12,
    tableLayout: "auto",
  },
  th: {
    padding: "8px 12px",
    textAlign: "left",
    fontSize: 10,
    fontWeight: 700,
    color: "#00c8ff",
    letterSpacing: "1.8px",
    textTransform: "uppercase",
    fontFamily: "'Space Mono', monospace",
    background: "#080c14",
    borderBottom: "1px solid rgba(0,200,255,0.14)",
    position: "sticky",
    top: 0,
    zIndex: 1,
    whiteSpace: "nowrap",
  },
  thIndex: {
    width: 40,
    color: "#2d3748",
    textAlign: "center",
    minWidth: 40,
  },
  tr: {
    borderBottom: "1px solid rgba(255,255,255,0.03)",
    transition: "background 0.1s ease",
  },
  td: {
    padding: "6px 12px",
    fontSize: 12,
    color: "#8892a4",
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    maxWidth: 280,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    verticalAlign: "middle",
  },
  tdMono: MONO,
  tdIndex: {
    color: "#2d3748",
    textAlign: "center",
    fontFamily: "'Space Mono', monospace",
    fontSize: 10.5,
    width: 40,
    minWidth: 40,
  },
  nullCell: {
    color: "#2d3748",
    fontFamily: "'Space Mono', monospace",
    fontSize: 10,
    fontStyle: "italic",
  },

  // ── Empty / loading states ──
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: "48px 24px",
    color: "#2d3748",
  },
  emptyIcon: { opacity: 0.5 },
  emptyTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#4a5568",
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
  },
  emptyHint: {
    fontSize: 12,
    color: "#2d3748",
    fontFamily: "'Space Mono', monospace",
    textAlign: "center",
  },
  loadingState: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: "20px 20px",
  },
  shimmerRow: {
    height: 28,
    borderRadius: 6,
    background: "linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 100%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.4s ease infinite",
  },
};
