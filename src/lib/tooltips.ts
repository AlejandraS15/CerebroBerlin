/**
 * Contenido de tooltip del mapa (Req. 10.11, 10.12, 11.4, 11.10, 12.3, 12.4,
 * 15.1). `tooltipFor` es una función pura que, dado un `MapTarget`, el dataset
 * y la hora seleccionada, produce el `TooltipContent` que renderizan por igual
 * el tooltip flotante (hover) y la tarjeta fijada.
 *
 * Pura y sin JSX: solo datos. Las marcas (`eaqi`, `origin`, `example`) son
 * datos comprobables; el consumidor coloca el Control_de_Definición_EAQI y la
 * insignia de origen a partir de esas marcas.
 *
 * Un objeto inexistente devuelve `null`.
 */

import type {
  AirQualityPoint,
  AirStation,
  BikeStation,
  CityDataset,
  District,
  Hotspot,
  InfrastructurePoint,
  MapTarget,
  TooltipContent,
  TooltipRow,
  TransitStation,
  WeatherPoint,
} from "@/lib/types";
import { formatNullable, NO_DATA, NO_VALUE } from "@/lib/format";
import { weatherCodeLabel } from "@/lib/services/weather";
import { LAYER_CATALOG } from "@/lib/layers";

/** Etiqueta "perfil típico de junio de 2025" para las cifras de tráfico. */
const TRAFFIC_VIGENCIA = "perfil típico de junio de 2025";

/** `example === true` de una capa (constante por tipo, no por dato). */
function layerIsExample(id: "hotspots" | "infrastructure"): boolean {
  return LAYER_CATALOG.find((l) => l.id === id)?.example === true;
}

/** Distrito por Código_de_Distrito. */
function findDistrict(data: CityDataset, id: string): District | null {
  const f = data.districts.features.find((feat) => feat.properties.id === id);
  return f ? f.properties : null;
}

/** Punto de aire modelado asociado a un distrito por código. */
function airForDistrict(data: CityDataset, code: string): AirQualityPoint | null {
  return data.air.find((a) => a.districtCode === code) ?? null;
}

function districtTooltip(data: CityDataset, id: string): TooltipContent | null {
  const d = findDistrict(data, id);
  if (!d) return null;
  const air = airForDistrict(data, d.id);
  const rows: TooltipRow[] = [
    { label: "Población", value: d.population.toLocaleString("es") },
    { label: "Densidad", value: `${d.density.toLocaleString("es")} hab/km²` },
    { label: "Área", value: `${formatNullable(d.areaKm2)} km²` },
    { label: "% < 18", value: formatNullable(d.pctUnder18, { digits: 1, unit: "%" }) },
    { label: "% 65+", value: formatNullable(d.pct65Plus, { digits: 1, unit: "%" }) },
    { label: "% verde", value: formatNullable(d.greenPct, { digits: 1, unit: "%" }) },
    {
      label: "EAQI",
      // "sin datos" (índice agregado) cuando el punto de aire no tiene valor.
      value: formatNullable(air?.aqi ?? null, { empty: NO_DATA }),
      eaqi: true,
      origin: air?.origin,
    },
  ];
  return { target: { kind: "district", id: d.id }, title: d.name, rows };
}

function airStationTooltip(data: CityDataset, id: string): TooltipContent | null {
  const s: AirStation | undefined = data.airStations.find((x) => x.code === id);
  if (!s) return null;
  const rows: TooltipRow[] = [
    { label: "PM2.5", value: formatNullable(s.pm25, { empty: NO_VALUE, unit: "µg/m³" }) },
    { label: "PM10", value: formatNullable(s.pm10, { empty: NO_VALUE, unit: "µg/m³" }) },
    { label: "NO₂", value: formatNullable(s.no2, { empty: NO_VALUE, unit: "µg/m³" }) },
    { label: "O₃", value: formatNullable(s.o3, { empty: NO_VALUE, unit: "µg/m³" }) },
    { label: "EAQI", value: formatNullable(s.aqi, { empty: NO_DATA }), eaqi: true, origin: s.origin },
    { label: "Medición", value: s.measuredAt ?? NO_VALUE },
    { label: "Grupo", value: s.stationGroup || NO_VALUE },
  ];
  return { target: { kind: "airStation", id: s.code }, title: s.name, rows };
}

/** Punto de aire modelado seleccionado directamente (capa `air`). */
function airTooltip(data: CityDataset, id: string): TooltipContent | null {
  const a = data.air.find((x) => x.id === id);
  if (!a) return null;
  const rows: TooltipRow[] = [
    { label: "PM2.5", value: formatNullable(a.pm25, { empty: NO_VALUE, unit: "µg/m³" }) },
    { label: "PM10", value: formatNullable(a.pm10, { empty: NO_VALUE, unit: "µg/m³" }) },
    { label: "NO₂", value: formatNullable(a.no2, { empty: NO_VALUE, unit: "µg/m³" }) },
    { label: "O₃", value: formatNullable(a.o3, { empty: NO_VALUE, unit: "µg/m³" }) },
    { label: "EAQI", value: formatNullable(a.aqi, { empty: NO_DATA }), eaqi: true, origin: a.origin },
  ];
  return { target: { kind: "air", id: a.id }, title: a.location, rows };
}

function detectorTooltip(data: CityDataset, id: string, hour: number): TooltipContent | null {
  const det = data.trafficDetectors.find((x) => x.id === id);
  if (!det) return null;
  const q = det.qkfz[hour] ?? null;
  const rows: TooltipRow[] = [
    {
      label: `Tráfico ${String(hour).padStart(2, "0")}:00`,
      value: formatNullable(q, { empty: NO_VALUE, digits: 1, unit: "veh/h" }),
    },
    { label: "Vigencia", value: TRAFFIC_VIGENCIA },
  ];
  return { target: { kind: "detector", id: det.id }, title: `Detector ${det.id}`, rows };
}

function transitTooltip(data: CityDataset, id: string): TooltipContent | null {
  const t: TransitStation | undefined = data.transit.find((x) => x.id === id);
  if (!t) return null;
  const rows: TooltipRow[] = [
    { label: "Modo", value: `${t.mode.toUpperCase()}-Bahn` },
    { label: "Líneas", value: t.lines.length ? t.lines.join(", ") : NO_VALUE },
  ];
  const dep = (t.departures ?? []).slice(0, 3);
  for (const x of dep) {
    const delay =
      x.delayMin != null && x.delayMin !== 0
        ? ` (${x.delayMin > 0 ? "+" : ""}${x.delayMin}′)`
        : "";
    rows.push({ label: "Salida", value: `${x.line} → ${x.direction}${delay}` });
  }
  return { target: { kind: "transit", id: t.id }, title: t.name, rows };
}

function bikeTooltip(data: CityDataset, id: string): TooltipContent | null {
  const b: BikeStation | undefined = data.bikes.find((x) => x.id === id);
  if (!b) return null;
  const rows: TooltipRow[] = [
    { label: "Bicis disponibles", value: formatNullable(b.bikesAvailable, { empty: NO_VALUE }) },
    { label: "Anclajes libres", value: formatNullable(b.docksAvailable, { empty: NO_VALUE }) },
  ];
  return { target: { kind: "bike", id: b.id }, title: b.name, rows };
}

function weatherTooltip(data: CityDataset, id: string): TooltipContent | null {
  const w: WeatherPoint | undefined = data.weather.find((x) => x.id === id);
  if (!w) return null;
  const rows: TooltipRow[] = [
    { label: "Tiempo", value: weatherCodeLabel(w.weatherCode) },
    { label: "Temperatura", value: formatNullable(w.temperature, { empty: NO_VALUE, digits: 1, unit: "°C" }) },
    { label: "Humedad", value: formatNullable(w.humidity, { empty: NO_VALUE, unit: "%" }) },
    { label: "Viento", value: formatNullable(w.windSpeed, { empty: NO_VALUE, digits: 1, unit: "km/h" }) },
  ];
  return { target: { kind: "weather", id: w.id }, title: w.location, rows };
}

function hotspotTooltip(data: CityDataset, id: string): TooltipContent | null {
  const h: Hotspot | undefined = data.hotspots.find((x) => x.id === id);
  if (!h) return null;
  const example = layerIsExample("hotspots");
  const rows: TooltipRow[] = [
    { label: "Tipo", value: h.type, example },
    { label: "Distrito", value: h.district, example },
    { label: "Severidad", value: "●".repeat(h.severity), example },
  ];
  return { target: { kind: "hotspot", id: h.id }, title: h.title, rows };
}

function infraTooltip(data: CityDataset, id: string): TooltipContent | null {
  const p: InfrastructurePoint | undefined = data.infrastructure.find((x) => x.id === id);
  if (!p) return null;
  const example = layerIsExample("infrastructure");
  const rows: TooltipRow[] = [{ label: "Categoría", value: p.category, example }];
  return { target: { kind: "infra", id: p.id }, title: p.name, rows };
}

/**
 * Contenido del tooltip para un objeto del mapa. Devuelve `null` si el objeto
 * no existe en el dataset. Compartido por el tooltip flotante y la tarjeta
 * fijada; se recalcula desde `data` y `hour` (no se congela).
 */
export function tooltipFor(
  target: MapTarget,
  data: CityDataset,
  hour: number,
): TooltipContent | null {
  switch (target.kind) {
    case "district":
      return districtTooltip(data, target.id);
    case "airStation":
      return airStationTooltip(data, target.id);
    case "air":
      return airTooltip(data, target.id);
    case "detector":
      return detectorTooltip(data, target.id, hour);
    case "transit":
      return transitTooltip(data, target.id);
    case "bike":
      return bikeTooltip(data, target.id);
    case "weather":
      return weatherTooltip(data, target.id);
    case "hotspot":
      return hotspotTooltip(data, target.id);
    case "infra":
      return infraTooltip(data, target.id);
    default:
      return null;
  }
}
