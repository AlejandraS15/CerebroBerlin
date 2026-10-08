/**
 * Datos simulados (Origen_de_Dato `mock`) usados como respaldo cuando una
 * fuente en vivo no responde, y datos de ejemplo (hotspots, infraestructura)
 * sin fuente oficial.
 *
 * Reglas de esta migración:
 * - Todo mock se posiciona en el Punto_de_Distrito del lago (`d.point`), no en
 *   centroides inventados; `District` ya no expone `centroid`, `aqi` ni
 *   `greenSpacePct`.
 * - `MOCK_AIR` y `MOCK_AIR_STATIONS` calculan su EAQI con el Módulo_EAQI y
 *   marcan cada elemento con `origin: "mock"`.
 * - No existe ninguna serie 24 h fabricada (movilidad, bicis, energía): el
 *   gráfico se construye con `buildTimeSeries(perfil, hourly)` a partir del
 *   lago y de Open-Meteo. Solo queda `MOCK_HOURLY` como respaldo del horario.
 */

import type {
  AirQualityPoint,
  AirStation,
  BikeStation,
  Hotspot,
  HourlyPoint,
  InfrastructurePoint,
  TransitStation,
  WeatherPoint,
} from "@/lib/types";
import { eaqi } from "@/lib/eaqi";
import { DISTRICT_LIST } from "./districts";

// ─────────────────────────────────────────────────────────────
// Estaciones de transporte reales (posiciones aproximadas)
// ─────────────────────────────────────────────────────────────
export const MOCK_TRANSIT: TransitStation[] = [
  { id: "s-hbf", name: "Berlin Hauptbahnhof", mode: "s", lines: ["S3", "S5", "S7", "S9"], position: [13.3694, 52.525] },
  { id: "u-alex", name: "Alexanderplatz", mode: "u", lines: ["U2", "U5", "U8"], position: [13.4132, 52.5219] },
  { id: "s-fried", name: "Friedrichstraße", mode: "s", lines: ["S1", "S2", "S25"], position: [13.3874, 52.5202] },
  { id: "u-zoo", name: "Zoologischer Garten", mode: "u", lines: ["U2", "U9"], position: [13.3327, 52.5069] },
  { id: "u-kotti", name: "Kottbusser Tor", mode: "u", lines: ["U1", "U3", "U8"], position: [13.4181, 52.4992] },
  { id: "u-warsch", name: "Warschauer Straße", mode: "u", lines: ["U1", "U3"], position: [13.4491, 52.5052] },
  { id: "s-ostkreuz", name: "Ostkreuz", mode: "s", lines: ["S3", "S5", "S7", "S41", "S42"], position: [13.4692, 52.5031] },
  { id: "s-westkreuz", name: "Westkreuz", mode: "s", lines: ["S3", "S5", "S9", "S41"], position: [13.2856, 52.5008] },
  { id: "u-pankow", name: "Pankow", mode: "u", lines: ["U2"], position: [13.4103, 52.5666] },
  { id: "u-rathaus-sp", name: "Rathaus Spandau", mode: "u", lines: ["U7"], position: [13.2003, 52.5354] },
  { id: "u-hermann", name: "Hermannplatz", mode: "u", lines: ["U7", "U8"], position: [13.4241, 52.4869] },
  { id: "s-sudkreuz", name: "Südkreuz", mode: "s", lines: ["S2", "S25", "S41", "S42"], position: [13.3651, 52.4756] },
  { id: "s-gesund", name: "Gesundbrunnen", mode: "s", lines: ["S1", "S2", "S41", "S42"], position: [13.3886, 52.5487] },
  { id: "u-mehring", name: "Mehringdamm", mode: "u", lines: ["U6", "U7"], position: [13.3877, 52.4935] },
];

// ─────────────────────────────────────────────────────────────
// Estaciones de micromovilidad (bicis compartidas)
// Posicionadas alrededor del Punto_de_Distrito del lago.
// ─────────────────────────────────────────────────────────────
export const MOCK_BIKES: BikeStation[] = DISTRICT_LIST.flatMap((d, di) =>
  Array.from({ length: 3 }).map((_, i) => {
    const seed = di * 7 + i * 3;
    return {
      id: `bike-${d.id}-${i}`,
      name: `Station ${d.name} #${i + 1}`,
      position: [
        d.point[0] + Math.sin(seed) * 0.02,
        d.point[1] + Math.cos(seed) * 0.015,
      ] as [number, number],
      bikesAvailable: 2 + ((seed * 3) % 18),
      docksAvailable: 1 + ((seed * 5) % 12),
    };
  }),
);

// ─────────────────────────────────────────────────────────────
// Calidad del aire modelada (respaldo mock de Open-Meteo)
// Un punto por distrito, posicionado en el Punto_de_Distrito del lago.
// El EAQI se calcula con el Módulo_EAQI a partir de concentraciones
// deterministas; no se deriva de ningún AQI escrito a mano.
// ─────────────────────────────────────────────────────────────
export const MOCK_AIR: AirQualityPoint[] = DISTRICT_LIST.map((d, i) => {
  const pm25 = 8 + (i % 5) * 3;
  const pm10 = 14 + (i % 6) * 4;
  const no2 = 12 + (i % 4) * 6;
  const o3 = 44 + (i % 5) * 10;
  return {
    id: `air-${d.id}`,
    districtCode: d.id,
    location: `Modelo ${d.name}`,
    position: d.point,
    pm25,
    pm10,
    no2,
    o3,
    aqi: eaqi({ pm25, pm10, no2, o3 }),
    updatedAt: null,
    origin: "mock",
  };
});

// ─────────────────────────────────────────────────────────────
// Estaciones de medición Luftgüte (respaldo mock)
// Unas pocas estaciones representativas, origen "mock".
// ─────────────────────────────────────────────────────────────
const MOCK_STATION_SEEDS: { code: string; name: string; group: string; position: [number, number] }[] = [
  { code: "mc010", name: "010 Wedding", group: "background", position: [13.34926, 52.54291] },
  { code: "mc042", name: "042 Neukölln", group: "traffic", position: [13.4305, 52.4892] },
  { code: "mc117", name: "117 Schildhornstraße", group: "traffic", position: [13.3155, 52.4634] },
  { code: "mc124", name: "124 Mariendorfer Damm", group: "traffic", position: [13.3878, 52.4381] },
  { code: "mc174", name: "174 Frankfurter Allee", group: "traffic", position: [13.4756, 52.5146] },
];

export const MOCK_AIR_STATIONS: AirStation[] = MOCK_STATION_SEEDS.map((s, i) => {
  const pm25 = 10 + (i % 4) * 3;
  const pm10 = 18 + (i % 5) * 5;
  const no2 = 20 + (i % 4) * 8;
  const o3 = 40 + (i % 3) * 12;
  return {
    code: s.code,
    name: s.name,
    stationGroup: s.group,
    position: s.position,
    pm25,
    pm10,
    no2,
    o3,
    measuredAt: null,
    aqi: eaqi({ pm25, pm10, no2, o3 }),
    origin: "mock",
  };
});

// ─────────────────────────────────────────────────────────────
// Clima por distrito (fallback offline de Open-Meteo)
// ─────────────────────────────────────────────────────────────
const WEATHER_CODES = [0, 1, 2, 3, 45, 61, 80];
export const MOCK_WEATHER: WeatherPoint[] = DISTRICT_LIST.map((d, i) => {
  const seed = i * 5 + 3;
  return {
    id: `wx-${d.id}`,
    location: d.name,
    position: d.point,
    temperature: Math.round((9 + (seed % 8) - (i % 3)) * 10) / 10,
    humidity: 55 + ((seed * 3) % 35),
    windSpeed: Math.round((6 + (seed % 14)) * 10) / 10,
    weatherCode: WEATHER_CODES[i % WEATHER_CODES.length],
    updatedAt: new Date().toISOString(),
  };
});

// ─────────────────────────────────────────────────────────────
// Horario de 24 h (respaldo mock de Open-Meteo: EAQI y temperatura)
// Sin series de movilidad/bicis/energía fabricadas.
// ─────────────────────────────────────────────────────────────
export const MOCK_HOURLY: HourlyPoint[] = Array.from({ length: 24 }).map((_, hour) => {
  // Dos repuntes diurnos de EAQI (mañana y tarde) sobre un fondo bajo.
  const rush =
    Math.exp(-((hour - 8) ** 2) / 6) + Math.exp(-((hour - 18) ** 2) / 6);
  const aqi = Math.round(28 + rush * 24);
  // Curva diaria de temperatura: mínima ~5h, máxima ~15h.
  const temperature =
    Math.round((11 + Math.sin(((hour - 9) / 24) * Math.PI * 2) * 6) * 10) / 10;
  return { hour, aqi, temperature };
});

// ─────────────────────────────────────────────────────────────
// Puntos críticos / incidencias (datos de ejemplo, sin fuente)
// ─────────────────────────────────────────────────────────────
const HOTSPOT_TYPES: Hotspot["type"][] = ["accidente", "obra", "congestion", "alerta"];
export const MOCK_HOTSPOTS: Hotspot[] = DISTRICT_LIST.slice(0, 9).map((d, i) => ({
  id: `hs-${i}`,
  type: HOTSPOT_TYPES[i % HOTSPOT_TYPES.length],
  title: [
    "Colisión múltiple en cruce",
    "Obra en línea de tranvía",
    "Congestión intensa hora punta",
    "Alerta de calidad del aire",
  ][i % 4],
  district: d.name,
  position: [d.point[0] + 0.01 * ((i % 3) - 1), d.point[1] + 0.008 * ((i % 2) - 0.5)],
  severity: ((i % 3) + 1) as 1 | 2 | 3,
  reportedAt: new Date(Date.now() - i * 3600_000).toISOString(),
}));

// ─────────────────────────────────────────────────────────────
// Infraestructura (datos de ejemplo, sin fuente)
// ─────────────────────────────────────────────────────────────
const INFRA_CATS: InfrastructurePoint["category"][] = [
  "hospital",
  "escuela",
  "cultura",
  "energia",
  "agua",
];
export const MOCK_INFRA: InfrastructurePoint[] = DISTRICT_LIST.flatMap((d, di) =>
  INFRA_CATS.slice(0, 3).map((cat, ci) => ({
    id: `infra-${d.id}-${cat}`,
    category: INFRA_CATS[(di + ci) % INFRA_CATS.length],
    name: `${cat[0].toUpperCase()}${cat.slice(1)} ${d.name}`,
    position: [
      d.point[0] + (ci - 1) * 0.012,
      d.point[1] + (ci - 1) * 0.01,
    ] as [number, number],
  })),
);
