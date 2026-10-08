"use client";

import { CATALOG } from "@/lib/catalog";
import { DISTRICT_LIST } from "@/data/districts";
import { buildGaps, type Gap, type GapKind } from "@/lib/gaps";

/**
 * Lista_de_Huecos (Requisito 19): enumera las métricas retiradas o sin fuente
 * y las fuentes caídas, con su motivo, para dejar explícitos los límites del
 * tablero. Los huecos los calcula `buildGaps(CATALOG, DISTRICT_LIST)`.
 */

const KIND_LABEL: Record<GapKind, string> = {
  "metrica-retirada": "sin fuente",
  "cobertura-parcial": "parcial",
  "fuente-caida": "fuente caída",
};

const KIND_CLASS: Record<GapKind, string> = {
  "metrica-retirada": "border-base-500/60 bg-base-700/60 text-slate-400",
  "cobertura-parcial": "border-amber-500/50 bg-amber-500/10 text-amber-300",
  "fuente-caida": "border-signal-bad/40 bg-signal-bad/10 text-signal-bad",
};

export function GapsList() {
  const gaps: Gap[] = buildGaps(CATALOG, DISTRICT_LIST);
  if (gaps.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        Huecos y límites de datos
      </h2>
      <ul className="space-y-2">
        {gaps.map((gap) => (
          <li
            key={gap.id}
            className="rounded-lg border border-base-500/40 bg-base-700/40 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-200">{gap.titulo}</span>
              <span
                className={`ml-auto inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] ${KIND_CLASS[gap.kind]}`}
              >
                {KIND_LABEL[gap.kind]}
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-tight text-slate-400">{gap.motivo}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
