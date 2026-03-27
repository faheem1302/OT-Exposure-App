import { useState, useRef } from "react";
import { useExposures } from "../../hooks/useExposures";
import { getExposuresCsvUrl } from "../../api/exposuresApi";
import { API_CATEGORIES } from "../FilterPanel";

const PAGE_SIZE = 20;

const COLUMNS = [
  { key: "ip_str",     label: "IP Address",   mono: true  },
  { key: "api",        label: "Category",     mono: false },
  { key: "org",        label: "Organization", mono: false },
  { key: "city",       label: "City",         mono: false },
  { key: "port",       label: "Port",         mono: true  },
  { key: "timestamp",  label: "Seen",         mono: false },
];

function ExposuresTable() {
  const [page, setPage]             = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch]         = useState("");
  const [category, setCategory]     = useState("");
  const [city, setCityFilter]       = useState("");
  const [sortBy, setSortBy]         = useState("timestamp");
  const [sortOrder, setSortOrder]   = useState("desc");
  const timer = useRef(null);

  // Debounce search so we don't fire on every keystroke
  function handleSearchChange(e) {
    const v = e.target.value;
    setSearchInput(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setSearch(v); setPage(1); }, 400);
  }

  function handleSort(col) {
    if (sortBy === col) setSortOrder(o => o === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortOrder("desc"); }
    setPage(1);
  }

  const { data, isLoading } = useExposures({
    page, page_size: PAGE_SIZE,
    search, category: category || undefined,
    city: city || undefined,
    sort_by: sortBy, sort_order: sortOrder,
  });

  const items  = data?.items  ?? [];
  const total  = data?.total  ?? 0;
  const pages  = data?.pages  ?? 1;
  const csvUrl = getExposuresCsvUrl({ search, category: category || undefined, city: city || undefined });

  return (
    <div style={s.wrap}>

      {/* Controls */}
      <div style={s.controls}>
        <input
          value={searchInput}
          onChange={handleSearchChange}
          placeholder="Search IP, org, data…"
          style={s.input}
        />
        <select
          value={category}
          onChange={e => { setCategory(e.target.value); setPage(1); }}
          style={s.select}
        >
          <option value="">All Categories</option>
          {API_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          value={city}
          onChange={e => { setCityFilter(e.target.value); setPage(1); }}
          placeholder="City…"
          style={{ ...s.input, maxWidth: 120 }}
        />
        <a href={csvUrl} download target="_blank" rel="noreferrer" style={s.csvBtn}>
          ↓ Export CSV
        </a>
        <span style={s.totalBadge}>{total.toLocaleString()} records</span>
      </div>

      {/* Table */}
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  style={{ ...s.th, ...(sortBy === col.key ? s.thActive : {}) }}
                >
                  {col.label}
                  {sortBy === col.key ? (sortOrder === "asc" ? " ↑" : " ↓") : ""}
                </th>
              ))}
              <th style={s.th}>CVEs</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} style={s.centeredCell}>Loading…</td></tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr><td colSpan={7} style={s.centeredCell}>No records found</td></tr>
            )}
            {!isLoading && items.map(row => {
              const cveCount = row.vulns ? Object.keys(row.vulns).length : 0;
              return (
                <tr key={row.id} style={s.tr}>
                  <td style={{ ...s.td, fontFamily: "monospace", color: "#c8d4e8" }}>{row.ip_str || "—"}</td>
                  <td style={{ ...s.td, fontSize: 9, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.api || "—"}</td>
                  <td style={{ ...s.td, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.org || "—"}</td>
                  <td style={s.td}>{row.city || "—"}</td>
                  <td style={{ ...s.td, fontFamily: "monospace" }}>{row.port ?? "—"}</td>
                  <td style={{ ...s.td, color: "#5a6480", whiteSpace: "nowrap" }}>
                    {row.timestamp ? new Date(row.timestamp).toLocaleDateString("en-GB") : "—"}
                  </td>
                  <td style={s.td}>
                    {cveCount > 0 && (
                      <span style={s.cveBadge}>{cveCount}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={s.pagination}>
        <button onClick={() => setPage(1)} disabled={page === 1} style={s.pgBtn}>«</button>
        <button onClick={() => setPage(p => p - 1)} disabled={page === 1} style={s.pgBtn}>‹</button>
        <span style={s.pgInfo}>Page {page} of {pages}</span>
        <button onClick={() => setPage(p => p + 1)} disabled={page >= pages} style={s.pgBtn}>›</button>
        <button onClick={() => setPage(pages)} disabled={page >= pages} style={s.pgBtn}>»</button>
      </div>

    </div>
  );
}

const s = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    padding: "8px 14px 4px",
    gap: 6,
    minWidth: 0,
  },
  controls: {
    display: "flex",
    gap: 6,
    alignItems: "center",
    flexWrap: "wrap",
    flexShrink: 0,
  },
  input: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 5,
    color: "#e0e6f0",
    fontSize: 11,
    padding: "4px 8px",
    outline: "none",
    minWidth: 160,
  },
  select: {
    background: "#1a1a2e",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 5,
    color: "#e0e6f0",
    fontSize: 11,
    padding: "4px 6px",
    outline: "none",
    maxWidth: 200,
  },
  csvBtn: {
    fontSize: 10,
    fontWeight: 700,
    padding: "4px 10px",
    background: "rgba(245,168,0,0.12)",
    border: "1px solid rgba(245,168,0,0.35)",
    borderRadius: 5,
    color: "#F5A800",
    textDecoration: "none",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  totalBadge: {
    fontSize: 10,
    color: "#5a6480",
    marginLeft: "auto",
  },
  tableWrap: {
    flex: 1,
    overflowY: "auto",
    overflowX: "auto",
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.06)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 10.5,
    color: "#cdd5e0",
  },
  th: {
    padding: "6px 10px",
    background: "#0f1120",
    borderBottom: "1px solid rgba(245,168,0,0.15)",
    color: "#7a8599",
    fontWeight: 700,
    textTransform: "uppercase",
    fontSize: 8.5,
    letterSpacing: 0.7,
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
    textAlign: "left",
    position: "sticky",
    top: 0,
    zIndex: 1,
  },
  thActive: {
    color: "#F5A800",
  },
  tr: {
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  td: {
    padding: "5px 10px",
    fontSize: 10.5,
    color: "#aab4c8",
  },
  centeredCell: {
    padding: "24px",
    textAlign: "center",
    color: "#5a6480",
    fontSize: 11,
    fontStyle: "italic",
  },
  cveBadge: {
    background: "rgba(255,45,45,0.15)",
    border: "1px solid rgba(255,45,45,0.35)",
    color: "#ff2d2d",
    borderRadius: 3,
    padding: "1px 5px",
    fontSize: 9,
    fontWeight: 700,
  },
  pagination: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
    paddingTop: 2,
  },
  pgBtn: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 4,
    color: "#aab4c8",
    fontSize: 11,
    padding: "2px 8px",
    cursor: "pointer",
    lineHeight: 1.4,
  },
  pgInfo: {
    fontSize: 10,
    color: "#5a6480",
    padding: "0 6px",
  },
};

export default ExposuresTable;
