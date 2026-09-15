"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchCityData } from "@/lib/services/cityData";
import type { CityDataset } from "@/lib/types";

/**
 * Hook principal de datos de la ciudad. Ejecuta el agregador de servicios
 * (con fallback a mock) y expone estado de carga/refresco de TanStack Query.
 */
export function useCityData() {
  return useQuery<CityDataset>({
    queryKey: ["city-data"],
    queryFn: fetchCityData,
  });
}
