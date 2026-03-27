import { useQuery } from "@tanstack/react-query";
import {
  getStatsSummary,
  getStatsByCategory,
  getStatsByCity,
  getStatsByPort,
  getStatsByProduct,
  getStatsTimeline,
} from "../api/statsApi";

/**
 * useStatsSummary — fetches GET /api/stats/summary.
 * Returns StatsSummary: { total_exposures, unique_ips, unique_orgs, top_city, top_category }
 * Used by App.js stat cards.
 */
export function useStatsSummary() {
  return useQuery({
    queryKey: ["stats", "summary"],
    queryFn: getStatsSummary,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * useStatsByCategory — fetches GET /api/stats/by-category.
 * Returns CategoryStat[]: { api, count }
 *
 * @param {object} params  { limit? }
 */
export function useStatsByCategory(params = {}) {
  return useQuery({
    queryKey: ["stats", "by-category", params],
    queryFn: async () => {
      const data = await getStatsByCategory(params);
      // Strip "shodan/" prefix so api values match CATEGORY_COLORS keys
      return data.map(item => ({ ...item, api: item.api ? item.api.replace(/^shodan\//, "") : item.api }));
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * useStatsByCity — fetches GET /api/stats/by-city.
 * Returns CityStat[]: { city, count }
 *
 * @param {object} params  { limit?, country_code? }
 */
export function useStatsByCity(params = {}) {
  return useQuery({
    queryKey: ["stats", "by-city", params],
    queryFn: () => getStatsByCity(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * useStatsByPort — fetches GET /api/stats/by-port.
 * Returns PortStat[]: { port, count }
 *
 * @param {object} params  { limit? }
 */
export function useStatsByPort(params = {}) {
  return useQuery({
    queryKey: ["stats", "by-port", params],
    queryFn: () => getStatsByPort(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * useStatsByProduct — fetches GET /api/stats/by-product.
 * Returns ProductStat[]: { product, count }
 *
 * @param {object} params  { limit? }
 */
export function useStatsByProduct(params = {}) {
  return useQuery({
    queryKey: ["stats", "by-product", params],
    queryFn: () => getStatsByProduct(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * useStatsTimeline — fetches GET /api/stats/timeline.
 * Returns TimelineStat[]: { date, count }  (date = "YYYY-MM-DD")
 *
 * @param {object} params  { days? }
 */
export function useStatsTimeline(params = {}) {
  return useQuery({
    queryKey: ["stats", "timeline", params],
    queryFn: () => getStatsTimeline(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
