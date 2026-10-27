"use client";

import { useState } from "react";
import { Header } from "./Header";
import { CityView } from "@/components/views/CityView";
import { AnalyticsView } from "@/components/views/AnalyticsView";
import { SourcesView } from "@/components/views/SourcesView";
import { EaqiPanel } from "@/components/eaqi/EaqiPanel";
import { ProvenancePanel } from "@/components/provenance/ProvenancePanel";
import { useCityStore } from "@/store/useCityStore";

/**
 * Estructura principal de la aplicación (layout de centro de mando).
 *
 * La interfaz se organiza en tres pestañas para que ninguna vista quede
 * amontonada: "Ciudad" (el mapa es la protagonista, con el menú de capas),
 * "Análisis" (dashboard y gráficas) y "Fuentes y huecos".
 */
export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const activeView = useCityStore((s) => s.activeView);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-base-900 text-slate-200">
      <Header
        showSidebarToggle={activeView === "city"}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />

      <div className="relative flex flex-1 overflow-hidden">
        {activeView === "city" && <CityView sidebarOpen={sidebarOpen} />}
        {activeView === "analytics" && <AnalyticsView />}
        {activeView === "sources" && <SourcesView />}
      </div>

      {/* Única instancia del Panel_de_Procedencia y del Panel_EAQI (10.5). */}
      <ProvenancePanel />
      <EaqiPanel />
    </div>
  );
}
