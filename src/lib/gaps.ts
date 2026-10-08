/**
 * Lista_de_Huecos: enumera las métricas retiradas o sin fuente y las fuentes
 * caídas, con su motivo, para que el usuario entienda los límites del tablero
 * (Requisito 19).
 *
 * `buildGaps(catalog, districts)` combina huecos fijos (métricas sin fuente
 * verificable) con huecos derivados de los datos (cobertura parcial de edad)
 * y del catálogo (fuentes `caído` cuya nota explica la indisponibilidad).
 */

import type { SourceCard } from "@/lib/catalog";
import type { District } from "@/lib/types";

// ── Modelo de hueco ──────────────────────────────────────────

/** Tipo de hueco, para agrupar y dar estilo en la vista. */
export type GapKind =
  | "metrica-retirada" // métrica mostrada antes sin fuente verificable
  | "cobertura-parcial" // dato real pero incompleto
  | "fuente-caida"; // fuente catalogada no disponible

/** Un hueco de la Lista_de_Huecos. */
export interface Gap {
  id: string;
  kind: GapKind;
  /** Métrica, capa o fuente afectada. */
  titulo: string;
  /** Por qué no hay dato (o por qué es parcial). */
  motivo: string;
  /** Id de la Ficha_de_Fuente relacionada, si procede. */
  sourceId?: string;
}

// ── Huecos fijos: métricas retiradas sin fuente ──────────────

// Métricas que el tablero mostraba y que ahora no tienen fuente verificable
// (19.1); se declaran como huecos en lugar de inventar valores.
const HUECOS_METRICAS: Gap[] = [
  {
    id: "edad-mediana",
    kind: "metrica-retirada",
    titulo: "Edad mediana por distrito",
    motivo:
      "Einwohnerdichte 2024 da grupos de edad agregados, no la mediana; no se calcula desde conteos por tramo sin microdatos.",
  },
  {
    id: "demanda-energetica",
    kind: "metrica-retirada",
    titulo: "Demanda energética",
    motivo: "Sin fuente oficial integrada; la cifra anterior era sintética y se retiró.",
  },
  {
    id: "uso-horario-bicis",
    kind: "metrica-retirada",
    titulo: "Uso horario de bicis",
    motivo:
      "El feed GBFS de nextbike da disponibilidad instantánea, no viajes por hora; no hay serie horaria de uso.",
  },
  {
    id: "puntos-criticos",
    kind: "metrica-retirada",
    titulo: "Puntos críticos (hotspots)",
    motivo: "Capa de datos de ejemplo sin fuente; oculta por defecto y etiquetada como ejemplo.",
  },
  {
    id: "infraestructura",
    kind: "metrica-retirada",
    titulo: "Infraestructura destacada",
    motivo: "Capa de datos de ejemplo sin fuente; oculta por defecto y etiquetada como ejemplo.",
  },
];

// ── Fuentes caídas que se declaran como huecos ───────────────

// Ids de fuentes cuya indisponibilidad debe aparecer en la Lista_de_Huecos
// (19.2): VBB transport.rest (transporte) y Einwohner LOR CSV (F05).
const FUENTES_CAIDAS_RELEVANTES = ["vbb-transport-rest", "einwohner-lor-f05"] as const;

/** Umbral: por debajo de este % la cobertura de edad se marca como parcial. */
const COBERTURA_EDAD_COMPLETA = 100;

/**
 * Construye la Lista_de_Huecos a partir del catálogo y de los distritos.
 *
 * - Métricas retiradas sin fuente (edad mediana, demanda energética, uso
 *   horario de bicis, puntos críticos, infraestructura).
 * - Cobertura parcial de edad: distritos cuyo `ageCoveragePct` < 100 %.
 * - Fuentes `caído` relevantes (VBB transport.rest y Einwohner LOR CSV), con
 *   el motivo tomado de la nota del catálogo.
 */
export function buildGaps(
  catalog: readonly SourceCard[],
  districts: readonly District[],
): Gap[] {
  const huecos: Gap[] = [...HUECOS_METRICAS];

  // Cobertura parcial de edad: se deriva de los datos reales del lago.
  const parciales = districts.filter((d) => d.ageCoveragePct < COBERTURA_EDAD_COMPLETA);
  if (parciales.length > 0) {
    const minima = Math.min(...parciales.map((d) => d.ageCoveragePct));
    huecos.push({
      id: "cobertura-edad",
      kind: "cobertura-parcial",
      titulo: "Cobertura de edad parcial",
      motivo:
        `${parciales.length} de ${districts.length} distritos tienen bloques sin desglose de edad; ` +
        `cobertura mínima ${minima} %. Los % de edad se calculan solo sobre la población con edad informada.`,
      sourceId: "ua-einwohnerdichte-2024",
    });
  }

  // Fuentes caídas relevantes: el motivo es la nota del catálogo.
  const porId = new Map(catalog.map((c) => [c.id, c]));
  for (const id of FUENTES_CAIDAS_RELEVANTES) {
    const card = porId.get(id);
    if (!card) continue;
    huecos.push({
      id: `fuente-caida-${id}`,
      kind: "fuente-caida",
      titulo: `${card.nombre} no disponible`,
      motivo: card.nota || `Fuente en estado "${card.estado}"; no integrada.`,
      sourceId: card.id,
    });
  }

  return huecos;
}
