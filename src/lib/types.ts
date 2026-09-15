// ─────────────────────────────────────────────────────────────
// Tipos centrales del Gemelo Digital de Berlín
// ─────────────────────────────────────────────────────────────

/** Identificadores de las capas visualizables sobre el mapa. */
export type LayerId =
  | "mobility"
  | "air"
  | "demographics"
  | "infrastructure"
  | "hotspots";

export type LayerCategory = {
  id: LayerId;
  label: string;
  description: string;
  /** Nombre de icono (emoji sencillo para evitar dependencias de iconos). */
  icon: string;
  /** Color de acento en HEX para leyendas/badges. */
  color: string;
  defaultVisible: boolean;
};

/** Un distrito (Bezirk) de Berlín con sus métricas. */
export interface District {
  id: string;
  name: string;
  /** Población total. */
  population: number;
  /** Área en km². */
  areaKm2: number;
  /** Densidad hab/km² (derivada). */
  density: number;
  /** Edad media (años). */
  medianAge: number;
  /** Centroide [lng, lat] para etiquetas/popups. */
  centroid: [number, number];
  /** Índice de calidad del aire (AQI) actual estimado. */
  aqi: number;
  /** % de zonas verdes. */
  greenSpacePct: number;
}

/** Feature GeoJSON de un distrito. */
export interface DistrictFeature {
  type: "Feature";
  properties: District;
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
}

export interface DistrictFeatureCollection {
  type: "FeatureCollection";
  features: DistrictFeature[];
}

/** Estación de transporte público (U-Bahn / S-Bahn). */
export interface TransitStation {
  id: string;
  name: string;
  /** "u" = U-Bahn, "s" = S-Bahn, "tram", "bus". */
  mode: "u" | "s" | "tram" | "bus";
  lines: string[];
  position: [number, number]; // [lng, lat]
}

/** Vehículo/estación de micromovilidad (GBFS). */
export interface BikeStation {
  id: string;
  name: string;
  position: [number, number];
  bikesAvailable: number;
  docksAvailable: number;
}

/** Medición de calidad del aire en un punto. */
export interface AirQualityPoint {
  id: string;
  location: string;
  position: [number, number];
  /** Partículas PM2.5 en µg/m³. */
  pm25: number;
  /** NO2 en µg/m³. */
  no2: number;
  /** Índice AQI derivado 0-500. */
  aqi: number;
  updatedAt: string;
}

/** Punto crítico / incidencia (accidente, obra, alerta). */
export interface Hotspot {
  id: string;
  type: "accidente" | "obra" | "congestion" | "alerta";
  title: string;
  district: string;
  position: [number, number];
  severity: 1 | 2 | 3;
  reportedAt: string;
}

/** Elemento de infraestructura destacada. */
export interface InfrastructurePoint {
  id: string;
  category: "hospital" | "escuela" | "cultura" | "energia" | "agua";
  name: string;
  position: [number, number];
}

/** Punto de una serie temporal (para timeline y charts). */
export interface TimeSeriesPoint {
  hour: number; // 0-23
  label: string; // "00:00"
  mobilityIndex: number; // 0-100 uso de transporte/tráfico
  aqi: number; // calidad del aire
  bikeUsage: number; // viajes en bici
  energyDemand: number; // MW estimados
}

/** KPI mostrado en el dashboard. */
export interface Kpi {
  id: string;
  label: string;
  value: string;
  /** Variación relativa, p.ej. "+3.2%". */
  delta?: string;
  trend?: "up" | "down" | "flat";
  tone?: "good" | "warn" | "bad" | "neutral";
  unit?: string;
}

/** Snapshot completo de datos de la ciudad para un instante. */
export interface CityDataset {
  districts: DistrictFeatureCollection;
  transit: TransitStation[];
  bikes: BikeStation[];
  air: AirQualityPoint[];
  hotspots: Hotspot[];
  infrastructure: InfrastructurePoint[];
  timeSeries: TimeSeriesPoint[];
  /** Marca de la fuente efectiva de cada bloque. */
  source: {
    transit: "live" | "mock";
    bikes: "live" | "mock";
    air: "live" | "mock";
    districts: "live" | "mock";
  };
}
