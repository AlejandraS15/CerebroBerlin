/**
 * Curvas horarias de 24 h de la ciudad: EAQI (Open-Meteo Air Quality) y
 * temperatura (Open-Meteo Forecast). Se consultan los 12 Puntos_de_Distrito en
 * una sola petición por API (Open-Meteo acepta coordenadas separadas por comas
 * y devuelve un arreglo de objetos por ubicación; también admite un objeto
 * único con un solo punto).
 *
 * Precondición de la petición (13.1): `buildHourlyUrls` incluye siempre
 * `hourly=european_aqi` (aire), `hourly=temperature_2m` (meteorología),
 * `timezone=Europe/Berlin` y `forecast_days=1`, y `fetchHourly` solo construye
 * URLs con esa función.
 *
 * La hora se toma de la cadena `time` (`"YYYY-MM-DDTHH:00"`, caracteres 11–13),
 * nunca con `new Date()`, para no depender de la zona del navegador. El valor
 * por hora es la media de los puntos con dato.
 *
 * Fallos: ambas APIs caídas → `MOCK_HOURLY` (`mock`); una caída → su serie
 * queda `null` y el origen se registra por el bloque.
 */

import { CONFIG } from "@/lib/config";
import { safeFetchJson } from "@/lib/http";
import type { HourlyPoint, SourceBlock } from "@/lib/types";
import { MOCK_HOURLY } from "@/data/mock";
import { DISTRICT_LIST } from "@/data/districts";

/** Bloque `hourly` de una ubicación de Open-Meteo. */
interface HourlyLocation {
  hourly?: {
    time?: string[];
    [key: string]: unknown;
  };
}

/**
 * Construye las dos URLs (aire y meteorología) con los puntos `[lng, lat]`
 * comma-joined y los parámetros obligatorios de 13.1.
 */
export function buildHourlyUrls(points: readonly [number, number][]): {
  air: string;
  weather: string;
} {
  const lats = points.map((p) => String(p[1])).join(",");
  const lons = points.map((p) => String(p[0])).join(",");

  const air = new URLSearchParams({
    latitude: lats,
    longitude: lons,
    hourly: "european_aqi",
    timezone: "Europe/Berlin",
    forecast_days: "1",
  });
  const weather = new URLSearchParams({
    latitude: lats,
    longitude: lons,
    hourly: "temperature_2m",
    timezone: "Europe/Berlin",
    forecast_days: "1",
  });
  return {
    air: `${CONFIG.airQualityApiBase}/air-quality?${air.toString()}`,
    weather: `${CONFIG.weatherApiBase}/forecast?${weather.toString()}`,
  };
}

/** Normaliza la respuesta a una lista de ubicaciones (arreglo u objeto único). */
function asLocations(raw: unknown): HourlyLocation[] {
  if (Array.isArray(raw)) return raw as HourlyLocation[];
  if (raw && typeof raw === "object") return [raw as HourlyLocation];
  return [];
}

/**
 * Devuelve 24 valores (`number | null`) por hora local para la clave `key`
 * (`european_aqi` o `temperature_2m`), promediando los puntos con dato. La hora
 * se extrae de los caracteres 11–13 de cada `time`. Horas sin ningún dato → `null`.
 */
export function parseHourly(raw: unknown, key: string): (number | null)[] {
  const sums = new Array<number>(24).fill(0);
  const counts = new Array<number>(24).fill(0);

  for (const loc of asLocations(raw)) {
    const times = loc.hourly?.time;
    const values = loc.hourly?.[key];
    if (!Array.isArray(times) || !Array.isArray(values)) continue;
    const n = Math.min(times.length, values.length);
    for (let i = 0; i < n; i++) {
      const t = times[i];
      const v = values[i];
      if (typeof t !== "string" || t.length < 13) continue;
      const hour = Number(t.slice(11, 13));
      if (!Number.isInteger(hour) || hour < 0 || hour > 23) continue;
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      sums[hour] += v;
      counts[hour] += 1;
    }
  }

  return sums.map((sum, h) => (counts[h] > 0 ? sum / counts[h] : null));
}

/**
 * Curvas horarias de EAQI y temperatura de la ciudad. Ambas APIs caídas →
 * `MOCK_HOURLY` con origen de bloque `mock`.
 */
export async function fetchHourly(): Promise<SourceBlock<HourlyPoint[]>> {
  if (CONFIG.useMockData) {
    return { data: MOCK_HOURLY, origin: "mock", fetchedAt: null };
  }

  const points = DISTRICT_LIST.map((d) => d.point);
  const { air, weather } = buildHourlyUrls(points);
  const [rawAir, rawWeather] = await Promise.all([
    safeFetchJson<unknown>(air),
    safeFetchJson<unknown>(weather),
  ]);

  // Ambas caídas → mock.
  if (rawAir === null && rawWeather === null) {
    return { data: MOCK_HOURLY, origin: "mock", fetchedAt: null };
  }

  // Una caída → su serie queda null (parseHourly de null devuelve 24 nulos).
  const aqi = parseHourly(rawAir, "european_aqi");
  const temperature = parseHourly(rawWeather, "temperature_2m");

  const data: HourlyPoint[] = Array.from({ length: 24 }).map((_, hour) => ({
    hour,
    aqi: aqi[hour] != null ? Math.round(aqi[hour] as number) : null,
    temperature: temperature[hour] != null ? Math.round((temperature[hour] as number) * 10) / 10 : null,
  }));

  return { data, origin: "live", fetchedAt: new Date().toISOString() };
}
