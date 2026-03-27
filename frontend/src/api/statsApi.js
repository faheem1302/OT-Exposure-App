import apiClient from "./client";

/**
 * GET /api/stats/summary
 * Returns StatsSummary — high-level KPIs for the dashboard header.
 * Schema: { total_exposures, unique_ips, unique_orgs, top_city, top_category }
 */
export async function getStatsSummary() {
  const { data } = await apiClient.get("/api/stats/summary");
  return data;
}

/**
 * GET /api/stats/by-category
 * Returns CategoryStat[] — exposure counts grouped by OT/ICS protocol.
 * Schema: { api, count }
 */
export async function getStatsByCategory({ limit = 50 } = {}) {
  const { data } = await apiClient.get("/api/stats/by-category", { params: { limit } });
  return data;
}

/**
 * GET /api/stats/by-city
 * Returns CityStat[] — exposure counts grouped by city.
 * Schema: { city, count }
 */
export async function getStatsByCity({ limit = 50, country_code } = {}) {
  const params = { limit };
  if (country_code) params.country_code = country_code;
  const { data } = await apiClient.get("/api/stats/by-city", { params });
  return data;
}

/**
 * GET /api/stats/by-port
 * Returns PortStat[] — top ports ordered by exposure count.
 * Schema: { port, count }
 */
export async function getStatsByPort({ limit = 20 } = {}) {
  const { data } = await apiClient.get("/api/stats/by-port", { params: { limit } });
  return data;
}

/**
 * GET /api/stats/by-product
 * Returns ProductStat[] — top products ordered by exposure count.
 * Schema: { product, count }
 */
export async function getStatsByProduct({ limit = 20 } = {}) {
  const { data } = await apiClient.get("/api/stats/by-product", { params: { limit } });
  return data;
}

/**
 * GET /api/stats/timeline
 * Returns TimelineStat[] — daily exposure counts for trend charts.
 * Schema: { date, count }  (date = "YYYY-MM-DD")
 */
export async function getStatsTimeline({ days = 90 } = {}) {
  const { data } = await apiClient.get("/api/stats/timeline", { params: { days } });
  return data;
}
