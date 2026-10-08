/**
 * Única definición del Índice Europeo de Calidad del Aire (EAQI).
 *
 * Umbrales y fórmula tomados de Open-Meteo (`EuropeanAirQuality`):
 * subíndice = (índice del tramo + posición lineal dentro del tramo) × 20,
 * extrapolando con el último tramo por encima del último umbral.
 * El EAQI global es el máximo de los subíndices disponibles.
 *
 * Módulo autónomo: no depende de `types.ts` ni de React.
 */

export type Pollutant = "pm25" | "pm10" | "no2" | "o3";

/** Umbrales horarios en µg/m³ (Open-Meteo, EuropeanAirQuality). */
export const EAQI_THRESHOLDS: Readonly<Record<Pollutant, readonly number[]>> = {
  pm25: [0, 5, 15, 50, 90, 140],
  pm10: [0, 15, 45, 120, 195, 270],
  no2: [0, 10, 25, 60, 100, 150],
  o3: [0, 60, 100, 120, 160, 180],
};

const POLLUTANTS: readonly Pollutant[] = ["pm25", "pm10", "no2", "o3"];

/**
 * Subíndice: (índice de tramo + posición lineal en el tramo) × 20.
 * Las concentraciones negativas se tratan como 0. Por encima del último
 * umbral se extrapola con el último tramo (p. ej. PM2.5 > 140 usa [90, 140]).
 */
export function subIndex(p: Pollutant, c: number): number {
  const t = EAQI_THRESHOLDS[p];
  const x = Math.max(0, c);
  let i = 0;
  // i se detiene en t.length - 2 para que el último tramo sirva de extrapolación.
  while (i < t.length - 2 && x >= t[i + 1]) i++;
  return (i + (x - t[i]) / (t[i + 1] - t[i])) * 20;
}

export type Concentrations = Partial<Record<Pollutant, number | null>>;

/** Máximo de los subíndices disponibles; `null` si no hay ningún valor finito. */
export function eaqiRaw(c: Concentrations): number | null {
  let max: number | null = null;
  for (const p of POLLUTANTS) {
    const v = c[p];
    if (v == null || !Number.isFinite(v)) continue;
    const s = subIndex(p, v);
    if (max === null || s > max) max = s;
  }
  return max;
}

/** `eaqiRaw` redondeado al entero (10.4: 19,5 PM2.5 + 104 O3 → 44). */
export function eaqi(c: Concentrations): number | null {
  const raw = eaqiRaw(c);
  return raw === null ? null : Math.round(raw);
}

export type EaqiTone = "good" | "fair" | "moderate" | "poor" | "veryPoor" | "extreme";

/**
 * Banda EAQI. `min` y `max` son enteros inclusivos sobre el valor mostrado
 * (redondeado); `max = null` indica banda abierta por arriba.
 */
export interface EaqiBand {
  id: EaqiTone;
  label: string;
  min: number;
  max: number | null;
  color: string;
  tone: EaqiTone;
}

/** <20 Buena · [20,40) Razonable · [40,60) Moderada · [60,80) Mala · [80,100] Muy mala · >100 Extremadamente mala. Paleta EEA. */
export const EAQI_BANDS: readonly EaqiBand[] = [
  { id: "good", label: "Buena", min: 0, max: 19, color: "#50f0e6", tone: "good" },
  { id: "fair", label: "Razonable", min: 20, max: 39, color: "#50ccaa", tone: "fair" },
  { id: "moderate", label: "Moderada", min: 40, max: 59, color: "#f0e641", tone: "moderate" },
  { id: "poor", label: "Mala", min: 60, max: 79, color: "#ff5050", tone: "poor" },
  { id: "veryPoor", label: "Muy mala", min: 80, max: 100, color: "#960032", tone: "veryPoor" },
  { id: "extreme", label: "Extremadamente mala", min: 101, max: null, color: "#7d2181", tone: "extreme" },
];

/**
 * Banda del valor EAQI. Se calcula sobre el entero mostrado (`Math.round`)
 * para que número y etiqueta coincidan. Valores negativos → "Buena";
 * `null` o no finito → `null`.
 */
export function eaqiBand(v: number | null): EaqiBand | null {
  if (v == null || !Number.isFinite(v)) return null;
  const n = Math.max(0, Math.round(v));
  for (const b of EAQI_BANDS) {
    if (b.max === null || n <= b.max) return b;
  }
  // Inalcanzable: la última banda es abierta.
  return EAQI_BANDS[EAQI_BANDS.length - 1];
}
