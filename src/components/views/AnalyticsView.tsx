"use client";

import dynamic from "next/dynamic";
import { useCityData } from "@/hooks/useCityData";
import { useCityStore } from "@/store/useCityStore";

// recharts accede a React.useContext al cargarse; si se renderiza en el
// servidor durante el prerender estático, falla. El dashboard es puramente de
// cliente, así que se carga con ssr:false, igual que el mapa.
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

/**
 * Vista "Análisis": el dashboard de KPIs y gráficas, centrado y con un ancho
 * cómodo de lectura. Separado del mapa para que el análisis tenga su propio
 * espacio sin competir con la visualización de la ciudad.
 */
export function AnalyticsView() {
  const { data } = useCityData();
  const selectedHour = useCityStore((s) => s.selectedHour);

  return (
    <div className="h-full flex-1 overflow-y-auto bg-base-900">
      <div className="mx-auto w-full max-w-5xl p-4 md:p-6">
        <header className="mb-4">
          <h1 className="text-lg font-semibold text-slate-100">Dashboard · Analítica</h1>
          <p className="text-xs text-slate-400">
            KPIs, series temporales y comparativas por distrito del gemelo digital.
          </p>
        </header>
        <AnalyticsPanel data={data} hour={selectedHour} />
      </div>
    </div>
  );
}
