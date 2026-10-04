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
import { buildDeckLayers, type HoverInfo } from "./buildDeckLayers";
import { MapTooltip } from "./MapTooltip";
import { DistrictPopup } from "./DistrictPopup";

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
  const [hover, setHover] = useState<HoverInfo | null>(null);
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

  const onMouseLeave = useCallback(() => setHover(null), []);

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

  return (
    <div className="relative h-full w-full" onMouseLeave={onMouseLeave}>
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

      <MapTooltip info={hover} />
      <DistrictPopup />

      {/* Atribución requerida por las fuentes del mapa base y del terreno */}
      <div className="pointer-events-none absolute bottom-1 right-2 z-20 text-[10px] text-slate-500">
        © OpenStreetMap · OpenFreeMap · Mapzen · MapLibre · Deck.gl
      </div>

      {isLoading && (
        <div className="absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-base-500/60 bg-base-800/90 px-4 py-2 text-sm text-accent shadow-glow">
          Cargando datos de Berlín…
        </div>
      )}
    </div>
  );
}
