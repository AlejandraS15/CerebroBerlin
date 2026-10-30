"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type { Map as MaplibreMap } from "maplibre-gl";
import type { TrafficDetector } from "@/lib/types";
import {
  nearestDetectorId,
  type TrafficRoadSegment,
} from "@/lib/trafficRoads";

/** Source-layer de las vías en el esquema OpenMapTiles del mapa base. */
const ROAD_SOURCE_LAYER = "transportation";
/**
 * Distancia máxima (grados, corregidos por latitud) para asociar un tramo de
 * vía al detector más cercano. ~450 m: suficiente para cubrir la vía donde está
 * el detector sin forzar correspondencias lejanas.
 */
const MAX_SNAP_DEG = 0.006;

export interface TrafficRoads {
  segments: TrafficRoadSegment[];
  /** Se incrementa cuando cambian los segmentos (nuevas teselas / movimiento). */
  version: number;
}

/**
 * Descubre el id de la fuente vectorial del mapa base buscando una capa de
 * estilo cuyo `source-layer` sea `transportation`. Así no se depende del nombre
 * concreto ("openmaptiles" u otro) que use el estilo oscuro cargado.
 */
function findRoadSourceId(map: MaplibreMap): string | null {
  const style = map.getStyle();
  const layer = style?.layers?.find(
    (l) => "source-layer" in l && l["source-layer"] === ROAD_SOURCE_LAYER,
  );
  return layer && "source" in layer ? (layer.source as string) : null;
}

/** Extrae los trazados [lng,lat][] de una geometría LineString/MultiLineString. */
function pathsFromGeometry(geom: GeoJSON.Geometry): [number, number][][] {
  if (geom.type === "LineString") return [geom.coordinates as [number, number][]];
  if (geom.type === "MultiLineString") return geom.coordinates as [number, number][][];
  return [];
}

/**
 * Lee la red vial real del mapa base (teselas vectoriales) y asocia cada tramo
 * de calle al detector de tráfico más cercano, para poder colorear las calles
 * siguiendo su trazado (estilo Waze).
 *
 * Reacciona al movimiento/zoom del mapa (llegan nuevas teselas) re-consultando
 * las features y recalculando los tramos; agrupa ráfagas de eventos en un frame.
 */
export function useTrafficRoads(
  mapRef: RefObject<MapRef>,
  detectors: TrafficDetector[],
  enabled: boolean,
): TrafficRoads {
  const [map, setMap] = useState<MaplibreMap | null>(null);
  const [segments, setSegments] = useState<TrafficRoadSegment[]>([]);
  const [version, setVersion] = useState(0);

  const detectorsRef = useRef(detectors);
  useEffect(() => {
    detectorsRef.current = detectors;
  }, [detectors]);

  const removedRef = useRef<MaplibreMap | null>(null);

  // Detecta la instancia de MapLibre tras el ref (igual que useTerrainElevation).
  useEffect(() => {
    if (map) return;
    let frame = 0;
    const poll = () => {
      const found = mapRef.current?.getMap() ?? null;
      if (found && found !== removedRef.current) setMap(found);
      else frame = requestAnimationFrame(poll);
    };
    poll();
    return () => cancelAnimationFrame(frame);
  }, [map, mapRef]);

  useEffect(() => {
    // Capa desactivada: no consultar la red vial y limpiar los tramos.
    if (!map || !enabled) {
      if (segments.length > 0) {
        setSegments([]);
        setVersion((v) => v + 1);
      }
      return;
    }

    let frame = 0;

    const rebuild = () => {
      frame = 0;
      const sourceId = findRoadSourceId(map);
      if (!sourceId) return;

      let features: GeoJSON.Feature[] = [];
      try {
        features = map.querySourceFeatures(sourceId, {
          sourceLayer: ROAD_SOURCE_LAYER,
        }) as unknown as GeoJSON.Feature[];
      } catch {
        return; // La fuente puede no estar lista todavía.
      }

      const cosLat = Math.cos((52.52 * Math.PI) / 180);
      const dets = detectorsRef.current;
      const seen = new Set<string>();
      const next: TrafficRoadSegment[] = [];

      for (const f of features) {
        if (!f.geometry) continue;
        const fid = f.id != null ? String(f.id) : null;
        const paths = pathsFromGeometry(f.geometry);
        for (let i = 0; i < paths.length; i++) {
          const path = paths[i];
          if (path.length < 2) continue;
          // Deduplica por id de feature (las teselas repiten features en bordes).
          const id = `${fid ?? `${path[0][0]},${path[0][1]}`}-${i}`;
          if (seen.has(id)) continue;
          seen.add(id);
          next.push({
            id,
            path,
            detectorId: nearestDetectorId(path, dets, cosLat, MAX_SNAP_DEG),
          });
        }
      }

      setSegments(next);
      setVersion((v) => v + 1);
    };

    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(rebuild);
    };
    const onRemove = () => {
      removedRef.current = map;
      setMap(null);
    };

    map.on("idle", schedule);
    map.on("moveend", schedule);
    map.on("remove", onRemove);
    schedule(); // Primera lectura (el mapa puede estar ya cargado).

    return () => {
      map.off("idle", schedule);
      map.off("moveend", schedule);
      map.off("remove", onRemove);
      cancelAnimationFrame(frame);
    };
    // `segments.length` fuera de deps a propósito: solo re-suscribe por mapa/enabled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, enabled]);

  return { segments, version };
}
