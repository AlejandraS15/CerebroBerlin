/**
 * Analítica del tablero: KPIs y series derivadas del `CityDataset`, siempre con
 * procedencia. Función pura `buildAnalytics(data, hour)` (la envuelve
 * `useAnalytics`). No fabrica cifras: cada KPI sale de una fuente o del lago, y
 * un valor ausente se muestra como "sin datos" (14.x, 17.3).
 */

import type {
  AirQualityPoint,
  CityDataset,
  DistrictCode,
  Kpi,
  Origin,
  ProvenanceRef,
} from "@/lib/types";
import { eaqiBand, type EaqiBand } from "@/lib/eaqi";
import { abbreviate, formatNullable, NO_DATA } from "@/lib/format";

/** Barra del gráfico "AQI por distrito". */
export interface DistrictAqiBar {
  code: DistrictCode;
  name: string;
  /** EAQI del modelo CAMS por distrito; `null` → "sin datos". */
  aqi: number | null;
  band: EaqiBand | null;
  /** Origen del punto de aire del distrito (decide la insignia "simulado"). */
  origin: Origin;
  /** Siempre true: todo valor EAQI lleva su Control_de_Definición_EAQI. */
  eaqi: true;
}

export interface Analytics {
  kpis: Kpi[];
  totalPopulation: number;
  /** EAQI medio de los distritos con dato; `null` si ninguno. */
  avgAqi: number | null;
  /** Nº de distritos con EAQI (independiente del valor medio). */
  aqiAvailable: number;
  totalBikes: number;
  transitCount: number;
  avgTemperature: number | null;
  avgWind: number | null;
  modeSplit: { name: string; value: number }[];
  aqiByDistrict: DistrictAqiBar[];
  densityByDistrict: { name: string; density: number }[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Nombre corto del distrito (antes del primer guion). */
function shortName(name: string): string {
  return name.split("-")[0];
}

/** Barras "AQI por distrito": EAQI del punto de aire por Código_de_Distrito. */
export function districtAqiBars(data: CityDataset): DistrictAqiBar[] {
  const airByCode = new Map<DistrictCode, AirQualityPoint>();
  for (const p of data.air) {
    if (p.districtCode) airByCode.set(p.districtCode, p);
  }
  return data.districts.features.map((f) => {
    const d = f.properties;
    const air = airByCode.get(d.id);
    const aqi = air?.aqi ?? null;
    return {
      code: d.id,
      name: shortName(d.name),
      aqi,
      band: eaqiBand(aqi),
      origin: air?.origin ?? "live",
      eaqi: true,
    };
  });
}

const MODE_LABELS: Record<string, string> = {
  u: "U-Bahn",
  s: "S-Bahn",
  tram: "Tranvía",
  bus: "Bus",
};

/** Deriva KPIs y series del dataset para la hora seleccionada. */
export function buildAnalytics(
  data: CityDataset | undefined,
  hour: number,
): Analytics | null {
  if (!data) return null;

  const districts = data.districts.features.map((f) => f.properties);
  const totalPopulation = districts.reduce((s, d) => s + d.population, 0);

  // EAQI medio: solo distritos con dato (!= null; 0 es válido).
  const aqis = data.air.map((p) => p.aqi).filter((v): v is number => v != null);
  const aqiAvailable = aqis.length;
  const avgAqi = aqiAvailable > 0 ? Math.round(aqis.reduce((s, v) => s + v, 0) / aqiAvailable) : null;
  const airOrigin: Origin = data.source.air;

  const totalBikes = data.bikes.reduce((s, b) => s + b.bikesAvailable, 0);
  const transitCount = data.transit.length;

  const weather = data.weather;
  const avgTemperature =
    weather.length > 0 ? round1(weather.reduce((s, w) => s + w.temperature, 0) / weather.length) : null;
  const avgWind =
    weather.length > 0 ? round1(weather.reduce((s, w) => s + w.windSpeed, 0) / weather.length) : null;

  const point = data.timeSeries.find((t) => t.hour === hour) ?? data.timeSeries[0];
  const traffic = point?.traffic ?? null;

  const modeCounts = data.transit.reduce<Record<string, number>>((acc, t) => {
    acc[t.mode] = (acc[t.mode] ?? 0) + 1;
    return acc;
  }, {});
  const modeSplit = Object.entries(modeCounts).map(([k, v]) => ({
    name: MODE_LABELS[k] ?? k,
    value: v,
  }));

  const aqiByDistrict = districtAqiBars(data);

  const densityByDistrict = districts
    .map((d) => ({ name: shortName(d.name), density: d.density }))
    .sort((a, b) => b.density - a.density)
    .slice(0, 8);

  const prov = (
    metric: ProvenanceRef["metric"],
    origin: Origin,
    extra: Partial<ProvenanceRef> = {},
  ): ProvenanceRef => ({ metric, origin, ...extra });

  const kpis: Kpi[] = [
    {
      id: "population",
      label: "Población total",
      value: abbreviate(totalPopulation),
      vigencia: data.lake.probado.poblacion,
      note: `censo residencial ${data.lake.probado.poblacion.slice(0, 4)}`,
      origin: "snapshot",
      provenance: prov("population", "snapshot", {
        vigencia: data.lake.probado.poblacion,
        probado: data.lake.probado.poblacion,
      }),
      tone: "neutral",
    },
    {
      id: "traffic",
      label: "Tráfico a esta hora",
      value: formatNullable(traffic, { digits: 0 }),
      unit: " veh/h",
      note: "perfil típico de junio de 2025",
      vigencia: "2025-06",
      origin: "snapshot",
      provenance: prov("traffic", "snapshot", { vigencia: "2025-06", scope: `${hour}:00` }),
      tone: "neutral",
    },
    {
      id: "aqi",
      label: "EAQI medio",
      value: avgAqi != null ? String(avgAqi) : NO_DATA,
      note: `${aqiAvailable} de 12 distritos · modelo CAMS`,
      origin: airOrigin,
      provenance: prov("aqiModel", airOrigin, { fetchedAt: data.fetchedAt.air ?? undefined }),
      eaqi: true,
      available: aqiAvailable,
      tone:
        avgAqi == null
          ? "neutral"
          : avgAqi < 40
            ? "good"
            : avgAqi < 60
              ? "warn"
              : "bad",
    },
    {
      id: "bikes",
      label: "Bicis disponibles",
      value: abbreviate(totalBikes),
      note: data.source.bikes === "live" ? "en vivo · nextbike GBFS" : undefined,
      origin: data.source.bikes,
      provenance: prov("bikes", data.source.bikes, { fetchedAt: data.fetchedAt.bikes ?? undefined }),
      tone: "good",
    },
    {
      id: "temperature",
      label: "Temperatura media",
      value: formatNullable(avgTemperature),
      unit: " °C",
      note: avgWind != null ? `Viento ${avgWind} km/h` : undefined,
      origin: weather.length > 0 ? data.source.weather : "mock",
      provenance: prov("temperature", data.source.weather, {
        fetchedAt: data.fetchedAt.weather ?? undefined,
      }),
      tone:
        avgTemperature == null
          ? "neutral"
          : avgTemperature < 0 || avgTemperature > 30
            ? "warn"
            : "good",
    },
  ];

  return {
    kpis,
    totalPopulation,
    avgAqi,
    aqiAvailable,
    totalBikes,
    transitCount,
    avgTemperature,
    avgWind,
    modeSplit,
    aqiByDistrict,
    densityByDistrict,
  };
}
