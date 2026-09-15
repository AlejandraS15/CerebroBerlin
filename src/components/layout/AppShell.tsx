"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { TimelineControl } from "@/components/panels/TimelineControl";

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

/** Estructura principal de la aplicación (layout de centro de mando). */
export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-base-900 text-slate-200">
      <Header onToggleSidebar={() => setSidebarOpen((v) => !v)} />

      <div className="relative flex flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} />

        <main className="relative flex-1">
          <MapContainer />

          {/* Control de línea de tiempo flotante en la parte inferior */}
          <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 w-[min(560px,calc(100%-2rem))] -translate-x-1/2 md:left-[calc(50%+180px)]">
            <TimelineControl />
          </div>
        </main>
      </div>
    </div>
  );
}
