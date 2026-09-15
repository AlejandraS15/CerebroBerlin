"use client";

import type { Kpi } from "@/lib/types";

const TONE_CLASS: Record<NonNullable<Kpi["tone"]>, string> = {
  good: "text-signal-good",
  warn: "text-signal-warn",
  bad: "text-signal-bad",
  neutral: "text-accent",
};

const TREND_ICON: Record<NonNullable<Kpi["trend"]>, string> = {
  up: "▲",
  down: "▼",
  flat: "▬",
};

/** Rejilla de tarjetas KPI en tiempo real. */
export function KpiCards({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {kpis.map((kpi) => (
        <div
          key={kpi.id}
          className="rounded-lg border border-base-500/40 bg-base-700/50 px-3 py-2.5"
        >
          <div className="text-[10px] uppercase tracking-wide text-slate-400">
            {kpi.label}
          </div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className={`text-xl font-semibold ${TONE_CLASS[kpi.tone ?? "neutral"]}`}>
              {kpi.value}
            </span>
            {kpi.unit && (
              <span className="text-xs text-slate-400">{kpi.unit}</span>
            )}
          </div>
          {kpi.delta && (
            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
              {kpi.trend && (
                <span className={TONE_CLASS[kpi.tone ?? "neutral"]}>
                  {TREND_ICON[kpi.trend]}
                </span>
              )}
              <span>{kpi.delta}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
