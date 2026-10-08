"use client";

import { useEffect, useRef } from "react";
import { useCityStore } from "@/store/useCityStore";
import { EaqiLegend } from "./EaqiLegend";

/**
 * Panel_EAQI: único diálogo que explica el EAQI, abierto por cualquier
 * EaqiInfoButton (10.9). `role="dialog"`, `aria-modal`, `aria-labelledby` al
 * título; al abrir el foco va al botón de cierre y `Escape`/cerrar devuelven
 * el foco al disparador guardado en el store (`returnFocusTo`).
 *
 * Se apila sobre otros diálogos con un z-index mayor; su `Escape` cierra solo
 * este panel porque detiene la propagación del evento (10.16).
 */
export function EaqiPanel() {
  const open = useCityStore((s) => s.eaqiPanel.open);
  const closeEaqiPanel = useCityStore((s) => s.closeEaqiPanel);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = "eaqi-panel-title";

  // Foco al botón de cierre al abrir.
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          // Cierra solo el panel superior (el EAQI se apila sobre otros).
          e.stopPropagation();
          closeEaqiPanel();
        }
      }}
    >
      {/* Clic fuera cierra el panel. */}
      <div className="absolute inset-0" onClick={closeEaqiPanel} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 max-h-[80vh] w-[min(560px,100%)] overflow-y-auto rounded-xl border border-base-500/60 bg-base-800 p-5 shadow-panel"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-base font-semibold text-slate-100">
            Índice europeo de calidad del aire (EAQI)
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={closeEaqiPanel}
            aria-label="Cerrar"
            className="rounded-md px-2 py-0.5 text-slate-400 transition hover:bg-base-600 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            ✕
          </button>
        </div>

        <EaqiLegend />
      </div>
    </div>
  );
}
