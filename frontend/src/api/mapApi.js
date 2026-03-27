import apiClient from "./client";

/**
 * GET /api/map/exposures
 * Returns MapPoint[] — lightweight records for rendering map markers.
 * Schema: { id, ip_str, latitude, longitude, city, org, api, port, vulns }
 */
export async function getMapExposures({ category, city, risk_level, limit = 10000 } = {}) {
  const params = { limit };
  if (category) params.category = category;
  if (city) params.city = city;
  if (risk_level) params.risk_level = risk_level;
  const { data } = await apiClient.get("/api/map/exposures", { params });
  return data;
}

/**
 * GET /api/map/clusters
 * Returns ClusterPoint[] — aggregated 0.1-degree lat/lon buckets for heatmap.
 * Schema: { latitude, longitude, count }
 */
export async function getMapClusters({ category, country_code } = {}) {
  const params = {};
  if (category) params.category = category;
  if (country_code) params.country_code = country_code;
  const { data } = await apiClient.get("/api/map/clusters", { params });
  return data;
}
