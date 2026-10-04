import { CONFIG } from "@/lib/config";
import { safeFetchJson } from "@/lib/http";
import type { AirQualityPoint } from "@/lib/types";
import { MOCK_AIR } from "@/data/mock";
import { DISTRICT_LIST } from "@/data/districts";

// Respuesta parcial de Open-Meteo Air Quality (/air-quality con current=...).
interface OpenMeteoAir {
  current?: {
    pm2_5?: number;
    nitrogen_dioxide?: number;
    ozone?: number;
    european_aqi?: number;
  };
}

/**
 * Convierte PM2.5 (µg/m³) a un AQI aproximado (escala EPA simplificada).
 * Se mantiene como utilidad de respaldo cuando la API no entrega AQI europeo.
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

/** Construye la URL de Open-Meteo Air Quality para una coordenada. */
export function buildAirQualityUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "pm2_5,nitrogen_dioxide,ozone,european_aqi",
  });
  return `${CONFIG.airQualityApiBase}/air-quality?${params.toString()}`;
}

/**
 * Calidad del aire real por distrito vía Open-Meteo Air Quality (sin token).
 * Consulta un punto (centroide) por distrito en paralelo. Si todas fallan,
 * degrada a los datos mock. Devuelve PM2.5, NO2, O3 y AQI europeo.
 */
export async function fetchAirQuality(): Promise<{
  data: AirQualityPoint[];
  source: "live" | "mock";
}> {
  if (CONFIG.useMockData) return { data: MOCK_AIR, source: "mock" };

  const results = await Promise.all(
    DISTRICT_LIST.map(async (d) => {
      const [lon, lat] = d.centroid;
      const raw = await safeFetchJson<OpenMeteoAir>(buildAirQualityUrl(lat, lon));
      const c = raw?.current;
      if (!c || c.pm2_5 == null) return null;
      const point: AirQualityPoint = {
        id: `air-${d.id}`,
        location: `Sensor ${d.name}`,
        position: d.centroid,
        pm25: Math.round(c.pm2_5),
        no2: Math.round(c.nitrogen_dioxide ?? 0),
        o3: Math.round(c.ozone ?? 0),
        aqi: Math.round(c.european_aqi ?? pm25ToAqi(c.pm2_5)),
        updatedAt: new Date().toISOString(),
      };
      return point;
    }),
  );

  const data = results.filter((p): p is AirQualityPoint => p !== null);
  return data.length > 0
    ? { data, source: "live" }
    : { data: MOCK_AIR, source: "mock" };
}
