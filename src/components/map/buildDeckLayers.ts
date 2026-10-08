import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import type { Color, Layer, PickingInfo } from "@deck.gl/core";
import type {
  AirQualityPoint,
  AirStation,
  BikeStation,
  CityDataset,
  District,
  DistrictFeature,
  Hotspot,
  InfrastructurePoint,
  LayerId,
  MapTarget,
  TrafficDetector,
  TransitStation,
  WeatherPoint,
} from "@/lib/types";
import { eaqiBand } from "@/lib/eaqi";
import {
  elevateGeometry,
  withElevation,
  type ElevationSampler,
  type PolygonalGeometry,
} from "@/lib/terrain";

interface BuildArgs {
  data: CityDataset;
  visibility: Record<LayerId, boolean>;
  /** Hora del timeline (0-23); modula detectores de tráfico. */
  hour: number;
  /** Muestreador de cotas del terreno; respaldo 0 m sin terreno. */
  sampler: ElevationSampler;
  /** Versión de elevación: dispara el recálculo de `getPosition` en deck.gl. */
  elevationVersion: number;
  onDistrictClick: (d: District) => void;
  /** Emite el objetivo bajo el puntero (`null` al salir). */
  onHover: (target: MapTarget | null) => void;
}

const MODE_COLOR: Record<TransitStation["mode"], Color> = {
  u: [37, 99, 235], // U-Bahn azul
  s: [22, 163, 74], // S-Bahn verde
  tram: [220, 38, 38],
  bus: [168, 85, 247],
};

/** Gris neutro para valores EAQI/tráfico sin dato. */
const GREY: Color = [148, 163, 184, 190];

/** Convierte un color HEX ("#50f0e6") a `Color` RGBA de deck.gl. */
function hexToColor(hex: string, alpha = 200): Color {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha];
}

/** Color por banda EAQI (gris si no hay valor). */
function aqiColor(aqi: number | null): Color {
  const band = eaqiBand(aqi);
  return band ? hexToColor(band.color) : GREY;
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
 * Radio de un detector proporcional a √(qkfz) para que el área crezca con el
 * flujo de vehículos. Radio mínimo (y color gris) cuando la hora no tiene dato.
 */
function detectorRadius(qkfz: number | null): number {
  if (qkfz == null || !Number.isFinite(qkfz)) return 40;
  return 40 + Math.sqrt(Math.max(0, qkfz)) * 22;
}

/**
 * Construye el array de capas Deck.gl a partir del dataset, la visibilidad, la
 * hora y el muestreador de cotas. Función pura (los efectos van en callbacks).
 *
 * Cada capa de puntos eleva su posición con `withElevation(d.position, sampler)`
 * y declara `updateTriggers.getPosition = elevationVersion`, de modo que
 * deck.gl recalcula las posiciones cuando una cota pasa a estar disponible
 * (20.9). Los distritos elevan cada vértice con `elevateGeometry`.
 */
export function buildDeckLayers({
  data,
  visibility,
  hour,
  sampler,
  elevationVersion,
  onDistrictClick,
  onHover,
}: BuildArgs): Layer[] {
  const layers: Layer[] = [];
  const posTrigger = { getPosition: elevationVersion };

  // ── Demografía: coropletas de distritos con vértices elevados ──
  const elevatedFeatures: DistrictFeature[] = data.districts.features.map((f) => ({
    ...f,
    geometry: elevateGeometry(f.geometry as PolygonalGeometry, sampler) as DistrictFeature["geometry"],
  }));
  const districtFill: (f: DistrictFeature) => Color = (f) =>
    densityColor(f.properties.density);

  layers.push(
    new GeoJsonLayer({
      id: "districts",
      data: elevatedFeatures,
      visible: visibility.demographics,
      pickable: true,
      stroked: true,
      filled: true,
      extruded: false,
      getFillColor: districtFill as unknown as Color,
      getLineColor: [34, 211, 238, 180],
      lineWidthMinPixels: 1,
      updateTriggers: { getPosition: elevationVersion },
      onClick: (info: PickingInfo) => {
        const p = (info.object as DistrictFeature | undefined)?.properties;
        if (p) onDistrictClick(p);
      },
      onHover: (info: PickingInfo) => {
        const p = (info.object as DistrictFeature | undefined)?.properties;
        onHover(p ? { kind: "district", id: p.id } : null);
      },
    }),
  );

  // ── Calidad del aire: punto por distrito, color por banda EAQI ──
  layers.push(
    new ScatterplotLayer<AirQualityPoint>({
      id: "air",
      data: data.air,
      visible: visibility.air,
      pickable: true,
      radiusMinPixels: 6,
      radiusMaxPixels: 18,
      getPosition: (d) => withElevation(d.position, sampler),
      getRadius: 220,
      getFillColor: (d) => aqiColor(d.aqi),
      getLineColor: [255, 255, 255, 180],
      lineWidthMinPixels: 1,
      stroked: true,
      updateTriggers: posTrigger,
      onHover: (info) => {
        const d = info.object as AirQualityPoint | undefined;
        onHover(d ? { kind: "air", id: d.id } : null);
      },
    }),
  );

  // ── Estaciones de medición Luftgüte: color por banda EAQI ──
  layers.push(
    new ScatterplotLayer<AirStation>({
      id: "airStations",
      data: data.airStations,
      visible: visibility.airStations,
      pickable: true,
      radiusMinPixels: 5,
      radiusMaxPixels: 14,
      getPosition: (d) => withElevation(d.position, sampler),
      getRadius: 150,
      getFillColor: (d) => aqiColor(d.aqi),
      getLineColor: [15, 23, 42, 220],
      lineWidthMinPixels: 1,
      stroked: true,
      updateTriggers: posTrigger,
      onHover: (info) => {
        const d = info.object as AirStation | undefined;
        onHover(d ? { kind: "airStation", id: d.code } : null);
      },
    }),
  );

  // ── Tráfico: detectores con media horaria (radio ∝ √qkfz[hour]) ──
  layers.push(
    new ScatterplotLayer<TrafficDetector>({
      id: "traffic",
      data: data.trafficDetectors,
      visible: visibility.traffic,
      pickable: true,
      radiusUnits: "pixels",
      radiusMinPixels: 3,
      radiusMaxPixels: 60,
      getPosition: (d) => withElevation(d.position, sampler),
      getRadius: (d) => Math.min(60, detectorRadius(d.qkfz[hour] ?? null) / 6),
      getFillColor: (d) => {
        const q = d.qkfz[hour] ?? null;
        return q == null ? GREY : aqiColorForTraffic(q);
      },
      getLineColor: [15, 23, 42, 200],
      lineWidthMinPixels: 1,
      stroked: true,
      updateTriggers: {
        getPosition: elevationVersion,
        getRadius: hour,
        getFillColor: hour,
      },
      onHover: (info) => {
        const d = info.object as TrafficDetector | undefined;
        onHover(d ? { kind: "detector", id: d.id } : null);
      },
    }),
  );

  // ── Movilidad: estaciones de transporte + micromovilidad ──
  layers.push(
    new ScatterplotLayer<TransitStation>({
      id: "transit",
      data: data.transit,
      visible: visibility.mobility,
      pickable: true,
      radiusMinPixels: 4,
      radiusMaxPixels: 14,
      getPosition: (d) => withElevation(d.position, sampler),
      getRadius: 90,
      getFillColor: (d) => MODE_COLOR[d.mode],
      getLineColor: [255, 255, 255, 200],
      lineWidthMinPixels: 1,
      stroked: true,
      updateTriggers: posTrigger,
      onHover: (info) => {
        const d = info.object as TransitStation | undefined;
        onHover(d ? { kind: "transit", id: d.id } : null);
      },
    }),
  );

  layers.push(
    new ScatterplotLayer<BikeStation>({
      id: "bikes",
      data: data.bikes,
      visible: visibility.mobility,
      pickable: true,
      radiusMinPixels: 2,
      radiusMaxPixels: 8,
      getPosition: (d) => withElevation(d.position, sampler),
      getRadius: 45,
      getFillColor: [34, 211, 238, 200],
      updateTriggers: posTrigger,
      onHover: (info) => {
        const d = info.object as BikeStation | undefined;
        onHover(d ? { kind: "bike", id: d.id } : null);
      },
    }),
  );

  // ── Clima: puntos por distrito coloreados por temperatura ──
  layers.push(
    new ScatterplotLayer<WeatherPoint>({
      id: "weather",
      data: data.weather,
      visible: visibility.weather,
      pickable: true,
      radiusMinPixels: 6,
      radiusMaxPixels: 20,
      getPosition: (d) => withElevation(d.position, sampler),
      getRadius: 200,
      getFillColor: (d) => temperatureColor(d.temperature),
      getLineColor: [255, 255, 255, 160],
      lineWidthMinPixels: 1,
      stroked: true,
      updateTriggers: posTrigger,
      onHover: (info) => {
        const d = info.object as WeatherPoint | undefined;
        onHover(d ? { kind: "weather", id: d.id } : null);
      },
    }),
  );

  // ── Infraestructura (datos de ejemplo): radio por severidad sin hora ──
  layers.push(
    new ScatterplotLayer<InfrastructurePoint>({
      id: "infrastructure",
      data: data.infrastructure,
      visible: visibility.infrastructure,
      pickable: true,
      radiusMinPixels: 3,
      radiusMaxPixels: 10,
      getPosition: (d) => withElevation(d.position, sampler),
      getRadius: 70,
      getFillColor: [52, 211, 153, 210],
      updateTriggers: posTrigger,
      onHover: (info) => {
        const d = info.object as InfrastructurePoint | undefined;
        onHover(d ? { kind: "infra", id: d.id } : null);
      },
    }),
  );

  // ── Puntos críticos (datos de ejemplo): radio por severidad ──
  layers.push(
    new ScatterplotLayer<Hotspot>({
      id: "hotspots",
      data: data.hotspots,
      visible: visibility.hotspots,
      pickable: true,
      radiusMinPixels: 6,
      radiusMaxPixels: 22,
      getPosition: (d) => withElevation(d.position, sampler),
      getRadius: (d) => 140 + d.severity * 160,
      getFillColor: (d) => {
        const [r, g, b] = SEVERITY_COLOR[d.severity];
        return [r, g, b, 170] as Color;
      },
      getLineColor: [255, 255, 255, 220],
      lineWidthMinPixels: 1,
      stroked: true,
      updateTriggers: posTrigger,
      onHover: (info) => {
        const d = info.object as Hotspot | undefined;
        onHover(d ? { kind: "hotspot", id: d.id } : null);
      },
    }),
  );

  return layers;
}

/**
 * Color del detector por intensidad de tráfico (verde → rojo). No es EAQI:
 * se mapea el flujo veh/h a una rampa simple para leer la congestión.
 */
function aqiColorForTraffic(qkfz: number): Color {
  const t = Math.min(1, qkfz / 2000);
  const r = Math.round(74 + t * 174);
  const g = Math.round(222 - t * 150);
  const b = Math.round(90 - t * 50);
  return [r, g, b, 210];
}
