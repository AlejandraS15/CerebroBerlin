/**
 * Definición única de las métricas por distrito mostradas en la Aplicación.
 *
 * Cada métrica tiene etiqueta, unidad, definición (fórmula mostrada en el
 * Panel_de_Procedencia) y el id de la Ficha_de_Fuente del catálogo que la
 * respalda. Las vigencias NO se escriben como literales aquí: se leen del
 * lago (`src/data/lake.ts`) para las métricas snapshot y del catálogo para
 * las fuentes consultadas en vivo, de modo que una reconstrucción del lago
 * se refleje sin tocar este módulo.
 */

import { catalogById } from "@/lib/catalog";
import { poblacion, territorio, verde } from "@/data/lake";
import type { MetricId } from "@/lib/types";

// Reexporta los tipos centrales (no se redeclaran: viven en `@/lib/types`).
export type { MetricId, ProvenanceRef, Origin, SourceState } from "@/lib/types";

// ── Definición de métrica ────────────────────────────────────

export interface MetricDef {
  id: MetricId;
  label: string;
  unit: string;
  /** Fórmula o definición mostrada en el Panel_de_Procedencia. */
  definition: string;
  /** Id de la Ficha_de_Fuente del catálogo que respalda la métrica. */
  sourceId: string;
  /** Vigencia tomada del lago/catálogo al construir METRICS (no literal en vistas). */
  vigencia?: string;
}

/**
 * Vigencia de una fuente consultada en vivo: la del catálogo (p. ej.
 * "tiempo real"). Para las métricas snapshot se usan las cifras del lago.
 */
function vigenciaCatalogo(sourceId: string): string | undefined {
  return catalogById[sourceId]?.vigencia;
}

// Vigencias leídas del lago (una cifra representativa por tema). Así una
// reconstrucción otro día no obliga a editar este módulo.
const vigPoblacion = poblacion.cifras.poblacion_total.vigencia;
const vigTerritorio = territorio.cifras.superficie_total.vigencia;
const vigVerde = verde.cifras.superficie_bloques_total.vigencia;

/** Definición única de cada métrica (Record por MetricId). */
export const METRICS: Record<MetricId, MetricDef> = {
  population: {
    id: "population",
    label: "Población",
    unit: "hab",
    definition: "Σ residentes de los bloques del distrito (Einwohnerdichte 2024)",
    sourceId: "ua-einwohnerdichte-2024",
    vigencia: vigPoblacion,
  },
  density: {
    id: "density",
    label: "Densidad",
    unit: "hab/km²",
    definition: "población ÷ superficie ALKIS (EPSG:25833)",
    sourceId: "alkis-bezirke",
    vigencia: vigTerritorio,
  },
  area: {
    id: "area",
    label: "Superficie",
    unit: "km²",
    definition: "superficie del distrito calculada sobre la geometría ALKIS (EPSG:25833)",
    sourceId: "alkis-bezirke",
    vigencia: vigTerritorio,
  },
  pctUnder18: {
    id: "pctUnder18",
    label: "% menor de 18",
    unit: "%",
    definition:
      "residentes de 0 a 17 años (grupos alter_u6, alter_6_u10, alter_10_u18) ÷ población con edad informada × 100",
    sourceId: "ua-einwohnerdichte-2024",
    vigencia: vigPoblacion,
  },
  pct65Plus: {
    id: "pct65Plus",
    label: "% 65 y más",
    unit: "%",
    definition:
      "residentes de 65 años o más (grupos alter_65_u70, alter_70_u75, alter75_u80, alter_80plus) ÷ población con edad informada × 100",
    sourceId: "ua-einwohnerdichte-2024",
    vigencia: vigPoblacion,
  },
  ageCoverage: {
    id: "ageCoverage",
    label: "Cobertura de edad",
    unit: "%",
    definition:
      "población de bloques con todos los grupos de edad informados ÷ población total del distrito × 100",
    sourceId: "ua-einwohnerdichte-2024",
    vigencia: vigPoblacion,
  },
  greenPct: {
    id: "greenPct",
    label: "% verde",
    unit: "%",
    definition:
      "Σ flalle de bloques con nutz 100 Wald, 130 Park/Grünfläche, 150 Friedhof, 160 Kleingarten, 172 y 173 Brache con vegetación ÷ Σ flalle de todos los bloques del distrito (superficie de bloques sin calles) × 100",
    sourceId: "ua-flaechennutzung-2020",
    vigencia: vigVerde,
  },
  aqiModel: {
    id: "aqiModel",
    label: "EAQI (modelo)",
    unit: "EAQI",
    definition: "EAQI del modelo CAMS (Open-Meteo) en el punto representativo del distrito",
    sourceId: "open-meteo-aire",
    vigencia: vigenciaCatalogo("open-meteo-aire"),
  },
  aqiStation: {
    id: "aqiStation",
    label: "EAQI (estación)",
    unit: "EAQI",
    definition:
      "EAQI calculado con los contaminantes horarios (PM2.5, PM10, NO₂, O₃) de la estación del Luftgütemessnetz",
    sourceId: "luftguetemessnetz",
    vigencia: vigenciaCatalogo("luftguetemessnetz"),
  },
  traffic: {
    id: "traffic",
    label: "Tráfico",
    unit: "veh/h",
    definition:
      "media horaria de vehículos (qkfz) de los detectores de la ciudad (perfil típico del mes integrado)",
    sourceId: "verkehrsdetektion",
    vigencia: vigenciaCatalogo("verkehrsdetektion"),
  },
  bikes: {
    id: "bikes",
    label: "Bicis disponibles",
    unit: "bicis",
    definition: "Σ bicicletas disponibles por estación del feed GBFS de nextbike",
    sourceId: "nextbike-gbfs",
    vigencia: vigenciaCatalogo("nextbike-gbfs"),
  },
  temperature: {
    id: "temperature",
    label: "Temperatura",
    unit: "°C",
    definition: "temperatura del aire a 2 m del modelo Open-Meteo en el punto del distrito",
    sourceId: "open-meteo-meteo",
    vigencia: vigenciaCatalogo("open-meteo-meteo"),
  },
};
