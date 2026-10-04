import { CONFIG } from "@/lib/config";
import { safeFetchJson } from "@/lib/http";
import type { WeatherPoint } from "@/lib/types";
import { MOCK_WEATHER } from "@/data/mock";
import { DISTRICT_LIST } from "@/data/districts";

// Respuesta parcial de Open-Meteo Forecast (/forecast con current=...).
interface OpenMeteoForecast {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    weather_code?: number;
  };
}

/** Construye la URL de Open-Meteo Forecast para una coordenada. */
export function buildWeatherUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current:
      "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
  });
  return `${CONFIG.weatherApiBase}/forecast?${params.toString()}`;
}

/**
 * Clima real por distrito vía Open-Meteo Forecast (sin token). Consulta el
 * centroide de cada distrito en paralelo; degrada a mock si todo falla.
 */
export async function fetchWeather(): Promise<{
  data: WeatherPoint[];
  source: "live" | "mock";
}> {
  if (CONFIG.useMockData) return { data: MOCK_WEATHER, source: "mock" };

  const results = await Promise.all(
    DISTRICT_LIST.map(async (d) => {
      const [lon, lat] = d.centroid;
      const raw = await safeFetchJson<OpenMeteoForecast>(
        buildWeatherUrl(lat, lon),
      );
      const c = raw?.current;
      if (!c || c.temperature_2m == null) return null;
      const point: WeatherPoint = {
        id: `wx-${d.id}`,
        location: d.name,
        position: d.centroid,
        temperature: Math.round((c.temperature_2m ?? 0) * 10) / 10,
        humidity: Math.round(c.relative_humidity_2m ?? 0),
        windSpeed: Math.round((c.wind_speed_10m ?? 0) * 10) / 10,
        weatherCode: Math.round(c.weather_code ?? 0),
        updatedAt: new Date().toISOString(),
      };
      return point;
    }),
  );

  const data = results.filter((p): p is WeatherPoint => p !== null);
  return data.length > 0
    ? { data, source: "live" }
    : { data: MOCK_WEATHER, source: "mock" };
}

/** Texto legible para un código de tiempo WMO. */
export function weatherCodeLabel(code: number): string {
  if (code === 0) return "Despejado";
  if (code <= 2) return "Parcialmente nublado";
  if (code === 3) return "Nublado";
  if (code >= 45 && code <= 48) return "Niebla";
  if (code >= 51 && code <= 67) return "Llovizna/Lluvia";
  if (code >= 71 && code <= 77) return "Nieve";
  if (code >= 80 && code <= 82) return "Chubascos";
  if (code >= 95) return "Tormenta";
  return "Variable";
}
