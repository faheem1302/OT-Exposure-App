import { useQuery } from "@tanstack/react-query";
import { getGCCExposureByCountry } from "../api/gccApi";

/**
 * useGCCExposure — fetches GET /api/gcc_exposure/by-country.
 * Returns GCCCountryStat[]: { country_code, count }
 */
export function useGCCExposure() {
  return useQuery({
    queryKey: ["gcc_exposure", "by-country"],
    queryFn: getGCCExposureByCountry,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
