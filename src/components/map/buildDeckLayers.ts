import { GeoJsonLayer, IconLayer, LineLayer, ScatterplotLayer } from "@deck.gl/layers";
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

  // ── Tráfico: segmentos de vía coloreados por intensidad horaria ──
  // ── Tráfico: tramos de vía alineados al eje de la calle ──
  // Los detectores no traen geometría de calle; el tramo de cada uno se orienta
  // según la dirección hacia su detector vecino más cercano (los detectores se
  // alinean sobre las vías, así que esa dirección aproxima el eje de la calle).
  // Color verde (fluido) → rojo (congestión) y grosor por vehículos/h; gris sin
  // dato a esa hora. Reacciona a la hora vía updateTriggers.
  const trafficSegments: TrafficSegment[] = buildTrafficSegments(
    data.trafficDetectors,
    sampler,
  );
  layers.push(
    new LineLayer<TrafficSegment>({
      id: "traffic",
      data: trafficSegments,
      visible: visibility.traffic,
      pickable: true,
      widthUnits: "pixels",
      widthMinPixels: 2,
      widthMaxPixels: 16,
      getSourcePosition: (s) => s.source,
      getTargetPosition: (s) => s.target,
      getColor: (s) => {
        const q = s.detector.qkfz[hour] ?? null;
        return q == null ? GREY : trafficColor(q);
      },
      getWidth: (s) => trafficWidth(s.detector.qkfz[hour] ?? null),
      updateTriggers: {
        getSourcePosition: elevationVersion,
        getTargetPosition: elevationVersion,
        getColor: hour,
        getWidth: hour,
      },
      onHover: (info) => {
        const s = info.object as TrafficSegment | undefined;
        onHover(s ? { kind: "detector", id: s.detector.id } : null);
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
      data: data.infrastructure,
      visible: visibility.infrastructure,
      pickable: true,
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
 * Color del tramo de tráfico por intensidad (verde fluido → amarillo → rojo
 * congestión). Se normaliza el flujo veh/h a [0,1] sobre ~2000 veh/h; a partir
 * de ~1500 veh/h el tramo es claramente rojo.
 */
function trafficColor(qkfz: number): Color {
  const t = Math.min(1, Math.max(0, qkfz) / 2000);
  // Rampa en dos tramos: verde → amarillo (0..0.5) y amarillo → rojo (0.5..1).
  let r: number;
  let g: number;
  if (t < 0.5) {
    const u = t / 0.5;
    r = Math.round(74 + u * 181); // 74 → 255
    g = Math.round(222 - u * 33); // 222 → 189
  } else {
    const u = (t - 0.5) / 0.5;
    r = 255;
    g = Math.round(189 - u * 189); // 189 → 0
  }
  return [r, g, 40, 235];
}

/** Grosor del tramo en píxeles según el flujo; fino y constante sin dato. */
function trafficWidth(qkfz: number | null): number {
  if (qkfz == null || !Number.isFinite(qkfz)) return 2;
  const t = Math.min(1, Math.max(0, qkfz) / 2000);
  return 3 + t * 13; // 3 px (poco) → 16 px (mucho)
}

/** Tramo de vía orientado al eje de la calle, listo para el LineLayer. */
interface TrafficSegment {
  detector: TrafficDetector;
  source: number[];
  target: number[];
}

/**
 * Construye un tramo por detector orientado según la dirección hacia su vecino
 * más cercano, de modo que la línea sigue el eje de la vía en lugar de una
 * diagonal fija. Longitud ~110 m; respaldo a orientación horizontal si no hay
 * vecino. Ambos extremos se elevan con el muestreador de cotas.
 */
function buildTrafficSegments(
  detectors: TrafficDetector[],
  sampler: ElevationSampler,
): TrafficSegment[] {
  const HALF = 0.0012; // media longitud del tramo en grados (~110 m total)
  // Factor de corrección por latitud para medir distancias en grados.
  const cosLat = Math.cos((52.52 * Math.PI) / 180);

  return detectors.map((d, i) => {
    const [lng, lat] = d.position;
    let bearing = nearestBearing(detectors, i, cosLat);
    if (bearing == null) bearing = 0; // sin vecino: tramo horizontal (E-O)

    // Vector unitario del eje de la calle, corrigiendo la longitud por latitud.
    const dLng = (Math.cos(bearing) * HALF) / (cosLat || 1);
    const dLat = Math.sin(bearing) * HALF;
    const a: [number, number] = [lng - dLng, lat - dLat];
    const b: [number, number] = [lng + dLng, lat + dLat];
    return { detector: d, source: withElevation(a, sampler), target: withElevation(b, sampler) };
  });
}

/**
 * Ángulo (radianes) de la dirección desde el detector `i` hacia el detector más
 * cercano; `null` si no hay otros detectores. Las distancias se miden en grados
 * corrigiendo la longitud por el coseno de la latitud.
 */
function nearestBearing(
  detectors: TrafficDetector[],
  i: number,
  cosLat: number,
): number | null {
  const [lng, lat] = detectors[i].position;
  let best = -1;
  let bestD2 = Infinity;
  for (let j = 0; j < detectors.length; j++) {
    if (j === i) continue;
    const [ol, oa] = detectors[j].position;
    const dx = (ol - lng) * cosLat;
    const dy = oa - lat;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = j;
    }
  }
  if (best < 0) return null;
  const [ol, oa] = detectors[best].position;
  return Math.atan2(oa - lat, (ol - lng) * cosLat);
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
  // Escuela: birrete.
  escuela: svgIcon(
    "#2563eb",
    '<path d="M18 11 7 16l11 5 8-3.6V22a1 1 0 0 0 2 0v-5l1-.5z" fill="#fff"/><path d="M12 19v3.2c0 1.5 2.7 2.8 6 2.8s6-1.3 6-2.8V19l-6 2.7z" fill="#fff" opacity="0.8"/>',
  ),
  // Cultura: columnas de un edificio cultural (museo/teatro).
  cultura: svgIcon(
    "#a855f7",
    '<path d="M18 8 8 13v2h20v-2z" fill="#fff"/><rect x="10" y="16" width="2.5" height="8" fill="#fff"/><rect x="16.75" y="16" width="2.5" height="8" fill="#fff"/><rect x="23.5" y="16" width="2.5" height="8" fill="#fff"/><rect x="8" y="25" width="20" height="2.5" fill="#fff"/>',
  ),
  // Energía: rayo.
  energia: svgIcon(
    "#f59e0b",
    '<path d="M19 7 11 19h6l-2 10 10-14h-6z" fill="#fff"/>',
  ),
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
