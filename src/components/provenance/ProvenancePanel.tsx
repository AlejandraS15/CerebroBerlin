"use client";

import { useEffect, useRef } from "react";
import { useCityStore } from "@/store/useCityStore";
import { resolveProvenance } from "@/lib/provenance";
import { OriginBadge } from "./OriginBadge";
import { EaqiInfoButton } from "@/components/eaqi/EaqiInfoButton";

/**
 * Panel_de_Procedencia: único diálogo que muestra, a un clic de una cifra, la
 * fuente (nombre y url), licencia, definición, Vigencia y Fecha_Probado o
 * momento de consulta, con `OriginBadge` del origen. Abierto desde el store
 * por `ProvenanceButton` (17.1, 17.3).
 *
 * `role="dialog"`, `aria-modal`, `aria-labelledby`; foco al botón de cierre al
 * abrir; `Escape`/cerrar devuelven el foco al disparador (vía store). Para las
 * métricas de EAQI (aqiModel/aqiStation) no repite la definición: incluye un
 * EaqiInfoButton que lleva al Panel_EAQI.
 */
export function ProvenancePanel() {
  const ref = useCityStore((s) => s.provenance);
  const closeProvenance = useCityStore((s) => s.closeProvenance);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = "provenance-panel-title";

  useEffect(() => {
    if (ref) closeRef.current?.focus();
  }, [ref]);

  if (!ref) return null;

  const card = resolveProvenance(ref);
  if (!card) return null;

  const isEaqi = card.metric.id === "aqiModel" || card.metric.id === "aqiStation";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          closeProvenance();
        }
      }}
    >
      <div className="absolute inset-0" onClick={closeProvenance} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 max-h-[80vh] w-[min(460px,100%)] overflow-y-auto rounded-xl border border-base-500/60 bg-base-800 p-5 shadow-panel"
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-accent">
              Procedencia
            </div>
            <h2 id={titleId} className="text-base font-semibold text-slate-100">
              {card.metric.label}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={closeProvenance}
            aria-label="Cerrar"
            className="rounded-md px-2 py-0.5 text-slate-400 transition hover:bg-base-600 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            ✕
          </button>
        </div>

        <dl className="space-y-3 text-sm">
          {/* Para EAQI no se repite la definición: se enlaza el Panel_EAQI. */}
          {isEaqi ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Definición</dt>
              <dd className="mt-0.5 flex items-center gap-1 text-slate-200">
                Índice europeo de calidad del aire
                <EaqiInfoButton />
              </dd>
            </div>
          ) : (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Definición</dt>
              <dd className="mt-0.5 text-slate-200">{card.metric.definition}</dd>
            </div>
          )}

          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Fuente</dt>
            <dd className="mt-0.5 text-slate-200">
              <a
                href={card.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline decoration-dotted underline-offset-2 hover:text-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {card.source.nombre}
              </a>
              <span className="block text-xs text-slate-400">{card.source.entidad}</span>
            </dd>
          </div>

          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Licencia</dt>
            <dd className="mt-0.5 text-slate-300">{card.source.licencia}</dd>
          </div>

          {card.vigencia && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Vigencia</dt>
              <dd className="mt-0.5 text-slate-300">{card.vigencia}</dd>
            </div>
          )}

          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">
              {card.probado ? "Fecha probado" : "Consultado"}
            </dt>
            <dd className="mt-0.5 text-slate-300">
              {card.probado ?? formatFetchedAt(card.fetchedAt)}
            </dd>
          </div>

          <div className="flex items-center gap-2">
            <dt className="text-xs uppercase tracking-wide text-slate-400">Origen</dt>
            <dd>
              <OriginBadge origin={card.origin} />
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

/** Momento de consulta legible; "—" si no hay. */
function formatFetchedAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("es");
}
