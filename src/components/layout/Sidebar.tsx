"use client";

import { LayerController } from "@/components/panels/LayerController";
import { AnalyticsPanel } from "@/components/panels/AnalyticsPanel";
import { useCityData } from "@/hooks/useCityData";
import { useCityStore } from "@/store/useCityStore";

/** Panel lateral: control de capas + dashboard de analítica. */
export function Sidebar({ open }: { open: boolean }) {
  const { data } = useCityData();
  const selectedHour = useCityStore((s) => s.selectedHour);

  return (
    <aside
      className={`absolute left-0 top-0 z-20 flex h-full w-[360px] max-w-[85vw] flex-col border-r border-base-500/50 bg-base-800/90 backdrop-blur transition-transform duration-300 md:relative md:z-auto md:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <SourceBadges />
        <LayerController />
        <AnalyticsPanel data={data} hour={selectedHour} />
      </div>
      <footer className="border-t border-base-500/40 px-4 py-2 text-[10px] text-slate-500">
        Datos: daten.berlin.de · VBB · OpenAQ · OSM · GBFS
      </footer>
    </aside>
  );
}

/** Indicadores de si cada fuente es "live" o "mock". */
function SourceBadges() {
  const { data } = useCityData();
  if (!data) return null;
  const entries: [string, "live" | "mock"][] = [
    ["Transporte", data.source.transit],
    ["Aire", data.source.air],
    ["Bicis", data.source.bikes],
    ["Distritos", data.source.districts],
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([label, src]) => (
        <span
          key={label}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${
            src === "live"
              ? "border-signal-good/40 bg-signal-good/10 text-signal-good"
              : "border-base-500/60 bg-base-700/60 text-slate-400"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              src === "live" ? "animate-pulseSoft bg-signal-good" : "bg-slate-500"
            }`}
          />
          {label}
        </span>
      ))}
    </div>
  );
}
