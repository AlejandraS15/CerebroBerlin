"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { LayerController } from "@/components/panels/LayerController";
import { SourceBadges } from "@/components/panels/SourceBadges";
import { useCityStore } from "@/store/useCityStore";
import { useTimelinePlayer } from "@/hooks/useTimelinePlayer";

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
  const setSelectedDistrict = useCityStore((s) => s.setSelectedDistrict);

  // Se retiró el control visible de línea de tiempo del mapa, pero se mantiene
  // la lógica horaria: la hora se sincroniza con la de Berlín al montar, de modo
  // que las capas que dependen de la hora (p. ej. el tráfico) reflejan la hora
  // real. El dashboard de Analítica conserva el estado de la hora.
  useTimelinePlayer();

  // Al cerrar el panel lateral se deselecciona la provincia, de modo que el
  // distrito recupera su color normal y el popup de detalle se cierra.
  useEffect(() => {
    if (!sidebarOpen) setSelectedDistrict(null);
  }, [sidebarOpen, setSelectedDistrict]);

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
      </main>
    </div>
  );
}
