import type {
  AirQualityPoint,
  BikeStation,
  Hotspot,
  InfrastructurePoint,
  TimeSeriesPoint,
  TransitStation,
} from "@/lib/types";
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
// ─────────────────────────────────────────────────────────────
export const MOCK_BIKES: BikeStation[] = DISTRICT_LIST.flatMap((d, di) =>
  Array.from({ length: 3 }).map((_, i) => {
    const seed = di * 7 + i * 3;
    return {
      id: `bike-${d.id}-${i}`,
      name: `Station ${d.name} #${i + 1}`,
      position: [
        d.centroid[0] + (Math.sin(seed) * 0.02),
        d.centroid[1] + (Math.cos(seed) * 0.015),
      ] as [number, number],
      bikesAvailable: 2 + ((seed * 3) % 18),
      docksAvailable: 1 + ((seed * 5) % 12),
    };
  }),
);

// ─────────────────────────────────────────────────────────────
// Sensores de calidad del aire
// ─────────────────────────────────────────────────────────────
export const MOCK_AIR: AirQualityPoint[] = DISTRICT_LIST.map((d, i) => {
  const pm25 = Math.round(6 + (d.aqi / 3) + (i % 4) * 2);
  const no2 = Math.round(10 + (d.aqi / 2) + (i % 3) * 4);
  return {
    id: `air-${d.id}`,
    location: `Sensor ${d.name}`,
    position: d.centroid,
    pm25,
    no2,
    aqi: d.aqi,
    updatedAt: new Date().toISOString(),
  };
});

// ─────────────────────────────────────────────────────────────
// Puntos críticos / incidencias
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
  position: [d.centroid[0] + 0.01 * ((i % 3) - 1), d.centroid[1] + 0.008 * ((i % 2) - 0.5)],
  severity: ((i % 3) + 1) as 1 | 2 | 3,
  reportedAt: new Date(Date.now() - i * 3600_000).toISOString(),
}));

// ─────────────────────────────────────────────────────────────
// Infraestructura
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
      d.centroid[0] + (ci - 1) * 0.012,
      d.centroid[1] + (ci - 1) * 0.01,
    ] as [number, number],
  })),
);

// ─────────────────────────────────────────────────────────────
// Serie temporal 24h (patrón realista de ciudad)
// ─────────────────────────────────────────────────────────────
export function buildTimeSeries(): TimeSeriesPoint[] {
  return Array.from({ length: 24 }).map((_, hour) => {
    // Dos picos de movilidad (mañana y tarde).
    const rush =
      Math.exp(-((hour - 8) ** 2) / 6) + Math.exp(-((hour - 18) ** 2) / 6);
    const mobilityIndex = Math.round(25 + rush * 60);
    const aqi = Math.round(40 + rush * 35 + (hour >= 0 && hour <= 5 ? -8 : 0));
    const bikeUsage = Math.round(
      200 + rush * 1400 + (hour >= 11 && hour <= 15 ? 300 : 0),
    );
    const energyDemand = Math.round(
      850 + Math.sin(((hour - 6) / 24) * Math.PI * 2) * 220 + rush * 120,
    );
    return {
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      mobilityIndex,
      aqi,
      bikeUsage,
      energyDemand,
    };
  });
}

export const MOCK_TIMESERIES = buildTimeSeries();
