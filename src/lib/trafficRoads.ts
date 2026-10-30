/**
 * Tráfico tipo Waze: tramos de vía coloreados por vehículos/hora del detector.
 *
 * Los detectores no traen geometría de calle, así que cada detector se dibuja
 * como un tramo que sigue el eje de su corredor: se conecta con sus detectores
 * vecinos más próximos (que se alinean sobre la misma vía), formando una
 * polilínea que aproxima el trazado de la calle en lugar de una raya aislada.
 * El color/grosor salen de los vehículos/hora de ese detector en la hora
 * seleccionada.
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

/** Tramo de vía (polilínea) de un detector, listo para pintar con PathLayer. */
export interface TrafficRoadSegment {
  /** Id del detector (para picking / React keys). */
  id: string;
  /** Vértices [lng, lat] del tramo que sigue el eje del corredor. */
  path: [number, number][];
  /** Índice del detector en `data.trafficDetectors` (acceso a qkfz por hora). */
  detectorIndex: number;
}

/** Latitud de referencia (centro de Berlín) para corregir longitudes en grados. */
const BERLIN_COS_LAT = Math.cos((52.52 * Math.PI) / 180);
/** Media longitud (grados) del tramo cuando un detector no tiene vecinos cerca. */
const FALLBACK_HALF = 0.0009; // ~90 m total
/** Distancia máx. (grados, corregida) para considerar a un vecino del corredor. */
const NEIGHBOR_MAX_DEG = 0.004; // ~300 m

/** Distancia al cuadrado entre dos puntos, corrigiendo la longitud por latitud. */
function dist2(a: [number, number], b: [number, number]): number {
  const dx = (a[0] - b[0]) * BERLIN_COS_LAT;
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

/** Punto medio entre dos coordenadas. */
function mid(a: [number, number], b: [number, number]): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/**
 * Construye, por cada detector, una polilínea que sigue el eje de su corredor:
 * va del punto medio hacia su vecino más cercano, pasa por el detector y sigue
 * hacia su segundo vecino más cercano. Así el tramo "apunta" a lo largo de la
 * calle (no es una raya horizontal) y queda centrado en el detector. Si no hay
 * vecinos en rango, usa un tramo corto horizontal de respaldo.
 *
 * O(n²) sobre los detectores; se ejecuta una vez (no por frame).
 */
export function buildTrafficRoadSegments(
  detectors: TrafficDetector[],
): TrafficRoadSegment[] {
  const n = detectors.length;
  return detectors.map((d, i) => {
    const p = d.position;
    // Dos vecinos más cercanos (en rango).
    let n1 = -1;
    let n2 = -1;
    let d1 = NEIGHBOR_MAX_DEG * NEIGHBOR_MAX_DEG;
    let d2 = NEIGHBOR_MAX_DEG * NEIGHBOR_MAX_DEG;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const dd = dist2(p, detectors[j].position);
      if (dd < d1) {
        d2 = d1;
        n2 = n1;
        d1 = dd;
        n1 = j;
      } else if (dd < d2) {
        d2 = dd;
        n2 = j;
      }
    }

    let path: [number, number][];
    if (n1 >= 0 && n2 >= 0) {
      path = [mid(p, detectors[n1].position), p, mid(p, detectors[n2].position)];
    } else if (n1 >= 0) {
      const m = mid(p, detectors[n1].position);
      // Extiende simétricamente al otro lado para que el tramo quede centrado.
      const opp: [number, number] = [2 * p[0] - m[0], 2 * p[1] - m[1]];
      path = [m, p, opp];
    } else {
      // Sin vecinos: tramo corto horizontal centrado en el detector.
      path = [
        [p[0] - FALLBACK_HALF / BERLIN_COS_LAT, p[1]],
        [p[0] + FALLBACK_HALF / BERLIN_COS_LAT, p[1]],
      ];
    }

    return { id: d.id, path, detectorIndex: i };
  });
}
