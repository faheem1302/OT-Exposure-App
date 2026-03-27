import apiClient from "./client";

/**
 * GET /api/exposures/
 * Returns PaginatedResponse[ExposureResponse] — paginated, filterable list.
 * Schema: { items: ExposureResponse[], total, page, page_size, pages }
 * sort_by allowed values: timestamp | ip_str | org | city | port | api | country_code | updated_at | created_at
 * sort_order: asc | desc
 */
export async function getExposures({
  page = 1,
  page_size = 50,
  category,
  city,
  port,
  org,
  search,
  sort_by = "timestamp",
  sort_order = "desc",
} = {}) {
  const params = { page, page_size, sort_by, sort_order };
  if (category) params.category = category;
  if (city) params.city = city;
  if (port != null) params.port = port;
  if (org) params.org = org;
  if (search) params.search = search;
  const { data } = await apiClient.get("/api/exposures/", { params });
  return data;
}

/**
 * GET /api/exposures/{exposure_id}
 * Returns a single ExposureResponse by database ID.
 */
export async function getExposureById(exposure_id) {
  const { data } = await apiClient.get(`/api/exposures/${exposure_id}`);
  return data;
}

/**
 * GET /api/exposures/export/csv
 * Returns a direct URL for streaming a CSV download (open in window or <a href>).
 * Supports same filters as getExposures() minus pagination.
 */
export function getExposuresCsvUrl({ category, city, port, org, search } = {}) {
  const base = process.env.REACT_APP_API_URL || "http://localhost:8000";
  const params = new URLSearchParams();
  if (category) params.append("category", category);
  if (city) params.append("city", city);
  if (port != null) params.append("port", port);
  if (org) params.append("org", org);
  if (search) params.append("search", search);
  const qs = params.toString();
  return `${base}/api/exposures/export/csv${qs ? `?${qs}` : ""}`;
}
