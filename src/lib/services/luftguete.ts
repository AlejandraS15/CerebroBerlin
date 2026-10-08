/**
 * Estaciones de medición del Berliner Luftgütemessnetz
 * (`https://luftdaten.berlin.de/api`, SenMVKU, dl-de-by-2.0).
 *
 * Flujo (12.1–12.7):
 * - `GET /api/stations`: se conservan solo las estaciones con `active === true`
 *   y coordenadas convertibles a número finito; el resto se descarta (12.7).
 * - `GET /api/components/{pm2_1h|pm10_1h|no2_1h|o3_1h}/data?stationgroup=all&timespan=currentday`:
 *   se toma el último valor horario por estación de cada contaminante.
 * - `mergeStations` combina ambos y calcula el EAQI con el Módulo_EAQI sobre
 *   los contaminantes disponibles; cada estación lleva `origin: "live"`.
 * - Sin estaciones activas o si `/api/stations` falla → `MOCK_AIR_STATIONS`
 *   con origen de bloque `mock`. Si falla un componente, ese contaminante
 *   queda `null` en todas las estaciones.
 *
 * Nombres de campo fijados contra fixtures reales en
 * `src/lib/services/__fixtures__/` (capturados el 2026-10-08):
 * - estación: `name`, `code`, `lat`, `lng` (texto), `active`, `stationgroups`.
 * - dato de componente: `{ datetime, station, component, value }`.
 */

import { CONFIG } from "@/lib/config";
import { safeFetchJson } from "@/lib/http";
import { eaqi } from "@/lib/eaqi";
import type { AirStation, SourceBlock } from "@/lib/types";
import { MOCK_AIR_STATIONS } from "@/data/mock";

/** Contaminante EAQI → código de componente horario de la API. */
export const LUFTGUETE_COMPONENTS = {
  pm25: "pm2_1h",
  pm10: "pm10_1h",
  no2: "no2_1h",
  o3: "o3_1h",
} as const;

export type LuftguetePollutant = keyof typeof LUFTGUETE_COMPONENTS;

/** Metadatos de estación ya validados (coordenadas finitas). */
export interface StationMeta {
  code: string;
  name: string;
  stationGroup: string;
  position: [number, number];
}

/** Último valor horario de un componente para una estación. */
export interface LatestMeasure {
  value: number;
  at: string;
}

/** Convierte un texto a número finito con `Number` (no `parseFloat`). */
function toFiniteNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Parsea `/api/stations`: conserva solo las estaciones `active === true` cuyas
 * coordenadas `lat`/`lng` (texto) se convierten a número finito; si cualquiera
 * de las dos no es finita (`""`, `"abc"`, `"NaN"`, `"Infinity"`, `"52.5abc"`,
 * `null`), la estación se descarta y no llega al dataset (12.7).
 */
export function parseStations(raw: unknown): StationMeta[] {
  if (!Array.isArray(raw)) return [];
  const out: StationMeta[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    const rec = s as Record<string, unknown>;
    if (rec.active !== true) continue;
    const code = typeof rec.code === "string" ? rec.code : null;
    if (!code) continue;
    const lat = toFiniteNumber(rec.lat);
    const lng = toFiniteNumber(rec.lng);
    if (lat === null || lng === null) continue;
    const groups = Array.isArray(rec.stationgroups) ? rec.stationgroups : [];
    const stationGroup = typeof groups[0] === "string" ? groups[0] : "";
    out.push({
      code,
      name: typeof rec.name === "string" ? rec.name : code,
      stationGroup,
      position: [lng, lat],
    });
  }
  return out;
}

/**
 * Último valor por estación de una respuesta de `/api/components/.../data`.
 * Tolerante: ignora registros sin estación, sin fecha o sin valor numérico.
 * "Último" = el registro con `datetime` más reciente de cada estación.
 */
export function latestByStation(raw: unknown): Map<string, LatestMeasure> {
  const out = new Map<string, LatestMeasure>();
  if (!Array.isArray(raw)) return out;
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const station = typeof rec.station === "string" ? rec.station : null;
    const at = typeof rec.datetime === "string" ? rec.datetime : null;
    const value = typeof rec.value === "number" && Number.isFinite(rec.value) ? rec.value : null;
    if (!station || !at || value === null) continue;
    const prev = out.get(station);
    if (!prev || at > prev.at) {
      out.set(station, { value, at });
    }
  }
  return out;
}

/**
 * Combina metadatos y mediciones por contaminante en `AirStation[]`, con el
 * EAQI calculado sobre los contaminantes disponibles y `origin: "live"`.
 */
export function mergeStations(
  meta: readonly StationMeta[],
  perComponent: Record<LuftguetePollutant, Map<string, LatestMeasure>>,
): AirStation[] {
  return meta.map((m) => {
    const read = (p: LuftguetePollutant): { value: number | null; at: string | null } => {
      const found = perComponent[p].get(m.code);
      return found ? { value: found.value, at: found.at } : { value: null, at: null };
    };
    const pm25 = read("pm25");
    const pm10 = read("pm10");
    const no2 = read("no2");
    const o3 = read("o3");
    // Hora de medición: la más reciente de los contaminantes disponibles.
    const measuredAt = [pm25.at, pm10.at, no2.at, o3.at]
      .filter((a): a is string => a !== null)
      .sort()
      .pop() ?? null;
    return {
      code: m.code,
      name: m.name,
      stationGroup: m.stationGroup,
      position: m.position,
      pm25: pm25.value,
      pm10: pm10.value,
      no2: no2.value,
      o3: o3.value,
      measuredAt,
      aqi: eaqi({ pm25: pm25.value, pm10: pm10.value, no2: no2.value, o3: o3.value }),
      origin: "live",
    };
  });
}

/** URL del listado de estaciones. */
function stationsUrl(): string {
  return `${CONFIG.luftgueteApiBase}/api/stations`;
}

/** URL del dato horario de un componente (todas las estaciones, día actual). */
function componentUrl(code: string): string {
  return `${CONFIG.luftgueteApiBase}/api/components/${code}/data?stationgroup=all&timespan=currentday`;
}

/**
 * Estaciones de calidad del aire medidas. Si no hay estaciones activas o la
 * llamada a `/api/stations` falla, degrada a `MOCK_AIR_STATIONS` (`mock`); si
 * falla un componente concreto, ese contaminante queda `null` en todas las
 * estaciones.
 */
export async function fetchAirStations(): Promise<SourceBlock<AirStation[]>> {
  if (CONFIG.useMockData) {
    return { data: MOCK_AIR_STATIONS, origin: "mock", fetchedAt: null };
  }

  const fetchedAt = new Date().toISOString();
  const rawStations = await safeFetchJson<unknown>(stationsUrl());
  const meta = parseStations(rawStations);
  if (meta.length === 0) {
    return { data: MOCK_AIR_STATIONS, origin: "mock", fetchedAt: null };
  }

  const pollutants = Object.keys(LUFTGUETE_COMPONENTS) as LuftguetePollutant[];
  const maps = await Promise.all(
    pollutants.map(async (p) => {
      const raw = await safeFetchJson<unknown>(componentUrl(LUFTGUETE_COMPONENTS[p]));
      // Componente caído → mapa vacío → ese contaminante queda null.
      return [p, latestByStation(raw)] as const;
    }),
  );
  const perComponent = Object.fromEntries(maps) as Record<
    LuftguetePollutant,
    Map<string, LatestMeasure>
  >;

  return { data: mergeStations(meta, perComponent), origin: "live", fetchedAt };
}
