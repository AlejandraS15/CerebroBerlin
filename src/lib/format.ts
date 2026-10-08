/** Utilidades de formato y clasificación para la UI. */

import { eaqiBand, type EaqiBand, type EaqiTone } from "./eaqi";

/** Texto para un valor individual ausente (p. ej. un contaminante). */
export const NO_VALUE = "sin dato";
/** Texto para una cifra agregada o un índice ausente (p. ej. EAQI, KPI). */
export const NO_DATA = "sin datos";

export interface Tone {
  /**
   * Etiqueta de la Banda_EAQI ("sin datos" si no hay valor).
   * Solo la renderiza `EaqiBandLabel`; las vistas no la imprimen directamente.
   */
  label: string;
  /** Clases Tailwind de texto. */
  text: string;
  /** Clases Tailwind de fondo. */
  bg: string;
  /** Color hexadecimal de la banda (paleta EEA) o gris neutro sin valor. */
  color: string;
  /** Banda EAQI de origen; `null` si no hay valor. */
  band: EaqiBand | null;
}

/**
 * Clases por banda escritas como literales completos para que Tailwind
 * las detecte. Fondos con `EAQI_BANDS[].color`; el texto de "Muy mala" y
 * "Extremadamente mala" usa un tono más claro para contrastar con el fondo oscuro.
 */
const TONE_CLASSES: Readonly<Record<EaqiTone, { text: string; bg: string }>> = {
  good: { text: "text-[#50f0e6]", bg: "bg-[#50f0e6]/10" },
  fair: { text: "text-[#50ccaa]", bg: "bg-[#50ccaa]/10" },
  moderate: { text: "text-[#f0e641]", bg: "bg-[#f0e641]/10" },
  poor: { text: "text-[#ff5050]", bg: "bg-[#ff5050]/10" },
  veryPoor: { text: "text-[#e0457b]", bg: "bg-[#960032]/20" },
  extreme: { text: "text-[#c77dd0]", bg: "bg-[#7d2181]/20" },
};

const NO_DATA_TONE: Omit<Tone, "band"> = {
  label: NO_DATA,
  text: "text-slate-400",
  bg: "bg-slate-400/10",
  color: "#94a3b8",
};

/**
 * Clasifica un valor EAQI en su Banda_EAQI (delegando en `eaqiBand`).
 * `null` o no finito → tono neutro "sin datos". 0 es un EAQI válido ("Buena").
 */
export function aqiTone(v: number | null): Tone {
  const band = eaqiBand(v);
  if (band === null) return { ...NO_DATA_TONE, band: null };
  const cls = TONE_CLASSES[band.tone];
  return { label: band.label, text: cls.text, bg: cls.bg, color: band.color, band };
}

export interface NullableFormat {
  /** Texto si no hay valor. Por defecto "sin datos"; usar `NO_VALUE` para contaminantes. */
  empty?: string;
  /** Decimales fijos; si se omite se usa `String(v)`. */
  digits?: number;
  /** Unidad añadida tras un espacio (p. ej. "µg/m³"). */
  unit?: string;
}

/**
 * Formatea un número que puede faltar. Comprueba `!= null` y
 * `Number.isFinite`, nunca veracidad: `formatNullable(0)` → "0".
 */
export function formatNullable(
  v: number | null | undefined,
  { empty = NO_DATA, digits, unit }: NullableFormat = {},
): string {
  if (v == null || !Number.isFinite(v)) return empty;
  const s = digits === undefined ? String(v) : v.toFixed(digits);
  return unit ? `${s} ${unit}` : s;
}

/** Abrevia números grandes: 384172 → "384.2k". */
export function abbreviate(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** Formatea una hora entera (0-23) a "HH:00". */
export function formatHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}
