import { CONFIG } from "@/lib/config";
import { safeFetchJson } from "@/lib/http";
import type { WeatherPoint } from "@/lib/types";
import { MOCK_WEATHER } from "@/data/mock";
import { DISTRICT_LIST } from "@/data/districts";
import { DWD_STATIONS, fetchDwdObservations, type DwdObservation } from "./dwdWeather";

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
 * Clima real por distrito: DWD es la fuente primaria y Open-Meteo el fallback
 * técnico cuando las observaciones DWD no están disponibles.
 */
export async function fetchWeather(): Promise<{
  data: WeatherPoint[];
  origin: "live" | "mock";
  sourceId: "dwd-open-data-weather" | "open-meteo-meteo";
  fetchedAt: string | null;
}> {
  if (CONFIG.useMockData) {
    return {
      data: MOCK_WEATHER,
      origin: "mock",
      sourceId: "dwd-open-data-weather",
      fetchedAt: null,
    };
  }

  const dwdData = await fetchDwdObservations();
  if (dwdData.length > 0) {
    return {
      data: DISTRICT_LIST.map((district) => {
        const station = nearestStation(district.point);
        const observation = nearestObservation(station.id, dwdData) ?? dwdData[0];
        return {
          id: `wx-${district.id}`,
          location: district.name,
          position: district.point,
          temperature: Math.round(observation.temperature * 10) / 10,
          humidity: Math.round(observation.humidity),
          windSpeed: Math.round(observation.windSpeed * 10) / 10,
          weatherCode: observation.weatherCode,
          updatedAt: observation.observedAt,
        };
      }),
      origin: "live",
      sourceId: "dwd-open-data-weather",
      fetchedAt: new Date().toISOString(),
    };
  }

  // Mantiene la disponibilidad de la capa si DWD está temporalmente caído.
  const results = await Promise.all(
    DISTRICT_LIST.map(async (d) => {
      const [lon, lat] = d.point;
      const raw = await safeFetchJson<OpenMeteoForecast>(
        buildWeatherUrl(lat, lon),
      );
      const c = raw?.current;
      if (!c || c.temperature_2m == null) return null;
      const point: WeatherPoint = {
        id: `wx-${d.id}`,
        location: d.name,
        position: d.point,
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
    ? {
        data,
        origin: "live",
        sourceId: "open-meteo-meteo",
        fetchedAt: new Date().toISOString(),
      }
    : {
        data: MOCK_WEATHER,
        origin: "mock",
        sourceId: "open-meteo-meteo",
        fetchedAt: null,
      };
}

function nearestStation(position: readonly [number, number]) {
  return DWD_STATIONS.reduce((nearest, station) =>
    distanceSquared(position, station.position) < distanceSquared(position, nearest.position)
      ? station
      : nearest,
  );
}

function nearestObservation(
  stationId: string,
  observations: readonly DwdObservation[],
): DwdObservation | null {
  return observations.find((observation) => observation.stationId === stationId) ?? null;
}

function distanceSquared(
  [lonA, latA]: readonly [number, number],
  [lonB, latB]: readonly [number, number],
): number {
  return (lonA - lonB) ** 2 + (latA - latB) ** 2;
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
