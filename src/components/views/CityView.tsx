"use client";

import dynamic from "next/dynamic";
import { LayerController } from "@/components/panels/LayerController";
import { TimelineControl } from "@/components/panels/TimelineControl";
import { SourceBadges } from "@/components/panels/SourceBadges";

// El mapa se carga solo en cliente (WebGL / MapLibre / Deck.gl).
const MapContainer = dynamic(
  () => import("@/components/map/MapContainer").then((m) => m.MapContainer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-base-900 text-sm text-slate-500">
        Inicializando gemelo digital…
      </div>
    ),
  },
);

/**
 * Vista principal "Ciudad": el mapa 3D ocupa todo el espacio y a la izquierda
 * un panel compacto con el menú de selección de capas. La visualización del
 * mapa es la protagonista; la analítica y las fuentes viven en otras pestañas.
 */
export function CityView({ sidebarOpen }: { sidebarOpen: boolean }) {
  return (
    <div className="relative flex h-full flex-1 overflow-hidden">
      <aside
        className={`absolute left-0 top-0 z-20 flex h-full w-[320px] max-w-[85vw] flex-col border-r border-base-500/50 bg-base-800/90 backdrop-blur transition-transform duration-300 md:relative md:z-auto md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <SourceBadges />
          <LayerController />
        </div>
      </aside>

      <main className="relative flex-1">
        <MapContainer />

        {/* Control de línea de tiempo flotante en la parte inferior. */}
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 w-[min(560px,calc(100%-2rem))] -translate-x-1/2 md:left-[calc(50%+160px)]">
          <TimelineControl />
        </div>
      </main>
    </div>
  );
}
