"use client";

import { useEffect, useRef } from "react";
import type { TooltipContent, TooltipRow } from "@/lib/types";
import { useCityStore } from "@/store/useCityStore";
import { EaqiInfoButton } from "@/components/eaqi/EaqiInfoButton";
import { OriginBadge } from "@/components/provenance/OriginBadge";

/**
 * Tooltip del mapa en dos modos (Req. 10.11, 10.12, 10.16, 10.17, 11.10):
 *  - `hover`: tarjeta no interactiva (`pointer-events-none`) que sigue al
 *    puntero; muestra ⓘ como pista (`EaqiInfoButton variant="hint"`), la
 *    insignia compacta de origen y "Clic para fijar". Nunca es la única vía.
 *  - `pinned`: tarjeta interactiva (`role="dialog"` no modal) anclada por clic
 *    o teclado; foco al título, `Escape`/"Cerrar" la desfijan y un
 *    `EaqiInfoButton` real abre el Panel_EAQI.
 *
 * Ambos modos renderizan el mismo `TooltipContent` calculado por `tooltipFor`.
 */

/** Fila simulada: solo las de origen `mock` llevan la insignia "simulado". */
function rowIsMock(row: TooltipRow): boolean {
  return row.origin === "mock";
}

function Rows({ rows, interactive }: { rows: TooltipRow[]; interactive: boolean }) {
  return (
    <>
      {rows.map((row, i) => (
        <div key={i} className="flex items-center justify-between gap-2 text-slate-300">
          <span className="text-slate-400">{row.label}</span>
          <span className="flex items-center gap-1 font-medium text-slate-100">
            {row.value}
            {row.eaqi &&
              (interactive ? (
                <EaqiInfoButton />
              ) : (
                <span aria-hidden="true" className="text-slate-400">
                  ⓘ
                </span>
              ))}
            {rowIsMock(row) && <OriginBadge origin="mock" compact />}
            {row.example && (
              <span className="text-[10px] italic text-slate-500">
                datos de ejemplo (sin fuente)
              </span>
            )}
          </span>
        </div>
      ))}
    </>
  );
}

/** Tooltip flotante no interactivo que sigue al cursor. */
export function HoverTooltip({
  content,
  x,
  y,
}: {
  content: TooltipContent | null;
  x: number;
  y: number;
}) {
  if (!content) return null;
  return (
    <div
      className="pointer-events-none absolute z-30 max-w-xs rounded-lg border border-base-500/60 bg-base-800/95 px-3 py-2 text-xs shadow-panel backdrop-blur"
      style={{ left: x + 14, top: y + 14 }}
    >
      <div className="mb-1 font-semibold text-accent">{content.title}</div>
      <Rows rows={content.rows} interactive={false} />
      <div className="mt-1 text-[10px] italic text-slate-500">Clic para fijar</div>
    </div>
  );
}

/** Tarjeta interactiva fijada por clic o teclado. */
export function PinnedTooltipCard({ content }: { content: TooltipContent | null }) {
  const pinned = useCityStore((s) => s.pinned);
  const unpin = useCityStore((s) => s.unpin);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Al fijar, el foco va al título; Escape desfija y devuelve el foco.
  useEffect(() => {
    if (!pinned || !content) return;
    titleRef.current?.focus();
  }, [pinned, content]);

  useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        const back = pinned.returnFocusTo;
        unpin();
        back?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pinned, unpin]);

  // Si el objeto desaparece del dataset, se desfija.
  useEffect(() => {
    if (pinned && !content) unpin();
  }, [pinned, content, unpin]);

  if (!pinned || !content) return null;

  const close = () => {
    const back = pinned.returnFocusTo;
    unpin();
    back?.focus();
  };

  // Anclaje limitado al viewport (margen de 12 px por el ancho de la tarjeta).
  const left = Math.max(8, Math.min(pinned.anchor.x, window.innerWidth - 260));
  const top = Math.max(8, Math.min(pinned.anchor.y, window.innerHeight - 160));

  return (
    <div
      role="dialog"
      aria-labelledby="pinned-tooltip-title"
      className="absolute z-40 max-w-xs rounded-lg border border-base-500/60 bg-base-800/98 px-3 py-2 text-xs shadow-panel backdrop-blur"
      style={{ left, top }}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3
          id="pinned-tooltip-title"
          ref={titleRef}
          tabIndex={-1}
          className="font-semibold text-accent outline-none"
        >
          {content.title}
        </h3>
        <button
          type="button"
          onClick={close}
          aria-label="Cerrar"
          className="rounded px-1 text-slate-400 hover:bg-base-600 hover:text-slate-100 focus-visible:ring focus-visible:ring-accent"
        >
          ✕
        </button>
      </div>
      <Rows rows={content.rows} interactive />
    </div>
  );
}
