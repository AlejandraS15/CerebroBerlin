/**
 * Calidad del aire modelada por distrito vía Open-Meteo Air Quality (modelo
 * CAMS, sin token). Una consulta por Punto_de_Distrito del lago, asociada al
 * distrito por Código_de_Distrito.
 *
 * - Contaminantes ausentes → `null` (nunca 0): se mostrará "sin dato".
 * - `aqi = european_aqi ?? eaqi({pm25, pm10, no2, o3})` (Módulo_EAQI único).
 * - Si la consulta de un distrito falla, su punto existe con todos los
 *   contaminantes y el EAQI en `null` y `origin: "live"` (no es simulado).
 * - Si fallan los 12 distritos → `MOCK_AIR`, con origen de bloque `mock` y
 *   `origin: "mock"` en cada punto.
 *
 * No se usa ninguna conversión US EPA; `pm25ToAqi` se eliminó.
 */

import { CONFIG } from "@/lib/config";
import { safeFetchJson } from "@/lib/http";
import { eaqi } from "@/lib/eaqi";
import type { AirQualityPoint, District, SourceBlock } from "@/lib/types";
import { MOCK_AIR } from "@/data/mock";
import { DISTRICT_LIST } from "@/data/districts";

// Respuesta parcial de Open-Meteo Air Quality (/air-quality con current=...).
interface OpenMeteoAir {
  current?: {
    pm2_5?: number;
    pm10?: number;
    nitrogen_dioxide?: number;
    ozone?: number;
    european_aqi?: number;
  };
}

/** Construye la URL de Open-Meteo Air Quality para una coordenada. */
export function buildAirQualityUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "european_aqi,pm2_5,pm10,nitrogen_dioxide,ozone",
  });
  return `${CONFIG.airQualityApiBase}/air-quality?${params.toString()}`;
}

/** Normaliza un valor numérico de la respuesta; ausente o no finito → `null`. */
function num(v: number | undefined): number | null {
  return v != null && Number.isFinite(v) ? Math.round(v) : null;
}

/**
 * Calidad del aire real por distrito. Consulta en paralelo el Punto_de_Distrito
 * de cada distrito; cada respuesta se asocia por `districtCode`. Si fallan los
 * 12 distritos, degrada a `MOCK_AIR` con origen de bloque `mock`.
 */
export async function fetchAirQuality(
  districts: readonly District[] = DISTRICT_LIST,
): Promise<SourceBlock<AirQualityPoint[]>> {
  const fetchedAt = new Date().toISOString();

  if (CONFIG.useMockData) {
    return { data: MOCK_AIR, origin: "mock", fetchedAt: null };
  }

  const results = await Promise.all(
    districts.map(async (d): Promise<{ point: AirQualityPoint; ok: boolean }> => {
      const [lon, lat] = d.point;
      const raw = await safeFetchJson<OpenMeteoAir>(buildAirQualityUrl(lat, lon));
      const c = raw?.current;
      const base = {
        id: `air-${d.id}`,
        districtCode: d.id,
        location: `Modelo ${d.name}`,
        position: d.point,
      };
      if (!c) {
        // Distrito fallido: punto con todo en null, origen "live" (no simulado).
        return {
          point: {
            ...base,
            pm25: null,
            pm10: null,
            no2: null,
            o3: null,
            aqi: null,
            updatedAt: null,
            origin: "live",
          },
          ok: false,
        };
      }
      const pm25 = num(c.pm2_5);
      const pm10 = num(c.pm10);
      const no2 = num(c.nitrogen_dioxide);
      const o3 = num(c.ozone);
      const aqi =
        c.european_aqi != null && Number.isFinite(c.european_aqi)
          ? Math.round(c.european_aqi)
          : eaqi({ pm25, pm10, no2, o3 });
      return {
        point: {
          ...base,
          pm25,
          pm10,
          no2,
          o3,
          aqi,
          updatedAt: fetchedAt,
          origin: "live",
        },
        ok: true,
      };
    }),
  );

  const anyOk = results.some((r) => r.ok);
  if (!anyOk) {
    return { data: MOCK_AIR, origin: "mock", fetchedAt: null };
  }

  return { data: results.map((r) => r.point), origin: "live", fetchedAt };
}
