/**
 * Resolución de procedencia contra el catálogo y atribuciones por licencia.
 *
 * `resolveProvenance` convierte una Referencia_de_Procedencia (métrica +
 * origen + vigencia/probado/fetchedAt) en una Tarjeta_de_Procedencia completa
 * buscando la Ficha_de_Fuente en el catálogo. `attributionsFor` y
 * `footerSources` derivan los textos de atribución a partir de la licencia
 * literal de cada ficha. Es la única pieza que decide la insignia "simulado".
 */

import { catalogById, CATALOG, type SourceCard } from "@/lib/catalog";
import { METRICS, type MetricDef } from "@/lib/metrics";
import type { MetricId, Origin, ProvenanceRef, SourceState } from "@/lib/types";

// Reexporta los tipos centrales (no se redeclaran: viven en `@/lib/types`).
export type { Origin, ProvenanceRef, SourceState, MetricId } from "@/lib/types";

// ── Tarjeta de procedencia ───────────────────────────────────

export interface ProvenanceCard {
  metric: MetricDef;
  source: {
    id: string;
    nombre: string;
    url: string;
    licencia: string;
    entidad: string;
  };
  origin: Origin;
  originLabel: string;
  vigencia: string | null;
  probado: string | null;
  fetchedAt: string | null;
}

/**
 * Resuelve la procedencia de un valor contra el catálogo.
 * Devuelve `null` si el id de fuente de la métrica no existe en el catálogo.
 */
export function resolveProvenance(ref: ProvenanceRef): ProvenanceCard | null {
  const metric = METRICS[ref.metric];
  if (!metric) return null;
  const card = catalogById[metric.sourceId];
  if (!card) return null;

  return {
    metric,
    source: {
      id: card.id,
      nombre: card.nombre,
      url: card.url,
      licencia: card.licencia,
      entidad: card.entidad,
    },
    origin: ref.origin,
    originLabel: originLabel(ref.origin),
    // La vigencia de la referencia tiene prioridad; si no, la de la métrica.
    vigencia: ref.vigencia ?? metric.vigencia ?? null,
    probado: ref.probado ?? null,
    fetchedAt: ref.fetchedAt ?? null,
  };
}

// ── Etiquetas e insignias de origen ──────────────────────────

/** Etiqueta legible del Origen_de_Dato. */
export function originLabel(o: Origin): string {
  switch (o) {
    case "snapshot":
      return "snapshot del lago";
    case "live":
      return "en vivo";
    case "mock":
      return "simulado";
    case "example":
      return "datos de ejemplo (sin fuente)";
  }
}

/**
 * Insignia de origen para `OriginBadge`. `simulated` es `true` y el texto es
 * "⚠ simulado" solo para `mock` (11.12); el resto usa su etiqueta neutra.
 */
export function originBadge(o: Origin): { text: string; simulated: boolean } {
  if (o === "mock") return { text: "⚠ simulado", simulated: true };
  return { text: originLabel(o), simulated: false };
}

// ── Atribuciones por licencia ────────────────────────────────

// Textos literales de licencia tal como aparecen en el catálogo.
const DL_DE_BY = "Datenlizenz Deutschland – Namensnennung – Version 2.0";
const DL_DE_ZERO = "Datenlizenz Deutschland – Zero – Version 2.0";
const CC_BY_3_DE = "Creative Commons Namensnennung 3.0 Deutschland";
const OPEN_METEO_CC_BY_4 =
  "API data is offered under the Attribution 4.0 International license (CC BY 4.0)";
const OPENFREEMAP_OSM = "The license of this project is MIT. Map data is from OpenStreetMap.";

/**
 * Atribución requerida por la licencia de una ficha. Se decide sobre el texto
 * literal de la licencia del catálogo. `dl-de-zero-2.0` no exige atribución,
 * pero devuelve un texto no vacío para que toda fuente integrada lleve algo
 * que mostrar en el pie (18.6).
 */
function attributionFor(card: SourceCard): string {
  switch (card.licencia) {
    case DL_DE_BY:
      // SenMVKU es la entidad que publica las fuentes dl-de-by del proyecto.
      return "SenMVKU, Datenlizenz Deutschland – Namensnennung – Version 2.0";
    case CC_BY_3_DE:
      return "Amt für Statistik Berlin-Brandenburg, CC BY 3.0 DE";
    case OPEN_METEO_CC_BY_4:
      return "Open-Meteo, CC BY 4.0";
    case OPENFREEMAP_OSM:
      return "© OpenStreetMap contributors · OpenFreeMap";
    case DL_DE_ZERO:
      return "dl-de-zero-2.0 (sin atribución obligatoria)";
    default:
      // CC0, "no declara", etc.: sin atribución obligatoria, se nombra la fuente.
      return `${card.nombre} (sin atribución obligatoria)`;
  }
}

/**
 * Atribuciones requeridas por las fuentes usadas por una vista.
 * Una entrada por id existente en el catálogo, en el orden dado, sin repetir.
 */
export function attributionsFor(sourceIds: readonly string[]): string[] {
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const id of sourceIds) {
    const card = catalogById[id];
    if (!card) continue;
    const attribution = attributionFor(card);
    if (vistos.has(attribution)) continue;
    vistos.add(attribution);
    salida.push(attribution);
  }
  return salida;
}

// ── Pie de fuentes de la barra lateral ───────────────────────

export interface FooterSources {
  integrated: { id: string; nombre: string; url: string; attribution: string }[];
  notIntegrated: {
    id: string;
    nombre: string;
    url: string;
    estado: Exclude<SourceState, "integrado">;
  }[];
}

/**
 * Particiona TODO el catálogo (ordenado por id) en fuentes integradas (con su
 * atribución no vacía) y no integradas (con su estado). Las listas son
 * disjuntas y su unión es el catálogo (18.6–18.8). OpenAQ solo puede aparecer
 * en `notIntegrated` como `excluido`, porque su ficha no es `integrado`.
 */
export function footerSources(catalog: readonly SourceCard[]): FooterSources {
  const integrated: FooterSources["integrated"] = [];
  const notIntegrated: FooterSources["notIntegrated"] = [];

  const ordenado = [...catalog].sort((a, b) => a.id.localeCompare(b.id));
  for (const card of ordenado) {
    if (card.estado === "integrado") {
      integrated.push({
        id: card.id,
        nombre: card.nombre,
        url: card.url,
        attribution: attributionsFor([card.id])[0] ?? attributionFor(card),
      });
    } else {
      notIntegrated.push({
        id: card.id,
        nombre: card.nombre,
        url: card.url,
        estado: card.estado,
      });
    }
  }

  return { integrated, notIntegrated };
}

// Reexporta el catálogo para consumidores del pie que no quieran importar
// de dos módulos; `footerSources(CATALOG)` es el uso previsto en la barra.
export { CATALOG };
