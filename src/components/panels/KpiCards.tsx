"use client";

import type { Kpi } from "@/lib/types";
import { OriginBadge } from "@/components/provenance/OriginBadge";
import { ProvenanceButton } from "@/components/provenance/ProvenanceButton";
import { EaqiInfoButton } from "@/components/eaqi/EaqiInfoButton";

const TONE_CLASS: Record<NonNullable<Kpi["tone"]>, string> = {
  good: "text-signal-good",
  warn: "text-signal-warn",
  bad: "text-signal-bad",
  neutral: "text-accent",
};

/**
 * Rejilla de tarjetas KPI (`Kpi[]` de `buildAnalytics`). Cada tarjeta muestra
 * valor, unidad, nota, vigencia, `OriginBadge(origin)` y `ProvenanceButton`.
 * El KPI de aire (`eaqi: true`) añade un `EaqiInfoButton` junto al valor. Sin
 * flechas de tendencia ni delta (el tipo `Kpi` ya no los tiene).
 */
export function KpiCards({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {kpis.map((kpi) => (
        <div
          key={kpi.id}
          className="rounded-lg border border-base-500/40 bg-base-700/50 px-3 py-2.5"
        >
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">
            <span>{kpi.label}</span>
            <span className="ml-auto flex items-center gap-1">
              <OriginBadge origin={kpi.origin} compact />
              <ProvenanceButton provenance={kpi.provenance} />
            </span>
          </div>

          <div className="mt-0.5 flex items-baseline gap-1">
            <span className={`text-xl font-semibold ${TONE_CLASS[kpi.tone ?? "neutral"]}`}>
              {kpi.value}
            </span>
            {kpi.unit && <span className="text-xs text-slate-400">{kpi.unit}</span>}
            {kpi.eaqi && <EaqiInfoButton />}
          </div>

          {kpi.note && (
            <div className="mt-0.5 text-[10px] leading-tight text-slate-400">{kpi.note}</div>
          )}
          {kpi.vigencia && (
            <div className="mt-0.5 text-[10px] text-slate-500">vigencia {kpi.vigencia}</div>
          )}
        </div>
      ))}
    </div>
  );
}
