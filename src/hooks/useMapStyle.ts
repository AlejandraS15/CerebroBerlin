"use client";

import { useQuery } from "@tanstack/react-query";
import type { StyleSpecification } from "maplibre-gl";
import { CONFIG } from "@/lib/config";
import { safeFetchJson } from "@/lib/http";
import { buildCityStyle, fallbackCityStyle, type MapTheme } from "@/lib/mapStyle";
import { useCityStore } from "@/store/useCityStore";

interface MapStyleResult {
  style: StyleSpecification;
  /** true si el mapa base falló y se muestra solo el relieve. */
  degraded: boolean;
}

async function loadCityStyle(theme: MapTheme): Promise<MapStyleResult> {
  const base = await safeFetchJson<StyleSpecification>(CONFIG.mapStyleUrl);
  return base?.layers
    ? { style: buildCityStyle(base, theme), degraded: false }
    : { style: fallbackCityStyle(theme), degraded: true };
}

/**
 * Estilo 3D del mapa. Se construye una sola vez y queda en caché: cambiar de
 * vista 2D/3D ya no recarga el estilo ni las teselas.
 */
export function useMapStyle() {
  const theme = useCityStore((state) => state.theme);

  return useQuery({
    queryKey: ["map-style", CONFIG.mapStyleUrl, theme],
    queryFn: () => loadCityStyle(theme),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
