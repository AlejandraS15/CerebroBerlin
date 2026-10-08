"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type { Map as MaplibreMap, MapSourceDataEvent } from "maplibre-gl";
import { TERRAIN_SOURCE_ID } from "@/lib/mapStyle";
import { createMapElevationSampler, type ElevationSampler } from "@/lib/terrain";

/** Coordenada `[lng, lat]` de un objeto dibujado sobre el terreno. */
export type TerrainPoint = readonly [number, number];

export interface TerrainElevation {
  /** Cota absoluta por coordenada, o `null` si no hay terreno o la tesela no está cargada. */
  sampler: ElevationSampler;
  /**
   * Se incrementa cuando alguna cota de `points` cambia (> 0,5 m o pasa de no
   * disponible a disponible) o cuando cambia el terreno. Va en los
   * `updateTriggers` de `getPosition` de las capas (20.9).
   */
  elevationVersion: number;
}

/** Sampler antes de que el mapa exista: todo queda a 0 m (20.8). */
const NO_TERRAIN: ElevationSampler = () => null;

/**
 * Cotas del terreno 3D de MapLibre para las capas de deck.gl (Req. 4.8,
 * 20.7–20.9).
 *
 * `points` son las coordenadas de las capas visibles y los vértices de los
 * distritos; se leen siempre en su última versión, sin resuscribir eventos.
 *
 * react-map-gl 7 crea la instancia de MapLibre de forma asíncrona dentro de
 * `<Map>` y rellena el ref sin volver a renderizar al padre, así que el mapa
 * se detecta sondeando el ref en `requestAnimationFrame` hasta que aparece.
 */
export function useTerrainElevation(
  mapRef: RefObject<MapRef>,
  points: Iterable<TerrainPoint>,
): TerrainElevation {
  const [map, setMap] = useState<MaplibreMap | null>(null);
  const [elevationVersion, setElevationVersion] = useState(0);

  const pointsRef = useRef(points);
  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  // Mapa retirado (desmontaje de <Map>): no se vuelve a adoptar.
  const removedRef = useRef<MaplibreMap | null>(null);

  // Detecta la instancia de MapLibre detrás del ref.
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

  const elevation = useMemo(
    () => (map ? createMapElevationSampler(map) : null),
    [map],
  );

  useEffect(() => {
    if (!map || !elevation) return;

    let frame = 0;
    // El terreno cambió: las cotas dibujadas ya no valen aunque `refresh`
    // devuelva false (p. ej. sin terreno, donde todo debe bajar a 0 m).
    let terrainChanged = false;

    const flush = () => {
      frame = 0;
      const changed = elevation.refresh(pointsRef.current);
      if (changed || terrainChanged) setElevationVersion((v) => v + 1);
      terrainChanged = false;
    };
    // Agrupa ráfagas de eventos (sourcedata llega por tesela) en un frame.
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(flush);
    };

    const onTerrain = () => {
      elevation.clear();
      terrainChanged = true;
      schedule();
    };
    const onSourceData = (e: MapSourceDataEvent) => {
      if (e.sourceId === TERRAIN_SOURCE_ID && e.isSourceLoaded) schedule();
    };
    const onRemove = () => {
      removedRef.current = map;
      setMap(null);
    };

    map.on("load", schedule);
    map.on("idle", schedule);
    map.on("terrain", onTerrain);
    map.on("sourcedata", onSourceData);
    map.on("remove", onRemove);
    // El mapa puede estar ya cargado al suscribirse: primera lectura.
    schedule();

    return () => {
      map.off("load", schedule);
      map.off("idle", schedule);
      map.off("terrain", onTerrain);
      map.off("sourcedata", onSourceData);
      map.off("remove", onRemove);
      cancelAnimationFrame(frame);
    };
  }, [map, elevation]);

  return { sampler: elevation?.sample ?? NO_TERRAIN, elevationVersion };
}
