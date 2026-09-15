"use client";

import { LAYER_CATALOG } from "@/lib/layers";
import { useCityStore } from "@/store/useCityStore";

/** Control de capas: toggles con icono, color y descripción. */
export function LayerController() {
  const visibility = useCityStore((s) => s.layerVisibility);
  const toggleLayer = useCityStore((s) => s.toggleLayer);

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        Capas del Gemelo
      </h2>
      <ul className="space-y-2">
        {LAYER_CATALOG.map((layer) => {
          const active = visibility[layer.id];
          return (
            <li key={layer.id}>
              <button
                onClick={() => toggleLayer(layer.id)}
                className={`group flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                  active
                    ? "border-accent/40 bg-base-600/50 shadow-glow"
                    : "border-base-500/40 bg-base-700/40 hover:border-base-500 hover:bg-base-600/40"
                }`}
              >
                <span className="mt-0.5 text-lg leading-none">{layer.icon}</span>
                <span className="flex-1">
                  <span className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-100">
                      {layer.label}
                    </span>
                    <span
                      className={`ml-2 h-3.5 w-6 rounded-full p-0.5 transition ${
                        active ? "bg-accent/70" : "bg-base-500"
                      }`}
                    >
                      <span
                        className={`block h-2.5 w-2.5 rounded-full bg-white transition-transform ${
                          active ? "translate-x-2.5" : ""
                        }`}
                      />
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-tight text-slate-400">
                    {layer.description}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
