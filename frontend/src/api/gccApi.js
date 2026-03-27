import apiClient from "./client";

/**
 * GET /api/gcc_exposure/by-country
 * Returns GCCCountryStat[] — port-502 exposure count per GCC country + Jordan.
 * Schema: { country_code, count }
 */
export async function getGCCExposureByCountry() {
  const { data } = await apiClient.get("/api/gcc_exposure/by-country");
  return data;
}
