import { useQuery } from "@tanstack/react-query";
import { getExposures, getExposureById } from "../api/exposuresApi";

/**
 * useExposures — fetches GET /api/exposures/ (paginated list).
 * Returns PaginatedResponse[ExposureResponse]:
 *   { items: ExposureResponse[], total, page, page_size, pages }
 *
 * @param {object} params  { page?, page_size?, category?, city?, port?, org?,
 *                           search?, sort_by?, sort_order? }
 */
export function useExposures(params = {}) {
  return useQuery({
    queryKey: ["exposures", "list", params],
    queryFn: () => getExposures(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * useExposure — fetches GET /api/exposures/{exposure_id} (single record).
 * Returns ExposureResponse (full detail including vulns, ssl, http, etc.).
 *
 * @param {number|null} exposure_id  — query is disabled when null/undefined
 */
export function useExposure(exposure_id) {
  return useQuery({
    queryKey: ["exposures", "detail", exposure_id],
    queryFn: () => getExposureById(exposure_id),
    enabled: exposure_id != null,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
