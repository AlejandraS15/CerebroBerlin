import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import type { Color, Layer, PickingInfo } from "@deck.gl/core";
import type {
  AirQualityPoint,
  CityDataset,
  District,
  DistrictFeature,
  LayerId,
  TransitStation,
  WeatherPoint,
} from "@/lib/types";
import { weatherCodeLabel } from "@/lib/services/weather";
import { DATA_ELEVATION_M } from "@/lib/mapStyle";

interface BuildArgs {
  data: CityDataset;
  visibility: Record<LayerId, boolean>;
  /** Factor 0-1 derivado de la hora del timeline (intensidad de actividad). */
  activity: number;
  onDistrictClick: (d: District) => void;
  onHover: (info: HoverInfo | null) => void;
}

export interface HoverInfo {
  x: number;
  y: number;
  kind:
    | "district"
    | "transit"
    | "air"
    | "weather"
    | "bike"
    | "hotspot"
    | "infra";
  title: string;
  lines: string[];
}

const MODE_COLOR: Record<TransitStation["mode"], Color> = {
  u: [37, 99, 235], // U-Bahn azul
  s: [22, 163, 74], // S-Bahn verde
  tram: [220, 38, 38],
  bus: [168, 85, 247],
};

/**
 * Eleva un punto a la cota media del terreno. deck.gl centra su cámara en la
 * superficie del relieve, así que a z=0 los datos quedarían bajo el suelo.
 */
function onTerrain([lng, lat]: [number, number]): [number, number, number] {
  return [lng, lat, DATA_ELEVATION_M];
}

/**
 * Rampa de color para densidad demográfica (ámbar → rojo). Semitransparente:
 * el overlay se pinta encima del mapa y no debe tapar los edificios 3D.
 */
function densityColor(density: number): Color {
  const t = Math.min(1, density / 15000);
  const r = Math.round(120 + t * 135);
  const g = Math.round(110 - t * 70);
  const b = Math.round(40 + (1 - t) * 20);
  return [r, g, b, 80];
}

/** Rampa de color por temperatura (azul frío → rojo cálido), -5°C..35°C. */
function temperatureColor(temp: number): Color {
  const t = Math.min(1, Math.max(0, (temp + 5) / 40));
  const r = Math.round(40 + t * 215);
  const g = Math.round(120 - Math.abs(t - 0.5) * 120);
  const b = Math.round(230 - t * 200);
  return [r, g, b, 200];
}

/** Color por severidad de hotspot. */
const SEVERITY_COLOR: Record<number, Color> = {
  1: [250, 204, 21],
  2: [251, 146, 60],
  3: [248, 113, 113],
};

/**
 * Construye el array de capas Deck.gl a partir del dataset, la visibilidad
 * y la actividad temporal. Es una función pura para facilitar pruebas.
 */
export function buildDeckLayers({
  data,
  visibility,
  activity,
  onDistrictClick,
  onHover,
}: BuildArgs): Layer[] {
  const layers: Layer[] = [];

  // ── Demografía: coropletas de distritos (siempre base para clicks) ──
  // Accessor tipado explícitamente para evitar la colisión de la unión
  // `Color | Accessor<Feature, Color>` en los tipos de deck.gl v9.
  const districtFill: (f: DistrictFeature) => Color = (f) =>
    densityColor(f.properties.density);

  layers.push(
    new GeoJsonLayer({
      id: "districts",
      data: data.districts.features as unknown as DistrictFeature[],
      visible: visibility.demographics,
      pickable: true,
      stroked: true,
      filled: true,
      extruded: false,
      getFillColor: districtFill as unknown as Color,
      getLineColor: [34, 211, 238, 180],
      lineWidthMinPixels: 1,
      onClick: (info: PickingInfo) => {
        const p = (info.object as DistrictFeature | undefined)?.properties;
        if (p) onDistrictClick(p);
      },
      onHover: (info: PickingInfo) => {
        const p = (info.object as DistrictFeature | undefined)?.properties;
        if (p) {
          onHover({
            x: info.x,
            y: info.y,
            kind: "district",
            title: p.name,
            lines: [
              `Población: ${p.population.toLocaleString("es")}`,
              `Densidad: ${p.density.toLocaleString("es")} hab/km²`,
              `AQI: ${p.aqi}`,
            ],
          });
        } else onHover(null);
      },
    }),
  );

  // ── Calidad del aire: heatmap ponderado por AQI ──
  layers.push(
    new HeatmapLayer({
      id: "air-heat",
      data: data.air,
      visible: visibility.air,
      getPosition: (d) => onTerrain(d.position),
      getWeight: (d) => d.aqi,
      radiusPixels: 70,
      intensity: 1 + activity,
      threshold: 0.05,
      colorRange: [
        [74, 222, 128],
        [163, 230, 53],
        [250, 204, 21],
        [251, 146, 60],
        [248, 113, 113],
        [220, 38, 38],
      ],
    }),
  );

  // Puntos de sensores de aire (pickables) para mostrar el detalle al pasar.
  layers.push(
    new ScatterplotLayer({
      id: "air-points",
      data: data.air,
      visible: visibility.air,
      pickable: true,
      radiusMinPixels: 4,
      radiusMaxPixels: 12,
      getPosition: (d) => onTerrain(d.position),
      getRadius: 60,
      getFillColor: [167, 139, 250, 160],
      getLineColor: [255, 255, 255, 180],
      lineWidthMinPixels: 1,
      stroked: true,
      onHover: (info) => {
        const d = info.object as AirQualityPoint | undefined;
        if (d) {
          onHover({
            x: info.x,
            y: info.y,
            kind: "air",
            title: d.location,
            lines: [
              `AQI (EU): ${d.aqi}`,
              `PM2.5: ${d.pm25} µg/m³`,
              `NO₂: ${d.no2} µg/m³`,
              `O₃: ${d.o3} µg/m³`,
            ],
          });
        } else onHover(null);
      },
    }),
  );

  // ── Movilidad: estaciones de transporte + micromovilidad ──
  layers.push(
    new ScatterplotLayer({
      id: "transit",
      data: data.transit,
      visible: visibility.mobility,
      pickable: true,
      radiusMinPixels: 4,
      radiusMaxPixels: 14,
      getPosition: (d: TransitStation) => onTerrain(d.position),
      getRadius: 90,
      getFillColor: (d: TransitStation) => MODE_COLOR[d.mode],
      getLineColor: [255, 255, 255, 200],
      lineWidthMinPixels: 1,
      stroked: true,
      onHover: (info) => {
        const d = info.object as TransitStation | undefined;
        if (d) {
          const dep = (d.departures ?? []).slice(0, 3).map((x) => {
            const delay =
              x.delayMin != null && x.delayMin !== 0
                ? ` (${x.delayMin > 0 ? "+" : ""}${x.delayMin}′)`
                : "";
            return `${x.line} → ${x.direction}${delay}`;
          });
          onHover({
            x: info.x,
            y: info.y,
            kind: "transit",
            title: d.name,
            lines: [
              `${d.mode.toUpperCase()}-Bahn`,
              d.lines.length ? `Líneas: ${d.lines.join(", ")}` : "—",
              ...(dep.length ? ["Próximas salidas:", ...dep] : []),
            ],
          });
        } else onHover(null);
      },
    }),
  );

  layers.push(
    new ScatterplotLayer({
      id: "bikes",
      data: data.bikes,
      visible: visibility.mobility,
      pickable: true,
      radiusMinPixels: 2,
      radiusMaxPixels: 8,
      getPosition: (d) => onTerrain(d.position),
      getRadius: 45,
      getFillColor: [34, 211, 238, 200],
      onHover: (info) => {
        const d = info.object as { name: string; bikesAvailable: number } | undefined;
        if (d) {
          onHover({
            x: info.x,
            y: info.y,
            kind: "bike",
            title: d.name,
            lines: [`Bicis disponibles: ${d.bikesAvailable}`],
          });
        } else onHover(null);
      },
    }),
  );

  // ── Infraestructura ──
  layers.push(
    new ScatterplotLayer({
      id: "infra",
      data: data.infrastructure,
      visible: visibility.infrastructure,
      pickable: true,
      radiusMinPixels: 3,
      radiusMaxPixels: 10,
      getPosition: (d) => onTerrain(d.position),
      getRadius: 70,
      getFillColor: [52, 211, 153, 210],
      onHover: (info) => {
        const d = info.object as { name: string; category: string } | undefined;
        if (d) {
          onHover({
            x: info.x,
            y: info.y,
            kind: "infra",
            title: d.name,
            lines: [`Categoría: ${d.category}`],
          });
        } else onHover(null);
      },
    }),
  );

  // ── Puntos críticos: marcadores con severidad ──
  layers.push(
    new ScatterplotLayer({
      id: "hotspots",
      data: data.hotspots,
      visible: visibility.hotspots,
      pickable: true,
      radiusMinPixels: 6,
      radiusMaxPixels: 22,
      getPosition: (d) => onTerrain(d.position),
      getRadius: (d) => 140 + d.severity * 120 * (0.6 + activity),
      getFillColor: (d) => {
        const [r, g, b] = SEVERITY_COLOR[d.severity];
        return [r, g, b, 170] as Color;
      },
      getLineColor: [255, 255, 255, 220],
      lineWidthMinPixels: 1,
      stroked: true,
      onHover: (info) => {
        const d = info.object as
          | { title: string; district: string; type: string; severity: number }
          | undefined;
        if (d) {
          onHover({
            x: info.x,
            y: info.y,
            kind: "hotspot",
            title: d.title,
            lines: [
              `Tipo: ${d.type}`,
              `Distrito: ${d.district}`,
              `Severidad: ${"●".repeat(d.severity)}`,
            ],
          });
        } else onHover(null);
      },
    }),
  );

  // ── Clima: puntos por distrito coloreados por temperatura ──
  layers.push(
    new ScatterplotLayer({
      id: "weather",
      data: data.weather,
      visible: visibility.weather,
      pickable: true,
      radiusMinPixels: 6,
      radiusMaxPixels: 20,
      getPosition: (d) => onTerrain(d.position),
      getRadius: 200,
      getFillColor: (d) => temperatureColor(d.temperature),
      getLineColor: [255, 255, 255, 160],
      lineWidthMinPixels: 1,
      stroked: true,
      onHover: (info) => {
        const d = info.object as WeatherPoint | undefined;
        if (d) {
          onHover({
            x: info.x,
            y: info.y,
            kind: "weather",
            title: d.location,
            lines: [
              weatherCodeLabel(d.weatherCode),
              `Temperatura: ${d.temperature} °C`,
              `Humedad: ${d.humidity} %`,
              `Viento: ${d.windSpeed} km/h`,
            ],
          });
        } else onHover(null);
      },
    }),
  );

  return layers;
}
