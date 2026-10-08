/**
 * Distritos (Bezirke) construidos desde el lago versionado (Origen_de_Dato
 * `snapshot`), no escritos a mano. La geometría es la oficial ALKIS
 * (MultiPolygon, WGS84 simplificado); la población y la estructura de edad
 * vienen de Einwohnerdichte 2024; el % verde, de Flächennutzung 2020; la
 * superficie y el punto interior, de ALKIS (EPSG:25833 para el área).
 */

import type {
  District,
  DistrictCode,
  DistrictFeature,
  DistrictFeatureCollection,
} from "@/lib/types";
import { territorio, poblacion, verde } from "@/data/lake";

const CODIGOS: readonly DistrictCode[] = [
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12",
];

/** Construye los 12 distritos cruzando los tres Temas por Código_de_Distrito. */
export function buildDistricts(
  terr: typeof territorio,
  pob: typeof poblacion,
  ver: typeof verde,
): District[] {
  return CODIGOS.map((code) => {
    const t = terr.por_distrito[code];
    const p = pob.por_distrito[code];
    const v = ver.por_distrito[code];
    if (!t || !p || !v) {
      throw new Error(`Falta el distrito ${code} en algún Tema del lago`);
    }
    const population = p.poblacion.valor;
    const areaKm2 = t.area_km2.valor;
    return {
      id: code,
      name: t.nombre,
      population,
      areaKm2,
      density: Math.round(population / areaKm2),
      pctUnder18: p.pct_menor_18.valor,
      pct65Plus: p.pct_65_mas.valor,
      ageCoveragePct: p.cobertura_edad.valor,
      greenPct: v.pct_verde.valor,
      point: [t.punto.valor[0], t.punto.valor[1]],
    };
  });
}

/** Distritos indexados por código, para cruzar con geometría y servicios. */
const DISTRICT_BY_CODE: Record<DistrictCode, District> = Object.fromEntries(
  buildDistricts(territorio, poblacion, verde).map((d) => [d.id, d]),
) as Record<DistrictCode, District>;

/** Lista plana ordenada por código (para tablas, selects y consultas). */
export const DISTRICT_LIST: District[] = CODIGOS.map((c) => DISTRICT_BY_CODE[c]);

/** FeatureCollection con los límites oficiales ALKIS y las métricas del distrito. */
export const BERLIN_DISTRICTS: DistrictFeatureCollection = {
  type: "FeatureCollection",
  features: territorio.geometria.features.map((f): DistrictFeature => {
    const code = f.properties.codigo as DistrictCode;
    const district = DISTRICT_BY_CODE[code];
    if (!district) {
      throw new Error(`La geometría cita un distrito ${code} que no está en el lago`);
    }
    return {
      type: "Feature",
      properties: district,
      geometry: { type: "MultiPolygon", coordinates: f.geometry.coordinates },
    };
  }),
};
