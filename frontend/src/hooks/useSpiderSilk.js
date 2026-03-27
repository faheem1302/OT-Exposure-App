import { useQuery } from "@tanstack/react-query";
import { getSSByService, getSSByCountry, getSSVulnByCountry, getSSSummary } from "../api/spidersilkApi";

const OPTS = { staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 };

export const useSSByService     = () => useQuery({ queryKey: ["ss", "by-service"],      queryFn: getSSByService,     ...OPTS });
export const useSSByCountry     = () => useQuery({ queryKey: ["ss", "by-country"],      queryFn: getSSByCountry,     ...OPTS });
export const useSSVulnByCountry = () => useQuery({ queryKey: ["ss", "vuln-by-country"], queryFn: getSSVulnByCountry, ...OPTS });
export const useSSSummary       = () => useQuery({ queryKey: ["ss", "summary"],         queryFn: getSSSummary,       ...OPTS });
