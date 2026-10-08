"use client";

import { useCityStore } from "@/store/useCityStore";
import { METRICS } from "@/lib/metrics";
import type { ProvenanceRef } from "@/lib/types";

/**
 * Control de procedencia junto a una cifra. Botón nativo accesible por
 * teclado con `aria-label="Procedencia de <métrica>"` que abre el
 * Panel_de_Procedencia a través del store (`openProvenance(ref, trigger)`),
 * pasando el elemento disparador para devolver el foco al cerrar.
 */
export function ProvenanceButton({ provenance }: { provenance: ProvenanceRef }) {
  const openProvenance = useCityStore((s) => s.openProvenance);
  const label = METRICS[provenance.metric]?.label ?? provenance.metric;

  // Contrato acordado: `openProvenance(ref, trigger?)`. El store del otro
  // agente aún expone solo `openProvenance(ref)`; se pasa el disparador cuando
  // la firma lo acepte (el segundo argumento se ignora si no está tipado).
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={`Procedencia de ${label}`}
      onClick={(e) =>
        (openProvenance as (ref: ProvenanceRef, trigger?: HTMLElement | null) => void)(
          provenance,
          e.currentTarget,
        )
      }
      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-base-500/60 text-[9px] leading-none text-slate-400 transition hover:border-accent/60 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {/* Icono de fuente/procedencia; el nombre accesible va en aria-label. */}
      <span aria-hidden="true">ⓕ</span>
    </button>
  );
}
