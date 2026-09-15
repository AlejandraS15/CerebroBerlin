import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import type { Layer, PickingInfo } from "@deck.gl/core";
import type {
  CityDataset,
  District,
  DistrictFeature,
  LayerId,
  TransitStation,
} from "@/lib/types";

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
  kind: "district" | "transit" | "air" | "bike" | "hotspot" | "infra";
  title: string;
  lines: string[];
}

const MODE_COLOR: Record<TransitStation["mode"], [number, number, number]> = {
  u: [37, 99, 235], // U-Bahn azul
  s: [22, 163, 74], // S-Bahn verde
  tram: [220, 38, 38],
  bus: [168, 85, 247],
};

/** Rampa de color para densidad demográfica (ámbar → rojo). */
function densityColor(density: number): [number, number, number, number] {
  const t = Math.min(1, density / 15000);
  const r = Math.round(120 + t * 135);
  const g = Math.round(110 - t * 70);
  const b = Math.round(40 + (1 - t) * 20);
  return [r, g, b, 150];
}

/** Color por severidad de hotspot. */
const SEVERITY_COLOR: Record<number, [number, number, number]> = {
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
  layers.push(
    new GeoJsonLayer({
      id: "districts",
      data: data.districts.features,
      visible: visibility.demographics,
      pickable: true,
      stroked: true,
      filled: true,
      extruded: false,
      getFillColor: (f: DistrictFeature) => densityColor(f.properties.density),
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
      getPosition: (d) => d.position,
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

  // ── Movilidad: estaciones de transporte + micromovilidad ──
  layers.push(
    new ScatterplotLayer({
      id: "transit",
      data: data.transit,
      visible: visibility.mobility,
      pickable: true,
      radiusMinPixels: 4,
      radiusMaxPixels: 14,
      getPosition: (d) => d.position,
      getRadius: 90,
      getFillColor: (d) => MODE_COLOR[d.mode],
      getLineColor: [255, 255, 255, 200],
      lineWidthMinPixels: 1,
      stroked: true,
      onHover: (info) => {
        const d = info.object as TransitStation | undefined;
        if (d) {
          onHover({
            x: info.x,
            y: info.y,
            kind: "transit",
            title: d.name,
            lines: [
              `${d.mode.toUpperCase()}-Bahn`,
              d.lines.length ? `Líneas: ${d.lines.join(", ")}` : "—",
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
      getPosition: (d) => d.position,
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
      getPosition: (d) => d.position,
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
      getPosition: (d) => d.position,
      getRadius: (d) => 140 + d.severity * 120 * (0.6 + activity),
      getFillColor: (d) => [...SEVERITY_COLOR[d.severity], 170] as [number, number, number, number],
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

  return layers;
}
