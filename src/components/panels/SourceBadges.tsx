"use client";

import { useCityData } from "@/hooks/useCityData";
import { originLabel } from "@/lib/provenance";
import type { BlockId, Origin } from "@/lib/types";

/** Insignia de Origen_de_Dato por bloque, usando `originLabel`. */
export function SourceBadges() {
  const { data } = useCityData();
  if (!data) return null;

  const entries: [string, BlockId][] = [
    ["Distritos", "districts"],
    ["Tráfico", "traffic"],
    ["Transporte", "transit"],
    ["Aire", "air"],
    ["Clima", "weather"],
    ["Bicis", "bikes"],
  ];

  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([label, block]) => {
        const origin: Origin = data.source[block];
        const live = origin === "live";
        return (
          <span
            key={block}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${
              live
                ? "border-signal-good/40 bg-signal-good/10 text-signal-good"
                : "border-base-500/60 bg-base-700/60 text-slate-400"
            }`}
            title={originLabel(origin)}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                live ? "animate-pulseSoft bg-signal-good" : "bg-slate-500"
              }`}
            />
            {label}: {originLabel(origin)}
          </span>
        );
      })}
    </div>
  );
}
