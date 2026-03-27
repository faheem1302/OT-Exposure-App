import apiClient from "./client";

/**
 * GET /api/risk/top-orgs
 * Returns TopOrg[] — organisations ranked by composite risk score.
 * Schema: { org, exposure_count, vuln_count, risk_score }
 * risk_score = min(100, exposure_count * 2 + vuln_count * 10)
 */
export async function getTopOrgs({ limit = 20 } = {}) {
  const { data } = await apiClient.get("/api/risk/top-orgs", { params: { limit } });
  return data;
}

/**
 * GET /api/risk/critical-ips
 * Returns CriticalIP[] — hosts with at least one known CVE, ordered by timestamp desc.
 * Schema: { id, ip_str, org, city, country_code, port, api, vulns, timestamp }
 */
export async function getCriticalIPs({ limit = 100, country_code, org } = {}) {
  const params = { limit };
  if (country_code) params.country_code = country_code;
  if (org) params.org = org;
  const { data } = await apiClient.get("/api/risk/critical-ips", { params });
  return data;
}

/**
 * GET /api/risk/score
 * Returns RiskScore — composite 0–100 score for the entire dataset.
 * Schema: { total_score, total_exposures, critical_port_exposures, total_vulns, breakdown }
 */
export async function getRiskScore() {
  const { data } = await apiClient.get("/api/risk/score");
  return data;
}
