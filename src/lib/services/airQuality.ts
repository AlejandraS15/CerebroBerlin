import { CONFIG, BERLIN_BBOX } from "@/lib/config";
import { safeFetchJson } from "@/lib/http";
import type { AirQualityPoint } from "@/lib/types";
import { MOCK_AIR } from "@/data/mock";

// Estructura parcial de la respuesta de OpenAQ v3 /locations.
interface OpenAqLocation {
  id: number;
  name: string;
  coordinates?: { latitude: number; longitude: number };
  sensors?: { parameter?: { name?: string }; }[];
  measurements?: { parameter: string; value: number }[];
}
interface OpenAqResponse {
  results?: OpenAqLocation[];
}

/**
 * Convierte PM2.5 (µg/m³) a un AQI aproximado (escala EPA simplificada).
 */
export function pm25ToAqi(pm25: number): number {
  const bp = [
    [0, 12, 0, 50],
    [12.1, 35.4, 51, 100],
    [35.5, 55.4, 101, 150],
    [55.5, 150.4, 151, 200],
    [150.5, 250.4, 201, 300],
    [250.5, 500.4, 301, 500],
  ];
  for (const [cLo, cHi, aLo, aHi] of bp) {
    if (pm25 >= cLo && pm25 <= cHi) {
      return Math.round(((aHi - aLo) / (cHi - cLo)) * (pm25 - cLo) + aLo);
    }
  }
  return 500;
}

/**
 * Calidad del aire desde OpenAQ para el bbox de Berlín, con fallback a mock.
 */
export async function fetchAirQuality(): Promise<{
  data: AirQualityPoint[];
  source: "live" | "mock";
}> {
  if (CONFIG.useMockData) return { data: MOCK_AIR, source: "mock" };

  const bbox = `${BERLIN_BBOX.west},${BERLIN_BBOX.south},${BERLIN_BBOX.east},${BERLIN_BBOX.north}`;
  const url = `${CONFIG.openaqApiBase}/locations?bbox=${bbox}&limit=40`;
  const headers: Record<string, string> = {};
  if (process.env.OPENAQ_API_KEY) headers["X-API-Key"] = process.env.OPENAQ_API_KEY;

  const raw = await safeFetchJson<OpenAqResponse>(url, { headers });
  const results = raw?.results ?? [];
  if (results.length === 0) return { data: MOCK_AIR, source: "mock" };

  const data: AirQualityPoint[] = results
    .filter((r) => r.coordinates)
    .map((r) => {
      const pm25 =
        r.measurements?.find((m) => m.parameter === "pm25")?.value ?? 10;
      const no2 =
        r.measurements?.find((m) => m.parameter === "no2")?.value ?? 20;
      return {
        id: String(r.id),
        location: r.name,
        position: [r.coordinates!.longitude, r.coordinates!.latitude] as [number, number],
        pm25: Math.round(pm25),
        no2: Math.round(no2),
        aqi: pm25ToAqi(pm25),
        updatedAt: new Date().toISOString(),
      };
    });

  return data.length > 0
    ? { data, source: "live" }
    : { data: MOCK_AIR, source: "mock" };
}
