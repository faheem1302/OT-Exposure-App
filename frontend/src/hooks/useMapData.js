import { useQuery } from "@tanstack/react-query";
import { getMapExposures, getMapClusters } from "../api/mapApi";

/**
 * Transform API MapPoint → shape expected by the existing MapView.jsx component.
 *
 * API shape:  { id, ip_str, latitude, longitude, city, org, api, port, vulns }
 * Component expects: { id, lat, lng, city, org, api, count, ips[], domains[] }
 */
function transformMapPoint(point) {
  return {
    id: point.id,
    lat: point.latitude,
    lng: point.longitude,
    city: point.city,
    org: point.org,
    api: point.api ? point.api.replace(/^shodan\//, "") : point.api,  // strip "shodan/" prefix
    port: point.port,
    vulns: point.vulns,
    count: 1,                                          // one record = one IP
    ips: point.ip_str ? [point.ip_str] : [],
    domains: [],
  };
}

/**
 * useMapData — fetches GET /api/map/exposures and transforms to MapView shape.
 * Filters out any points with null coordinates before returning.
 *
 * @param {object} params  { category?, city?, risk_level?, limit? }
 * @returns React Query result with data: transformed MapPoint[]
 */
export function useMapData(params = {}) {
  return useQuery({
    queryKey: ["map", "exposures", params],
    queryFn: async () => {
      const raw = await getMapExposures(params);
      return raw
        .filter((p) => p.latitude != null && p.longitude != null)
        .map(transformMapPoint);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * useMapClusters — fetches GET /api/map/clusters.
 * Returns ClusterPoint[]: { latitude, longitude, count }
 *
 * @param {object} params  { category?, country_code? }
 */
export function useMapClusters(params = {}) {
  return useQuery({
    queryKey: ["map", "clusters", params],
    queryFn: () => getMapClusters(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
