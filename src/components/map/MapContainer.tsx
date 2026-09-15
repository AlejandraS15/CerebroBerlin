"use client";

import { useMemo, useState, useCallback } from "react";
import Map from "react-map-gl/maplibre";
import { DeckGLOverlay } from "./DeckGLOverlay";
import "maplibre-gl/dist/maplibre-gl.css";
import { BERLIN_VIEW } from "@/lib/layers";
import { CONFIG } from "@/lib/config";
import { useCityStore } from "@/store/useCityStore";
import { useCityData } from "@/hooks/useCityData";
import { buildDeckLayers, type HoverInfo } from "./buildDeckLayers";
import { MapTooltip } from "./MapTooltip";
import { DistrictPopup } from "./DistrictPopup";

/**
 * Contenedor central del gemelo digital: mapa MapLibre + overlay Deck.gl con
 * todas las capas de datos. Controla hover, click en distritos y vista 3D.
 */
export function MapContainer() {
  const { data, isLoading } = useCityData();
  const visibility = useCityStore((s) => s.layerVisibility);
  const selectedHour = useCityStore((s) => s.selectedHour);
  const is3D = useCityStore((s) => s.is3D);
  const setSelectedDistrict = useCityStore((s) => s.setSelectedDistrict);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  // "Actividad" derivada de la hora: picos hacia las 8h y 18h.
  const activity = useMemo(() => {
    const rush =
      Math.exp(-((selectedHour - 8) ** 2) / 8) +
      Math.exp(-((selectedHour - 18) ** 2) / 8);
    return Math.min(1, rush);
  }, [selectedHour]);

  const layers = useMemo(() => {
    if (!data) return [];
    return buildDeckLayers({
      data,
      visibility,
      activity,
      onDistrictClick: setSelectedDistrict,
      onHover: setHover,
    });
  }, [data, visibility, activity, setSelectedDistrict]);

  const initialViewState = useMemo(
    () => ({ ...BERLIN_VIEW, pitch: is3D ? 45 : 0 }),
    // Solo se usa como estado inicial; el pitch se re-aplica al remount por key.
    [is3D],
  );

  const onMouseLeave = useCallback(() => setHover(null), []);

  return (
    <div className="relative h-full w-full" onMouseLeave={onMouseLeave}>
      <Map
        key={is3D ? "3d" : "2d"}
        initialViewState={initialViewState}
        mapStyle={CONFIG.mapStyleUrl}
        attributionControl={false}
        dragRotate
        style={{ width: "100%", height: "100%" }}
      >
        <DeckGLOverlay layers={layers} interleaved={false} />
      </Map>

      <MapTooltip info={hover} />
      <DistrictPopup />

      {/* Atribución mínima requerida por OSM/MapLibre */}
      <div className="pointer-events-none absolute bottom-1 right-2 z-20 text-[10px] text-slate-500">
        © OpenStreetMap · MapLibre · Deck.gl
      </div>

      {isLoading && (
        <div className="absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-base-500/60 bg-base-800/90 px-4 py-2 text-sm text-accent shadow-glow">
          Cargando datos de Berlín…
        </div>
      )}
    </div>
  );
}
