import { GeoJsonLayer, IconLayer, PathLayer, ScatterplotLayer } from "@deck.gl/layers";
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
  MarketPoint,
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
import {
  buildTrafficRoadSegments,
  trafficColor,
  trafficWidth,
  type TrafficRoadSegment,
} from "@/lib/trafficRoads";

interface BuildArgs {
  data: CityDataset;
  visibility: Record<LayerId, boolean>;
  /** Texto opcional para limitar los equipamientos mostrados. */
  infrastructureQuery?: string;
  /** Hora del timeline (0-23); modula detectores de tráfico. */
  hour: number;
  /** Muestreador de cotas del terreno; respaldo 0 m sin terreno. */
  sampler: ElevationSampler;
  /** Versión de elevación: dispara el recálculo de `getPosition` en deck.gl. */
  elevationVersion: number;
  onDistrictClick: (d: District) => void;
  /** Emite el objetivo bajo el puntero (`null` al salir). */
  onHover: (target: MapTarget | null) => void;
  /** Código del distrito en análisis; se resalta con un color distinto. */
  selectedDistrictId?: string | null;
}

/** Relleno del distrito seleccionado (acento cian intenso, semitransparente). */
const SELECTED_DISTRICT_FILL: Color = [34, 211, 238, 150];
/** Borde del distrito seleccionado (cian brillante y más grueso). */
const SELECTED_DISTRICT_LINE: Color = [103, 232, 249, 255];

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

const STOREFRONT_PATH =
  '<path d="M7 5h20l2 7.5a3.5 3.5 0 0 1-2.8 3.43V27H7v-11.07A3.5 3.5 0 0 1 4.2 12.5L7 5Z" fill="#fff"/><path d="M6 5h22l2 7.5a3.5 3.5 0 0 1-7 0 3.5 3.5 0 0 1-7 0 3.5 3.5 0 0 1-7 0A3.5 3.5 0 0 1 2 12.5L6 5Z" fill="#fff"/><path d="M7 15.8h20V27H7V15.8Zm3 3v5h5v-5h-5Zm8 0h6v5h-6v-5Z" fill="#334155"/>';

const MARKET_ICON_SVG: Record<MarketPoint["category"], string> = {
  farmers: svgIcon("#fbbf24", STOREFRONT_PATH),
  flea: svgIcon("#a78bfa", STOREFRONT_PATH),
  "mini-market": svgIcon("#34d399", STOREFRONT_PATH),
  market: svgIcon("#f59e0b", STOREFRONT_PATH),
};

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
  infrastructureQuery = "",
  hour,
  sampler,
  elevationVersion,
  onDistrictClick,
  onHover,
  selectedDistrictId = null,
}: BuildArgs): Layer[] {
  const layers: Layer[] = [];
  const posTrigger = { getPosition: elevationVersion };

  // Tramos de vía (polilíneas por corredor) a partir de los detectores.
  const trafficRoads = buildTrafficRoadSegments(data.trafficDetectors);
  const trafficDetectors = data.trafficDetectors;
  const infrastructure = data.infrastructure.filter((point) =>
    matchesInfrastructureQuery(point, infrastructureQuery),
  );

  // ── Demografía: coropletas de distritos con vértices elevados ──
  const elevatedFeatures: DistrictFeature[] = data.districts.features.map((f) => ({
    ...f,
    geometry: elevateGeometry(f.geometry as PolygonalGeometry, sampler) as DistrictFeature["geometry"],
  }));
  // El distrito en análisis se resalta con un relleno/borde distinto; el resto
  // usa la rampa de densidad habitual.
  const districtFill: (f: DistrictFeature) => Color = (f) =>
    f.properties.id === selectedDistrictId
      ? SELECTED_DISTRICT_FILL
      : densityColor(f.properties.density);
  const districtLine: (f: DistrictFeature) => Color = (f) =>
    f.properties.id === selectedDistrictId
      ? SELECTED_DISTRICT_LINE
      : [34, 211, 238, 180];

  layers.push(
    new GeoJsonLayer<District>({
      id: "districts",
      data: elevatedFeatures,
      visible: visibility.demographics,
      pickable: true,
      stroked: true,
      filled: true,
      extruded: false,
      getFillColor: districtFill as unknown as Color,
      getLineColor: districtLine as unknown as Color,
      lineWidthMinPixels: 1,
      lineWidthUnits: "pixels",
      getLineWidth: (f) =>
        f.properties.id === selectedDistrictId ? 3 : 1,
      updateTriggers: {
        getPosition: elevationVersion,
        getFillColor: selectedDistrictId,
        getLineColor: selectedDistrictId,
        getLineWidth: selectedDistrictId,
      },
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

  // ── Tráfico: tramos de vía coloreados por vehículos/hora (ligado al timeline) ──
  // Cada tramo sigue el eje del corredor del detector (polilínea hacia sus
  // vecinos) y se colorea por sus vehículos/h en la hora seleccionada: verde
  // (fluido) → amarillo/naranja (medio) → rojo (denso); gris si no hay dato a
  // esa hora. El color/grosor se recalculan al mover la línea de tiempo.
  layers.push(
    new PathLayer<TrafficRoadSegment>({
      id: "traffic",
      data: trafficRoads,
      visible: visibility.traffic,
      pickable: true,
      widthUnits: "pixels",
      widthMinPixels: 3,
      widthMaxPixels: 16,
      capRounded: true,
      jointRounded: true,
      getPath: (s) => s.path,
      getColor: (s) => trafficColor(trafficDetectors[s.detectorIndex]?.qkfz[hour] ?? null),
      getWidth: (s) => trafficWidth(trafficDetectors[s.detectorIndex]?.qkfz[hour] ?? null),
      updateTriggers: {
        getColor: hour,
        getWidth: hour,
      },
      onHover: (info) => {
        const s = info.object as TrafficRoadSegment | undefined;
        onHover(s ? { kind: "detector", id: s.id } : null);
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

  // ── Infraestructura (datos de ejemplo): un icono por categoría ──
  // Cada equipamiento se dibuja con un icono SVG coherente con su tipo
  // (hospital = cruz, escuela = birrete, cultura = columnas, energía = rayo,
  // agua = gota) mediante un IconLayer, para que el símbolo sea nítido y no
  // dependa del soporte de emojis de la plataforma.
  layers.push(
    new IconLayer<InfrastructurePoint>({
      id: "infrastructure",
      data: infrastructure,
      visible: visibility.infrastructure,
      pickable: true,
      // Los edificios 3D pertenecen al canvas de MapLibre y pueden cubrir
      // iconos situados a cota de suelo. Los iconos son marcadores de POI y
      // deben permanecer visibles sobre el volumen urbano.
      parameters: { depthCompare: "always" },
      getPosition: (d) => withElevation(d.position, sampler),
      getIcon: (d) => ({
        id: d.category,
        url: INFRA_ICON_SVG[d.category] ?? INFRA_ICON_SVG.cultura,
        width: 36,
        height: 36,
        anchorX: 18,
        anchorY: 18,
      }),
      getSize: 28,
      sizeUnits: "pixels",
      updateTriggers: posTrigger,
      onHover: (info) => {
        const d = info.object as InfrastructurePoint | undefined;
        onHover(d ? { kind: "infra", id: d.id } : null);
      },
    }),
  );

  // ── Puntos críticos publicados por la fuente de tráfico: radio por severidad ──
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

  layers.push(
    new IconLayer<MarketPoint>({
      id: "markets",
      data: data.markets,
      visible: visibility.markets,
      pickable: true,
      parameters: { depthCompare: "always" },
      getPosition: (d) => withElevation(d.position, sampler),
      getIcon: (d) => ({
        id: `market-${d.category}`,
        url: MARKET_ICON_SVG[d.category],
        width: 36,
        height: 36,
        anchorX: 18,
        anchorY: 18,
      }),
      getSize: 30,
      sizeUnits: "pixels",
      updateTriggers: posTrigger,
      onHover: (info) => {
        const d = info.object as MarketPoint | undefined;
        onHover(d ? { kind: "market", id: d.id } : null);
      },
    }),
  );

  return layers;
}

function matchesInfrastructureQuery(point: InfrastructurePoint, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  return [point.name, point.category].some((value) =>
    normalizeSearchText(value).includes(normalizedQuery),
  );
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}

/**
 * SVG en línea (data URL) por categoría de infraestructura. Se usa un IconLayer
 * en vez de emojis de texto para garantizar un icono nítido y coherente con el
 * lugar (hospital, escuela, cultura, energía, agua) en cualquier plataforma.
 */
const INFRA_ICON_SVG: Record<InfrastructurePoint["category"], string> = {
  // Hospital: cruz blanca sobre fondo rojo.
  hospital: svgIcon(
    "#e11d48",
    '<rect x="15" y="9" width="6" height="18" rx="1.2" fill="#fff"/><rect x="9" y="15" width="18" height="6" rx="1.2" fill="#fff"/>',
  ),
  salud: svgIcon("#e11d48", '<circle cx="18" cy="18" r="8" fill="#fff"/>'),
  // Escuela: birrete.
  escuela: svgIcon(
    "#2563eb",
    '<path d="M18 11 7 16l11 5 8-3.6V22a1 1 0 0 0 2 0v-5l1-.5z" fill="#fff"/><path d="M12 19v3.2c0 1.5 2.7 2.8 6 2.8s6-1.3 6-2.8V19l-6 2.7z" fill="#fff" opacity="0.8"/>',
  ),
  educacion: svgIcon("#2563eb", '<path d="M8 16h20v11H8z" fill="#fff"/>'),
  universidad: svgIcon("#4f46e5", '<path d="M7 14 18 8l11 6-11 6z" fill="#fff"/>'),
  biblioteca: svgIcon("#0f766e", '<path d="M9 10h3v17H9zm7 0h4v17h-4zm8 0h3v17h-3z" fill="#fff"/>'),
  museo: svgIcon("#a855f7", '<path d="M7 13h22v3H7zm3 5h3v8h-3zm7 0h3v8h-3zm7 0h3v8h-3z" fill="#fff"/>'),
  // Cultura: columnas de un edificio cultural (museo/teatro).
  cultura: svgIcon(
    "#a855f7",
    '<path d="M18 8 8 13v2h20v-2z" fill="#fff"/><rect x="10" y="16" width="2.5" height="8" fill="#fff"/><rect x="16.75" y="16" width="2.5" height="8" fill="#fff"/><rect x="23.5" y="16" width="2.5" height="8" fill="#fff"/> <rect x="8" y="25" width="20" height="2.5" fill="#fff"/>',
  ),
  comunidad: svgIcon("#db2777", '<circle cx="13" cy="15" r="4" fill="#fff"/><circle cx="23" cy="15" r="4" fill="#fff"/>'),
  deporte: svgIcon("#16a34a", '<circle cx="18" cy="18" r="9" fill="#fff"/>'),
  emergencias: svgIcon("#ea580c", '<path d="M18 7 10 22h6l-2 8 10-16h-6z" fill="#fff"/>'),
  seguridad: svgIcon("#334155", '<path d="M18 7 28 11v7c0 6-4 10-10 12C12 28 8 24 8 18v-7z" fill="#fff"/>'),
  justicia: svgIcon("#7c3aed", '<path d="M8 13h20v3H8zm3 5h3v8h-3zm7 0h3v8h-3zm7 0h3v8h-3z" fill="#fff"/>'),
  administracion: svgIcon("#475569", '<path d="M7 13h22v3H7zm3 5h3v8h-3zm7 0h3v8h-3zm7 0h3v8h-3z" fill="#fff"/>'),
  // Agua: gota.
  agua: svgIcon(
    "#0ea5e9",
    '<path d="M18 7c5 6 8 10 8 14a8 8 0 0 1-16 0c0-4 3-8 8-14z" fill="#fff"/>',
  ),
};

/** Envuelve el contenido SVG en un marcador circular de 36×36 como data URL. */
function svgIcon(bg: string, inner: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">` +
    `<circle cx="18" cy="18" r="16" fill="${bg}" stroke="#fff" stroke-width="2"/>` +
    inner +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
