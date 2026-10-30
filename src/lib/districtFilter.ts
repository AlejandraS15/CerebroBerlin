/**
 * Filtra un `CityDataset` a una sola provincia (distrito) para que la analítica
 * (KPIs, tablas y gráficas) se calcule solo con los datos de esa provincia.
 *
 * `buildAnalytics` ya deriva todo del dataset, así que basta con recortar las
 * colecciones por distrito y reutilizar la misma lógica. Las colecciones con
 * código de distrito (aire) o posición de distrito (clima) se filtran de forma
 * directa; las que solo tienen coordenada (transporte, bicis) se asignan al
 * distrito cuyo `point` es el más cercano (dentro del dataset, sin inventar).
 *
 * Módulo de lógica pura (sin React) para poder probarlo aislado.
 */

import type { CityDataset, DistrictFeature } from "@/lib/types";

/** Distancia al cuadrado entre dos puntos (grados; suficiente para comparar). */
function dist2(a: [number, number], b: [number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

/** Código del distrito cuyo `point` es el más cercano a `pos`. */
function nearestDistrictCode(
  pos: [number, number],
  districts: DistrictFeature[],
): string | null {
  let best: string | null = null;
  let bestD2 = Infinity;
  for (const f of districts) {
    const d2 = dist2(pos, f.properties.point);
    if (d2 < bestD2) {
      bestD2 = d2;
      best = f.properties.id;
    }
  }
  return best;
}

/**
 * Devuelve un dataset recortado a la provincia `districtId`. Si `districtId` es
 * `null` (o no existe), devuelve el dataset original sin cambios (vista "Todas
 * las provincias"). No muta el dataset recibido.
 */
export function filterDatasetByDistrict(
  data: CityDataset,
  districtId: string | null,
): CityDataset {
  if (!districtId) return data;

  const feature = data.districts.features.find(
    (f) => f.properties.id === districtId,
  );
  if (!feature) return data;

  const point = feature.properties.point;

  // Transporte y bicis no traen código de distrito: se asignan por cercanía al
  // `point` del distrito. Se precalcula el conjunto de puntos de distrito.
  const districtFeatures = data.districts.features;
  const inDistrict = (pos: [number, number]) =>
    nearestDistrictCode(pos, districtFeatures) === districtId;

  return {
    ...data,
    districts: {
      ...data.districts,
      features: [feature],
    },
    air: data.air.filter((p) => p.districtCode === districtId),
    airStations: data.airStations.filter((s) => inDistrict(s.position)),
    weather: data.weather.filter(
      (w) => w.position[0] === point[0] && w.position[1] === point[1],
    ),
    transit: data.transit.filter((t) => inDistrict(t.position)),
    bikes: data.bikes.filter((b) => inDistrict(b.position)),
  };
}
