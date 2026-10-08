/**
 * Serie de 24 horas del gráfico, compuesta a partir del perfil de tráfico del
 * lago (`series.perfil_ciudad`, perfil típico de junio de 2025) y las curvas
 * horarias de Open-Meteo (EAQI y temperatura). Función pura (13.2, 13.3, 7.4).
 */

import type { HourlyPoint, TimeSeriesPoint } from "@/lib/types";

/**
 * Construye los 24 puntos de la serie:
 * - `traffic = profile[h]` (veh/h, perfil del lago).
 * - `trafficIndex = round(profile[h] / max(profile) × 100)` (0–100 relativo).
 * - `aqi`/`temperature` de la curva horaria (`hourly`) o `null` si no hay dato.
 * - `label = "HH:00"`.
 */
export function buildTimeSeries(
  profile: readonly number[],
  hourly: readonly HourlyPoint[],
): TimeSeriesPoint[] {
  const max = profile.reduce((m, v) => (Number.isFinite(v) && v > m ? v : m), 0);
  const byHour = new Map<number, HourlyPoint>();
  for (const h of hourly) byHour.set(h.hour, h);

  return Array.from({ length: 24 }).map((_, hour) => {
    const traffic = profile[hour] ?? 0;
    const trafficIndex = max > 0 ? Math.round((traffic / max) * 100) : 0;
    const h = byHour.get(hour);
    return {
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      traffic,
      trafficIndex,
      aqi: h?.aqi ?? null,
      temperature: h?.temperature ?? null,
    };
  });
}
