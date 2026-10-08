import type { Map as MaplibreMap } from "maplibre-gl";

/**
 * Elevación por punto sobre el terreno 3D (Req. 4.8, 20.7–20.9).
 *
 * Semántica de MapLibre GL JS 4.7.1 (comprobada contra node_modules):
 *  - `queryTerrainElevation(p)` devuelve `null` sin terreno y, con terreno,
 *    `terrain.getElevationForLngLatZoom(p, tileZoom) − transform.elevation`:
 *    la diferencia respecto a la cota del centro de la cámara, ya exagerada.
 *    Mientras la tesela DEM no está cargada, la cota de la tesela vacía es 0.
 *  - `getCameraTargetElevation()` devuelve `transform.elevation`
 *    ("m s. n. m." × exageración).
 * deck.gl (MapboxOverlay no interleaved) sitúa la cámara en
 * `[0, 0, transform.elevation]`, así que el z correcto de un punto es
 * `queryTerrainElevation(p) + getCameraTargetElevation()`.
 *
 * Sin dependencias de React: el hook `useTerrainElevation` se apoya en esto.
 */

/** Cota absoluta (m × exageración) de una coordenada, o `null` si no está disponible. */
export type ElevationSampler = (lng: number, lat: number) => number | null;

/** Subconjunto del mapa de MapLibre que necesita el muestreador. */
export type TerrainMap = Pick<
  MaplibreMap,
  "getTerrain" | "queryTerrainElevation" | "getCameraTargetElevation"
>;

/** Geometrías poligonales de distrito (mismo contrato que `DistrictFeature`). */
export type PolygonalGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

/** Diferencia mínima (m) para considerar que una cota cambió. */
const CHANGE_THRESHOLD_M = 0.5;
/** Decimales de la clave de caché (~1 m en Berlín). */
const CACHE_DECIMALS = 5;

/**
 * Cota absoluta a partir del desfase de `queryTerrainElevation` y la cota del
 * centro de la cámara. En Berlín (30–120 m) una cota ≤ 0 solo puede venir de
 * la tesela DEM vacía, así que se trata como no disponible.
 */
export function absoluteElevation(
  offset: number | null,
  cameraTarget: number,
): number | null {
  if (offset == null) return null;
  const z = offset + cameraTarget;
  return Number.isFinite(z) && z > 0 ? z : null;
}

/** Posición 3D: z = cota muestreada, o 0 m como respaldo (20.8). */
export function withElevation(
  [lng, lat]: readonly [number, number],
  sampler: ElevationSampler,
): [number, number, number] {
  return [lng, lat, sampler(lng, lat) ?? 0];
}

function elevateRing(ring: number[][], sampler: ElevationSampler): number[][] {
  return ring.map((p) => withElevation([p[0], p[1]], sampler));
}

/**
 * Aplica `withElevation` a todo vértice de un Polygon/MultiPolygon. Función
 * pura: devuelve una geometría nueva del mismo tipo.
 */
export function elevateGeometry<G extends PolygonalGeometry>(
  geometry: G,
  sampler: ElevationSampler,
): G {
  if (geometry.type === "Polygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((ring) => elevateRing(ring, sampler)),
    };
  }
  return {
    ...geometry,
    coordinates: (geometry.coordinates as number[][][][]).map((poly) =>
      poly.map((ring) => elevateRing(ring, sampler)),
    ),
  };
}

function cacheKey(lng: number, lat: number): string {
  return `${lng.toFixed(CACHE_DECIMALS)},${lat.toFixed(CACHE_DECIMALS)}`;
}

/**
 * Muestreador sobre un mapa de MapLibre con caché por coordenada redondeada a
 * 5 decimales. Solo se cachean valores disponibles; una excepción de MapLibre
 * equivale a "no disponible" y no se cachea.
 */
export function createMapElevationSampler(map: TerrainMap): {
  sample: ElevationSampler;
  /** Vuelve a leer las cotas; `true` si alguna cambió > 0,5 m o pasó de `null` a número. */
  refresh(points: Iterable<readonly [number, number]>): boolean;
  clear(): void;
} {
  const cache = new Map<string, number>();

  /** Lectura directa del terreno, sin caché. */
  function query(lng: number, lat: number): number | null {
    if (map.getTerrain() == null) return null;
    try {
      return absoluteElevation(
        map.queryTerrainElevation([lng, lat]),
        map.getCameraTargetElevation(),
      );
    } catch {
      return null;
    }
  }

  function sample(lng: number, lat: number): number | null {
    if (map.getTerrain() == null) return null;
    const key = cacheKey(lng, lat);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const z = query(lng, lat);
    if (z != null) cache.set(key, z);
    return z;
  }

  function refresh(points: Iterable<readonly [number, number]>): boolean {
    if (map.getTerrain() == null) return false;
    let changed = false;
    for (const [lng, lat] of points) {
      const z = query(lng, lat);
      // Un valor que deja de estar disponible (tesela expulsada) conserva la
      // última cota conocida para no saltar a 0 m.
      if (z == null) continue;
      const key = cacheKey(lng, lat);
      const prev = cache.get(key);
      // La caché guarda la cota ya dibujada: los cambios pequeños no se
      // aplican, así no se acumula deriva bajo el umbral.
      if (prev === undefined || Math.abs(z - prev) > CHANGE_THRESHOLD_M) {
        cache.set(key, z);
        changed = true;
      }
    }
    return changed;
  }

  function clear(): void {
    cache.clear();
  }

  return { sample, refresh, clear };
}
