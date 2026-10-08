"use client";

import { useCityStore } from "@/store/useCityStore";

/**
 * Control_de_Definición_EAQI: va junto a cada valor de EAQI y a cada etiqueta
 * de banda. Abre el único Panel_EAQI a través del store, pasando el disparador
 * para devolverle el foco al cerrar (10.16, 10.17).
 *
 * - `variant="button"` (por defecto): botón nativo accesible por teclado con
 *   nombre accesible. Es el único control real que abre el panel.
 * - `variant="hint"`: `<span aria-hidden>` solo decorativo para el tooltip
 *   flotante del mapa (que no es interactivo); no abre el panel.
 */
export function EaqiInfoButton({
  variant = "button",
}: {
  variant?: "button" | "hint";
}) {
  const openEaqiPanel = useCityStore((s) => s.openEaqiPanel);

  if (variant === "hint") {
    // Pista no interactiva para el tooltip de hover (pointer-events-none).
    return (
      <span
        aria-hidden="true"
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-base-500/60 text-[9px] leading-none text-slate-400"
      >
        ⓘ
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label="Definición del índice europeo de calidad del aire"
      onClick={(e) => openEaqiPanel(e.currentTarget)}
      className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-base-500/60 text-[9px] leading-none text-slate-400 transition hover:border-accent/60 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span aria-hidden="true">ⓘ</span>
    </button>
  );
}

export default EaqiInfoButton;
