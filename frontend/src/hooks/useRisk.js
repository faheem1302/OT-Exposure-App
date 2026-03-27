import { useQuery } from "@tanstack/react-query";
import { getTopOrgs, getCriticalIPs, getRiskScore } from "../api/riskApi";

/**
 * useTopOrgs — fetches GET /api/risk/top-orgs.
 * Returns TopOrg[]: { org, exposure_count, vuln_count, risk_score }
 *
 * @param {object} params  { limit? }
 */
export function useTopOrgs(params = {}) {
  return useQuery({
    queryKey: ["risk", "top-orgs", params],
    queryFn: () => getTopOrgs(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * useCriticalIPs — fetches GET /api/risk/critical-ips.
 * Returns CriticalIP[]: { id, ip_str, org, city, country_code, port, api, vulns, timestamp }
 *
 * @param {object} params  { limit?, country_code?, org? }
 */
export function useCriticalIPs(params = {}) {
  return useQuery({
    queryKey: ["risk", "critical-ips", params],
    queryFn: () => getCriticalIPs(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * useRiskScore — fetches GET /api/risk/score.
 * Returns RiskScore: { total_score, total_exposures, critical_port_exposures,
 *                      total_vulns, breakdown }
 */
export function useRiskScore() {
  return useQuery({
    queryKey: ["risk", "score"],
    queryFn: getRiskScore,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
