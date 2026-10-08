"use client";

import type { Origin } from "@/lib/types";
import { originBadge } from "@/lib/provenance";

/**
 * Insignia de Origen_de_Dato compartida. Usa `originBadge(origin)`:
 * - `mock` → "⚠ simulado" destacado en ámbar rayado con borde (11.9–11.12).
 * - resto → etiqueta neutra con `originLabel`.
 *
 * Siempre lleva texto, nunca solo color (WCAG). Con `compact` solo se
 * renderiza cuando el valor es simulado (para marcar únicamente lo mock sin
 * ocupar espacio en el resto de los valores).
 */
export function OriginBadge({
  origin,
  compact = false,
}: {
  origin: Origin;
  compact?: boolean;
}) {
  const { text, simulated } = originBadge(origin);

  // En modo compacto, los orígenes no simulados no muestran insignia.
  if (compact && !simulated) return null;

  if (simulated) {
    return (
      <span
        // Fondo rayado ámbar + borde para que destaque sin depender del color.
        className="inline-flex items-center gap-1 rounded border border-amber-500/60 bg-[repeating-linear-gradient(45deg,rgba(245,158,11,0.18)_0,rgba(245,158,11,0.18)_4px,transparent_4px,transparent_8px)] px-1.5 py-0.5 text-[10px] font-medium text-amber-300"
        title="Valor simulado (sin fuente en vivo)"
      >
        {text}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded border border-base-500/60 bg-base-700/60 px-1.5 py-0.5 text-[10px] text-slate-400">
      {text}
    </span>
  );
}
