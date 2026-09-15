/** Utilidades de formato y clasificación para la UI. */

export interface Tone {
  label: string;
  /** Clases Tailwind de texto. */
  text: string;
  /** Clases Tailwind de fondo. */
  bg: string;
}

/** Clasifica un valor AQI en una categoría con colores. */
export function aqiTone(aqi: number): Tone {
  if (aqi <= 50)
    return { label: "Buena", text: "text-signal-good", bg: "bg-signal-good/10" };
  if (aqi <= 100)
    return { label: "Moderada", text: "text-signal-warn", bg: "bg-signal-warn/10" };
  if (aqi <= 150)
    return {
      label: "Dañina (grupos sensibles)",
      text: "text-orange-400",
      bg: "bg-orange-400/10",
    };
  return { label: "Dañina", text: "text-signal-bad", bg: "bg-signal-bad/10" };
}

/** Abrevia números grandes: 384172 → "384,2k". */
export function abbreviate(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** Formatea una hora entera (0-23) a "HH:00". */
export function formatHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}
