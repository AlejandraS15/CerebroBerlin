import type { District, DistrictFeatureCollection } from "@/lib/types";

/**
 * Los 12 distritos (Bezirke) de Berlín con métricas demográficas
 * aproximadas basadas en cifras públicas (Amt für Statistik Berlin-Brandenburg).
 * Las geometrías son polígonos simplificados centrados en cada distrito para
 * fines de visualización; para producción se recomienda cargar los límites
 * oficiales (RBS/ALKIS) desde daten.berlin.de.
 */

interface RawDistrict extends Omit<District, "density"> {
  /** Semiancho aprox en grados (lng) para el polígono simplificado. */
  halfW: number;
  /** Semialto aprox en grados (lat). */
  halfH: number;
}

const RAW: RawDistrict[] = [
  {
    id: "mitte",
    name: "Mitte",
    population: 384172,
    areaKm2: 39.5,
    medianAge: 39.4,
    centroid: [13.383, 52.53],
    aqi: 62,
    greenSpacePct: 14,
    halfW: 0.055,
    halfH: 0.03,
  },
  {
    id: "friedrichshain-kreuzberg",
    name: "Friedrichshain-Kreuzberg",
    population: 289762,
    areaKm2: 20.3,
    medianAge: 37.1,
    centroid: [13.454, 52.505],
    aqi: 68,
    greenSpacePct: 11,
    halfW: 0.045,
    halfH: 0.022,
  },
  {
    id: "pankow",
    name: "Pankow",
    population: 409335,
    areaKm2: 103.0,
    medianAge: 40.8,
    centroid: [13.44, 52.59],
    aqi: 48,
    greenSpacePct: 34,
    halfW: 0.075,
    halfH: 0.05,
  },
  {
    id: "charlottenburg-wilmersdorf",
    name: "Charlottenburg-Wilmersdorf",
    population: 342332,
    areaKm2: 64.7,
    medianAge: 43.6,
    centroid: [13.3, 52.5],
    aqi: 55,
    greenSpacePct: 22,
    halfW: 0.07,
    halfH: 0.045,
  },
  {
    id: "spandau",
    name: "Spandau",
    population: 245197,
    areaKm2: 91.9,
    medianAge: 43.1,
    centroid: [13.2, 52.535],
    aqi: 44,
    greenSpacePct: 41,
    halfW: 0.08,
    halfH: 0.05,
  },
  {
    id: "steglitz-zehlendorf",
    name: "Steglitz-Zehlendorf",
    population: 308697,
    areaKm2: 102.5,
    medianAge: 45.5,
    centroid: [13.24, 52.44],
    aqi: 41,
    greenSpacePct: 47,
    halfW: 0.08,
    halfH: 0.05,
  },
  {
    id: "tempelhof-schoeneberg",
    name: "Tempelhof-Schöneberg",
    population: 351644,
    areaKm2: 53.1,
    medianAge: 42.7,
    centroid: [13.38, 52.45],
    aqi: 58,
    greenSpacePct: 24,
    halfW: 0.055,
    halfH: 0.05,
  },
  {
    id: "neukoelln",
    name: "Neukölln",
    population: 329917,
    areaKm2: 44.9,
    medianAge: 39.9,
    centroid: [13.46, 52.44],
    aqi: 64,
    greenSpacePct: 18,
    halfW: 0.05,
    halfH: 0.05,
  },
  {
    id: "treptow-koepenick",
    name: "Treptow-Köpenick",
    population: 285096,
    areaKm2: 168.4,
    medianAge: 44.3,
    centroid: [13.57, 52.44],
    aqi: 39,
    greenSpacePct: 55,
    halfW: 0.09,
    halfH: 0.06,
  },
  {
    id: "marzahn-hellersdorf",
    name: "Marzahn-Hellersdorf",
    population: 277990,
    areaKm2: 61.7,
    medianAge: 43.9,
    centroid: [13.59, 52.53],
    aqi: 46,
    greenSpacePct: 33,
    halfW: 0.06,
    halfH: 0.045,
  },
  {
    id: "lichtenberg",
    name: "Lichtenberg",
    population: 305222,
    areaKm2: 52.1,
    medianAge: 41.6,
    centroid: [13.5, 52.53],
    aqi: 53,
    greenSpacePct: 26,
    halfW: 0.05,
    halfH: 0.045,
  },
  {
    id: "reinickendorf",
    name: "Reinickendorf",
    population: 269102,
    areaKm2: 89.5,
    medianAge: 44.2,
    centroid: [13.33, 52.58],
    aqi: 47,
    greenSpacePct: 38,
    halfW: 0.07,
    halfH: 0.05,
  },
];

function toFeature(d: RawDistrict) {
  const [lng, lat] = d.centroid;
  const { halfW, halfH } = d;
  // Polígono rectangular simplificado (5 puntos, cerrado).
  const ring: number[][] = [
    [lng - halfW, lat - halfH],
    [lng + halfW, lat - halfH],
    [lng + halfW, lat + halfH],
    [lng - halfW, lat + halfH],
    [lng - halfW, lat - halfH],
  ];
  const district: District = {
    id: d.id,
    name: d.name,
    population: d.population,
    areaKm2: d.areaKm2,
    density: Math.round(d.population / d.areaKm2),
    medianAge: d.medianAge,
    centroid: d.centroid,
    aqi: d.aqi,
    greenSpacePct: d.greenSpacePct,
  };
  return {
    type: "Feature" as const,
    properties: district,
    geometry: {
      type: "Polygon" as const,
      coordinates: [ring],
    },
  };
}

export const BERLIN_DISTRICTS: DistrictFeatureCollection = {
  type: "FeatureCollection",
  features: RAW.map(toFeature),
};

/** Lista plana de distritos (para tablas y selects). */
export const DISTRICT_LIST: District[] = BERLIN_DISTRICTS.features.map(
  (f) => f.properties,
);
