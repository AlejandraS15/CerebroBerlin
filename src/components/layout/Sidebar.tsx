"use client";

import dynamic from "next/dynamic";
import { LayerController } from "@/components/panels/LayerController";
import { GapsList } from "@/components/panels/GapsList";
import { SourcesFooter } from "./SourcesFooter";
import { useCityData } from "@/hooks/useCityData";
import { useCityStore } from "@/store/useCityStore";
import { originLabel } from "@/lib/provenance";
import type { BlockId, Origin } from "@/lib/types";

// recharts accede a React.useContext al cargarse; si se renderiza en el
// servidor durante el prerender estático, falla ("Cannot read properties of
// null (reading 'useContext')"). El dashboard es puramente de cliente, así que
// se carga con ssr:false, igual que el mapa.
const AnalyticsPanel = dynamic(
  () => import("@/components/panels/AnalyticsPanel").then((m) => m.AnalyticsPanel),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border border-base-500/40 bg-base-700/40 p-6 text-center text-sm text-slate-400">
        Cargando analítica…
      </div>
    ),
  },
);

/** Panel lateral: fuentes, control de capas, analítica, huecos y pie. */
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
        <GapsList />
      </div>
      <footer className="border-t border-base-500/40 px-4 py-3">
        <SourcesFooter />
      </footer>
    </aside>
  );
}

/** Insignia de Origen_de_Dato por bloque, usando `originLabel`. */
function SourceBadges() {
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
