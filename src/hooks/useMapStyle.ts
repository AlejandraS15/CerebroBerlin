"use client";

import { useQuery } from "@tanstack/react-query";
import type { StyleSpecification } from "maplibre-gl";
import { CONFIG } from "@/lib/config";
import { safeFetchJson } from "@/lib/http";
import { buildCityStyle, fallbackCityStyle } from "@/lib/mapStyle";

interface MapStyleResult {
  style: StyleSpecification;
  /** true si el mapa base falló y se muestra solo el relieve. */
  degraded: boolean;
}

async function loadCityStyle(): Promise<MapStyleResult> {
  const base = await safeFetchJson<StyleSpecification>(CONFIG.mapStyleUrl);
  return base?.layers
    ? { style: buildCityStyle(base), degraded: false }
    : { style: fallbackCityStyle(), degraded: true };
}

/**
 * Estilo 3D del mapa. Se construye una sola vez y queda en caché: cambiar de
 * vista 2D/3D ya no recarga el estilo ni las teselas.
 */
export function useMapStyle() {
  return useQuery({
    queryKey: ["map-style", CONFIG.mapStyleUrl],
    queryFn: loadCityStyle,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
