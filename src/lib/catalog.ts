/**
 * Catálogo de fuentes en la Aplicación: `catalogo/fuentes.json` importado en
 * tiempo de compilación y tipado como `SourceCard[]`.
 *
 * El Catálogo es la única fuente de metadatos de fuente (id, nombre, entidad,
 * url, estado, licencia, vigencia, …). La procedencia de cualquier cifra se
 * resuelve por el id de fuente contra este mismo Catálogo (ver `provenance.ts`).
 */

import fuentesJson from "@catalogo/fuentes.json";

import type { SourceState } from "@/lib/types";

// ── Ficha_de_Fuente ──────────────────────────────────────────

/** Una Ficha_de_Fuente del catálogo (los 13 campos de rastreo). */
export interface SourceCard {
  /** Identificador estable de la fuente (clave de resolución de procedencia). */
  id: string;
  nombre: string;
  /** Entidad responsable de los datos. */
  entidad: string;
  url: string;
  /** Descripción de la cobertura (p. ej. "12 distritos de Berlín"). */
  cobertura: string;
  /** Vigencia de los datos (año, mes o "tiempo real"). */
  vigencia: string;
  /** Fecha_Probado: día en que la fuente respondió (YYYY-MM-DD). */
  probado: string;
  /** Estado_de_Fuente. */
  estado: SourceState;
  /** Texto literal de la licencia tal como la declara la fuente. */
  licencia: string;
  /** Tratamiento de datos personales declarado. */
  personas: string;
  /** Medidas de protección (sin tilde a propósito para evitar problemas de claves). */
  proteccion: string;
  /** Uso en el proyecto; "en vivo:" marca consulta en tiempo de ejecución. */
  uso: string;
  /** Nota de rastreo (observaciones, códigos HTTP, decisiones). */
  nota: string;
}

/*
 * La inferencia de TypeScript sobre JSON ensancha `estado` a `string`; se
 * asegura hacia el contrato. La forma la garantiza el Verificador
 * (`verificacion/verificar.py`): 13 campos y `estado` dentro del dominio.
 */
/** Todas las Fichas_de_Fuente del catálogo (orden del JSON: por id). */
export const CATALOG: SourceCard[] = fuentesJson as SourceCard[];

/** Índice de fichas por id para resolución directa. */
export const catalogById: Record<string, SourceCard> = Object.fromEntries(
  CATALOG.map((card) => [card.id, card]),
);
