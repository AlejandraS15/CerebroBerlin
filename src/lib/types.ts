// ─────────────────────────────────────────────────────────────
// Tipos centrales del Gemelo Digital de Berlín
// ─────────────────────────────────────────────────────────────

// ── Origen y procedencia ─────────────────────────────────────

/**
 * Origen_de_Dato de un valor o bloque:
 * - `snapshot`: cifra del lago confirmado en git.
 * - `live`: consultado en tiempo de ejecución.
 * - `mock`: simulado (fallback); se muestra con la insignia "simulado".
 * - `example`: datos de ejemplo sin fuente (hotspots, infraestructura).
 */
export type Origin = "snapshot" | "live" | "mock" | "example";

/** Estado de una Ficha_de_Fuente del catálogo. */
export type SourceState = "integrado" | "candidato" | "caído" | "declarado" | "excluido";

/**
 * Identificador de métrica con procedencia. `src/lib/metrics.ts` define
 * `METRICS: Record<MetricId, MetricDef>` y reexporta este tipo.
 */
export type MetricId =
  | "population"
  | "density"
  | "area"
  | "pctUnder18"
  | "pct65Plus"
  | "ageCoverage"
  | "greenPct"
  | "aqiModel"
  | "aqiStation"
  | "traffic"
  | "bikes"
  | "temperature";

/**
 * Referencia de procedencia de un valor mostrado. `src/lib/provenance.ts`
 * la resuelve contra el catálogo y reexporta este tipo.
 */
export interface ProvenanceRef {
  metric: MetricId;
  origin: Origin;
  vigencia?: string;
  /** Fecha_Probado del tema (snapshot). */
  probado?: string;
  /** Momento de consulta (live). */
  fetchedAt?: string;
  /** Ámbito del valor, p. ej. "Mitte". */
  scope?: string;
}

// ── Capas ────────────────────────────────────────────────────

/** Identificadores de las capas visualizables sobre el mapa. */
export type LayerId =
  | "mobility"
  | "air"
  | "airStations"
  | "traffic"
  | "weather"
  | "demographics"
  | "infrastructure"
  | "hotspots";

export interface LayerCategory {
  id: LayerId;
  label: string;
  description: string;
  /** Nombre de icono (emoji sencillo para evitar dependencias de iconos). */
  icon: string;
  /** Color de acento en HEX para leyendas/badges. */
  color: string;
  /** Ignorado (forzado a false) si `example === true`. */
  defaultVisible: boolean;
  /** Constante por tipo: true en hotspots e infraestructura (datos de ejemplo sin fuente). */
  example?: boolean;
}

// ── Distritos ────────────────────────────────────────────────

/** Código_de_Distrito ALKIS (`gem` 001–012 → "01"–"12"). */
export type DistrictCode =
  | "01"
  | "02"
  | "03"
  | "04"
  | "05"
  | "06"
  | "07"
  | "08"
  | "09"
  | "10"
  | "11"
  | "12";

/** Un distrito (Bezirk) de Berlín con sus métricas, construido desde el lago. */
export interface District {
  /** Código_de_Distrito. */
  id: DistrictCode;
  name: string;
  /** Población total (hab). */
  population: number;
  /** Área en km² (ALKIS, EPSG:25833). */
  areaKm2: number;
  /** Densidad hab/km² = round(population / areaKm2). */
  density: number;
  /** % de población menor de 18 años. */
  pctUnder18: number;
  /** % de población de 65 años o más. */
  pct65Plus: number;
  /** % de población con grupos de edad informados. */
  ageCoveragePct: number;
  /** % de superficie verde sobre la superficie de bloques. */
  greenPct: number;
  /** Punto_de_Distrito [lng, lat] (interior al polígono). */
  point: [number, number];
}

/** Feature GeoJSON de un distrito (límites oficiales ALKIS). */
export interface DistrictFeature {
  type: "Feature";
  properties: District;
  geometry:
    | { type: "Polygon"; coordinates: number[][][] }
    | { type: "MultiPolygon"; coordinates: number[][][][] };
}

export interface DistrictFeatureCollection {
  type: "FeatureCollection";
  features: DistrictFeature[];
}

// ── Transporte y micromovilidad ──────────────────────────────

/** Próxima salida en tiempo real de una estación. */
export interface Departure {
  /** Nombre de la línea (p. ej. "U8", "S7"). */
  line: string;
  /** Destino del servicio. */
  direction: string;
  /** Hora planificada (ISO) o null si no disponible. */
  when: string | null;
  /** Retraso en minutos (positivo = tarde), o null. */
  delayMin: number | null;
}

/** Estación de transporte público (U-Bahn / S-Bahn). */
export interface TransitStation {
  id: string;
  name: string;
  /** "u" = U-Bahn, "s" = S-Bahn, "tram", "bus". */
  mode: "u" | "s" | "tram" | "bus";
  lines: string[];
  position: [number, number]; // [lng, lat]
  /** Próximas salidas en tiempo real (opcional, solo estaciones clave). */
  departures?: Departure[];
}

/** Vehículo/estación de micromovilidad (GBFS). */
export interface BikeStation {
  id: string;
  name: string;
  position: [number, number];
  bikesAvailable: number;
  docksAvailable: number;
}

/** Detector de tráfico (Verkehrsdetektion) con su perfil horario. */
export interface TrafficDetector {
  id: string;
  position: [number, number];
  /** 24 medias horarias de vehículos/h (jun-2025); `null` si no hay dato. */
  qkfz: (number | null)[];
}

// ── Calidad del aire ─────────────────────────────────────────

/** Calidad del aire modelada (Open-Meteo/CAMS) en el punto de un distrito. */
export interface AirQualityPoint {
  id: string;
  /** Distrito asociado por código (no por orden de respuesta). */
  districtCode: DistrictCode | null;
  location: string;
  position: [number, number];
  /** Concentraciones en µg/m³; `null` si la fuente no las devuelve (nunca 0). */
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  /** EAQI (Índice Europeo de Calidad del Aire); `null` si no hay datos. */
  aqi: number | null;
  updatedAt: string | null;
  /** Origen por valor: decide la insignia "simulado". */
  origin: "live" | "mock";
}

/** Estación de medición Luftgütemessnetz (o su mock). */
export interface AirStation {
  code: string;
  name: string;
  stationGroup: string;
  /** [lng, lat], siempre finitas: las estaciones sin coordenadas válidas se descartan. */
  position: [number, number];
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  measuredAt: string | null;
  aqi: number | null;
  /** Origen por valor: decide la insignia "simulado". */
  origin: "live" | "mock";
}

// ── Meteorología, ejemplo e infraestructura ──────────────────

/** Condiciones meteorológicas en un punto (distrito). */
export interface WeatherPoint {
  id: string;
  location: string;
  position: [number, number];
  /** Temperatura del aire en °C. */
  temperature: number;
  /** Humedad relativa en %. */
  humidity: number;
  /** Velocidad del viento en km/h. */
  windSpeed: number;
  /** Código de tiempo WMO (0 despejado … 95 tormenta). */
  weatherCode: number;
  updatedAt: string;
}

/** Punto crítico / incidencia (accidente, obra, alerta). Datos de ejemplo. */
export interface Hotspot {
  id: string;
  type: "accidente" | "obra" | "congestion" | "alerta";
  title: string;
  district: string;
  position: [number, number];
  severity: 1 | 2 | 3;
  reportedAt: string;
}

/** Elemento de infraestructura destacada. Datos de ejemplo. */
export interface InfrastructurePoint {
  id: string;
  category: "hospital" | "escuela" | "cultura" | "energia" | "agua";
  name: string;
  position: [number, number];
}

// ── Series temporales ────────────────────────────────────────

/** Valor horario de Open-Meteo (EAQI y temperatura) para la ciudad. */
export interface HourlyPoint {
  hour: number; // 0-23
  aqi: number | null;
  temperature: number | null;
}

/** Punto de la serie de 24 horas (timeline y gráficos). */
export interface TimeSeriesPoint {
  hour: number; // 0-23
  label: string; // "00:00"
  /** veh/h, perfil típico de la ciudad (jun-2025). */
  traffic: number;
  /** 0–100 relativo al máximo del perfil. */
  trafficIndex: number;
  /** EAQI horario Open-Meteo. */
  aqi: number | null;
  /** °C horario Open-Meteo. */
  temperature: number | null;
}

// ── KPIs ─────────────────────────────────────────────────────

/** KPI mostrado en el dashboard, siempre con su procedencia. */
export interface Kpi {
  id: "population" | "traffic" | "aqi" | "bikes" | "temperature";
  label: string;
  value: string;
  unit?: string;
  note?: string;
  vigencia?: string;
  origin: Origin;
  provenance: ProvenanceRef;
  tone?: "good" | "warn" | "bad" | "neutral";
  /** true solo en el KPI de aire: muestra el Control_de_Definición_EAQI. */
  eaqi?: boolean;
  /** KPI de aire: nº de distritos con `aqi != null` (independiente de `value`). */
  available?: number;
}

// ── Dataset ──────────────────────────────────────────────────

/** Bloques de datos con origen propio. */
export type BlockId =
  | "districts"
  | "traffic"
  | "transit"
  | "bikes"
  | "air"
  | "airStations"
  | "weather"
  | "hourly"
  | "hotspots"
  | "infrastructure";

/** Resultado de un servicio: datos más su origen efectivo. */
export interface SourceBlock<T> {
  data: T;
  origin: Origin;
  fetchedAt: string | null;
}

/** Temas del lago con Fecha_Probado. */
export type LakeTopic = "territorio" | "poblacion" | "verde" | "trafico";

/** Snapshot completo de datos de la ciudad para un instante. */
export interface CityDataset {
  districts: DistrictFeatureCollection;
  transit: TransitStation[];
  bikes: BikeStation[];
  air: AirQualityPoint[];
  airStations: AirStation[];
  trafficDetectors: TrafficDetector[];
  weather: WeatherPoint[];
  hotspots: Hotspot[];
  infrastructure: InfrastructurePoint[];
  timeSeries: TimeSeriesPoint[];
  /** Origen efectivo de cada bloque (districts/traffic "snapshot"; hotspots/infrastructure "example"). */
  source: Record<BlockId, Origin>;
  /** Momento de consulta de los bloques en vivo. */
  fetchedAt: Partial<Record<BlockId, string>>;
  lake: { probado: Record<LakeTopic, string> };
}

// ── Mapa: objetivos de hover/clic y tooltip ──────────────────

export type MapTargetKind =
  | "district"
  | "airStation"
  | "air"
  | "detector"
  | "transit"
  | "bike"
  | "weather"
  | "hotspot"
  | "infra";

/** Objeto del mapa identificado por tipo e id. */
export interface MapTarget {
  kind: MapTargetKind;
  id: string;
}

/** Objeto fijado por clic o teclado. */
export interface PinnedTarget extends MapTarget {
  /** Posición en píxeles de la tarjeta fijada. */
  anchor: { x: number; y: number };
  /** Elemento al que vuelve el foco al desfijar. */
  returnFocusTo?: HTMLElement | null;
}

/** Fila del tooltip; las marcas son datos comprobables, no texto libre. */
export interface TooltipRow {
  label: string;
  value: string;
  /** Lleva Control_de_Definición_EAQI. */
  eaqi?: boolean;
  /** "mock" → OriginBadge "simulado". */
  origin?: Origin;
  /** "datos de ejemplo (sin fuente)". */
  example?: boolean;
}

/** Contenido compartido por tooltip de hover y tarjeta fijada. */
export interface TooltipContent {
  target: MapTarget;
  title: string;
  rows: TooltipRow[];
}
