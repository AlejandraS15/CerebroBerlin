"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { NavigationControl, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { DeckGLOverlay } from "./DeckGLOverlay";
import { BERLIN_VIEW, CITY_3D_VIEW } from "@/lib/layers";
import { BUILDINGS_MIN_ZOOM } from "@/lib/mapStyle";
import { useCityStore } from "@/store/useCityStore";
import { useCityData } from "@/hooks/useCityData";
import { useMapStyle } from "@/hooks/useMapStyle";
import { useTerrainElevation, type TerrainPoint } from "@/hooks/useTerrainElevation";
import { buildDeckLayers } from "./buildDeckLayers";
import { HoverTooltip, PinnedTooltipCard } from "./MapTooltip";
import { DistrictPopup } from "./DistrictPopup";
import { tooltipFor } from "@/lib/tooltips";
import type { District, MapTarget } from "@/lib/types";

const CAMERA_2D = { pitch: 0, bearing: 0, duration: 900 };

/**
 * Cámara para entrar en 3D. Si estamos lejos (sin edificios visibles), vuela
 * al centro de la ciudad; si ya estamos cerca, solo inclina y rota.
 */
function cameraFor3D(map: MapRef) {
  const { longitude, latitude, zoom, pitch, bearing } = CITY_3D_VIEW;
  if (map.getZoom() >= BUILDINGS_MIN_ZOOM) return { pitch, bearing, duration: 1200 };
  return {
    center: [longitude, latitude] as [number, number],
    zoom,
    pitch,
    bearing,
    duration: 2000,
  };
}

/**
 * Contenedor central del gemelo digital: mapa MapLibre con terreno, relieve y
 * edificios 3D, más el overlay Deck.gl con las capas de datos.
 *
 * El mapa se monta UNA sola vez. El cambio 2D/3D anima la cámara en lugar de
 * recrear el mapa, así el estilo, las teselas y las capas de datos persisten.
 */
export function MapContainer() {
  const { data, isLoading } = useCityData();
  const { data: mapStyle } = useMapStyle();
  const visibility = useCityStore((s) => s.layerVisibility);
  const selectedHour = useCityStore((s) => s.selectedHour);
  const is3D = useCityStore((s) => s.is3D);
  const setSelectedDistrict = useCityStore((s) => s.setSelectedDistrict);
  const pinned = useCityStore((s) => s.pinned);
  const pin = useCityStore((s) => s.pin);

  // Objetivo bajo el puntero y posición del puntero (para el tooltip flotante).
  const [hoverTarget, setHoverTarget] = useState<MapTarget | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const [, forceTick] = useState(0);
  const [mapError, setMapError] = useState<string | null>(null);

  const mapRef = useRef<MapRef>(null);
  // Última vista aplicada a la cámara, para animar solo cuando cambia.
  const appliedIs3D = useRef(is3D);

  useEffect(() => {
    const map = mapRef.current;
    // Si el mapa aún no está montado, montará directamente con la vista actual.
    if (!map || appliedIs3D.current === is3D) {
      appliedIs3D.current = is3D;
      return;
    }
    appliedIs3D.current = is3D;
    map.easeTo(is3D ? cameraFor3D(map) : CAMERA_2D);
  }, [is3D]);

  // Puntos de las capas visibles + vértices de distritos para el muestreo de
  // cotas del terreno. Memoizado por datos (no por hora: las posiciones no
  // cambian con la hora).
  const terrainPoints = useMemo<TerrainPoint[]>(() => {
    if (!data) return [];
    const pts: TerrainPoint[] = [];
    for (const f of data.districts.features) {
      const polys =
        f.geometry.type === "Polygon"
          ? [f.geometry.coordinates]
          : f.geometry.coordinates;
      for (const poly of polys)
        for (const ring of poly)
          for (const v of ring) pts.push([v[0], v[1]]);
    }
    for (const a of data.air) pts.push(a.position);
    for (const s of data.airStations) pts.push(s.position);
    for (const d of data.trafficDetectors) pts.push(d.position);
    for (const t of data.transit) pts.push(t.position);
    for (const b of data.bikes) pts.push(b.position);
    for (const w of data.weather) pts.push(w.position);
    for (const h of data.hotspots) pts.push(h.position);
    for (const p of data.infrastructure) pts.push(p.position);
    return pts;
  }, [data]);

  const { sampler, elevationVersion } = useTerrainElevation(mapRef, terrainPoints);

  const onDistrictClick = useCallback(
    (d: District) => setSelectedDistrict(d),
    [setSelectedDistrict],
  );

  const layers = useMemo(() => {
    if (!data) return [];
    return buildDeckLayers({
      data,
      visibility,
      hour: selectedHour,
      sampler,
      elevationVersion,
      onDistrictClick,
      onHover: setHoverTarget,
    });
  }, [data, visibility, selectedHour, sampler, elevationVersion, onDistrictClick]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    pointer.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    // Reposiciona el tooltip flotante sin recomputar las capas.
    forceTick((t) => (t + 1) % 1_000_000);
  }, []);

  const onMouseLeave = useCallback(() => setHoverTarget(null), []);

  // Clic sobre un objeto: fijar su tarjeta. Los distritos ya abren el popup
  // vía `onDistrictClick` de la capa; aquí se fija además la tarjeta.
  const onClick = useCallback(() => {
    if (!hoverTarget) return;
    pin({ ...hoverTarget, anchor: { ...pointer.current }, returnFocusTo: null });
  }, [hoverTarget, pin]);

  const onMapError = useCallback(
    (e: { error?: Error; sourceId?: string }) => {
      // Una tesela que falla (p. ej. DEM fuera de cobertura) no es fatal.
      if (e.sourceId) {
        console.warn(`MapLibre: fallo de tesela en "${e.sourceId}"`, e.error);
        return;
      }
      console.error("MapLibre error:", e.error);
      setMapError(e.error?.message ?? "Error desconocido del mapa.");
    },
    [],
  );

  // Mientras hay tarjeta fijada del mismo objeto, se suprime el hover.
  const hoverContent =
    data && hoverTarget && !(pinned && pinned.kind === hoverTarget.kind && pinned.id === hoverTarget.id)
      ? tooltipFor(hoverTarget, data, selectedHour)
      : null;
  const pinnedContent =
    data && pinned ? tooltipFor({ kind: pinned.kind, id: pinned.id }, data, selectedHour) : null;

  return (
    <div
      className="relative h-full w-full"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {mapStyle ? (
        <Map
          ref={mapRef}
          // Solo se usa al montar; después la cámara se anima en el efecto.
          initialViewState={is3D ? CITY_3D_VIEW : BERLIN_VIEW}
          mapStyle={mapStyle.style}
          maxPitch={80}
          attributionControl={false}
          dragRotate
          style={{ width: "100%", height: "100%" }}
          onError={onMapError}
          onClick={onClick}
        >
          <NavigationControl position="top-left" visualizePitch />
          {/* Overlay separado (no interleaved): los datos se dibujan encima del
              terreno y los edificios en vez de quedar ocultos por ellos. */}
          <DeckGLOverlay layers={layers} interleaved={false} />
        </Map>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-base-900 text-sm text-slate-500">
          Cargando mapa base 3D…
        </div>
      )}

      {(mapStyle?.degraded || mapError) && (
        <div className="absolute left-1/2 top-3 z-30 max-w-md -translate-x-1/2 rounded-lg border border-signal-warn/50 bg-base-800/95 px-3 py-2 text-center text-xs text-signal-warn shadow-panel">
          {mapError ?? "Mapa base no disponible: se muestra solo el relieve del terreno."}
        </div>
      )}

      <HoverTooltip content={hoverContent} x={pointer.current.x} y={pointer.current.y} />
      <PinnedTooltipCard content={pinnedContent} />
      <DistrictPopup />

      {/* Atribución requerida por las fuentes del mapa base y del terreno */}
      <div className="pointer-events-none absolute bottom-1 right-2 z-20 text-[10px] text-slate-500">
        © OpenStreetMap contributors · OpenFreeMap · Mapzen · MapLibre · Deck.gl
      </div>

      {isLoading && (
        <div className="absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-base-500/60 bg-base-800/90 px-4 py-2 text-sm text-accent shadow-glow">
          Cargando datos de Berlín…
        </div>
      )}
    </div>
  );
}
