/**
 * Tráfico estilo Waze: colorea las calles reales según los vehículos/hora del
 * detector más cercano. La geometría de las vías se toma del mapa base
 * vectorial (source-layer `transportation` de OpenMapTiles), no se inventan
 * trazados. Cada segmento de calle se asocia al detector más próximo y se
 * colorea con la cantidad de vehículos/hora de ese detector.
 *
 * Módulo de lógica pura (sin React ni deck.gl) para poder probarlo aislado.
 */

import type { TrafficDetector } from "@/lib/types";

/** Color RGBA (0-255) como el que consume deck.gl. */
export type Rgba = [number, number, number, number];

/**
 * Umbrales de clasificación del tráfico en vehículos/hora. Se normaliza el
 * flujo a [0,1] sobre `MAX`; a partir de ~`MAX * 0.75` el color es rojo.
 * Reutiliza el criterio previo del proyecto (~2000 veh/h a rojo intenso).
 */
export const TRAFFIC_THRESHOLDS = {
  /** Flujo (veh/h) que satura la rampa de color en rojo. */
  max: 2000,
  /** Límite superior de "fluido" (verde) en la fracción normalizada. */
  light: 0.33,
  /** Límite superior de "medio" (amarillo/naranja) en la fracción normalizada. */
  medium: 0.66,
} as const;

/** Gris de "sin datos a esa hora" (coherente con el gris neutro del mapa). */
export const TRAFFIC_NO_DATA: Rgba = [148, 163, 184, 150];

/**
 * Color del tráfico por intensidad: verde (fluido) → amarillo/naranja (medio)
 * → rojo (denso). `null`/no finito ⇒ gris de sin datos.
 */
export function trafficColor(qkfz: number | null): Rgba {
  if (qkfz == null || !Number.isFinite(qkfz)) return TRAFFIC_NO_DATA;
  const t = Math.min(1, Math.max(0, qkfz) / TRAFFIC_THRESHOLDS.max);
  let r: number;
  let g: number;
  if (t < 0.5) {
    const u = t / 0.5;
    r = Math.round(74 + u * 181); // 74 → 255 (verde → amarillo)
    g = Math.round(222 - u * 33); // 222 → 189
  } else {
    const u = (t - 0.5) / 0.5;
    r = 255;
    g = Math.round(189 - u * 189); // 189 → 0 (amarillo → rojo)
  }
  return [r, g, 40, 235];
}

/** Grosor en píxeles del trazo de la vía según el flujo; fino sin dato. */
export function trafficWidth(qkfz: number | null): number {
  if (qkfz == null || !Number.isFinite(qkfz)) return 3;
  const t = Math.min(1, Math.max(0, qkfz) / TRAFFIC_THRESHOLDS.max);
  return 4 + t * 8; // 4 px (poco) → 12 px (mucho)
}

/** Segmento de calle (trazado real) listo para pintar, con su detector. */
export interface TrafficRoadSegment {
  /** Id estable del segmento (para React keys / picking). */
  id: string;
  /** Vértices [lng, lat] del trazado real de la vía (puede tener curvas). */
  path: [number, number][];
  /** Detector asociado (el más cercano), o `null` si ninguno está en rango. */
  detectorId: string | null;
}

/** Punto medio aproximado de un trazado (para medir cercanía al detector). */
function midpoint(path: [number, number][]): [number, number] {
  if (path.length === 0) return [0, 0];
  const mid = path[Math.floor(path.length / 2)];
  return mid;
}

/**
 * Asocia un trazado de vía al detector más cercano dentro de `maxDeg` (grados,
 * corregidos por latitud). Devuelve el id del detector o `null` si ninguno está
 * suficientemente cerca (map-matching razonable, sin forzar correspondencias).
 */
export function nearestDetectorId(
  path: [number, number][],
  detectors: TrafficDetector[],
  cosLat: number,
  maxDeg: number,
): string | null {
  if (path.length === 0 || detectors.length === 0) return null;
  const [mlng, mlat] = midpoint(path);
  let best: string | null = null;
  let bestD2 = maxDeg * maxDeg;
  for (const d of detectors) {
    const dx = (d.position[0] - mlng) * cosLat;
    const dy = d.position[1] - mlat;
    const d2 = dx * dx + dy * dy;
    if (d2 <= bestD2) {
      bestD2 = d2;
      best = d.id;
    }
  }
  return best;
}
