"use client";

import { useCityStore, type AppView } from "@/store/useCityStore";

interface TabDef {
  id: AppView;
  label: string;
  icon: string;
  description: string;
}

const TABS: TabDef[] = [
  { id: "city", label: "Ciudad", icon: "🗺️", description: "Mapa y capas del gemelo digital" },
  { id: "analytics", label: "Análisis", icon: "📊", description: "Dashboard de KPIs y gráficas" },
  { id: "sources", label: "Fuentes y huecos", icon: "🔎", description: "Procedencia y límites de datos" },
];

/**
 * Navegación por pestañas del centro de mando. Separa las tres vistas
 * principales (ciudad, análisis, fuentes) para que ninguna quede amontonada
 * en una sola pantalla. El estado vive en el store (`activeView`).
 */
export function ViewTabs() {
  const activeView = useCityStore((s) => s.activeView);
  const setActiveView = useCityStore((s) => s.setActiveView);

  return (
    <nav
      role="tablist"
      aria-label="Vistas del gemelo digital"
      className="flex items-center gap-1 rounded-lg border border-base-500/50 bg-base-800/60 p-1"
    >
      {TABS.map((tab) => {
        const active = activeView === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            title={tab.description}
            onClick={() => setActiveView(tab.id)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
              active
                ? "bg-accent/15 text-accent shadow-glow"
                : "text-slate-300 hover:bg-base-600/60 hover:text-slate-100"
            }`}
          >
            <span className="text-sm leading-none">{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
