import apiClient from "./client";

export const getSSByService     = ()        => apiClient.get("/api/spidersilk/by-service?limit=10").then(r => r.data);
export const getSSByCountry     = ()        => apiClient.get("/api/spidersilk/by-country").then(r => r.data);
export const getSSVulnByCountry = ()        => apiClient.get("/api/spidersilk/vuln-by-country?limit=8").then(r => r.data);
export const getSSSummary       = ()        => apiClient.get("/api/spidersilk/summary").then(r => r.data);
