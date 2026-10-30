"use client";

import { useState } from "react";
import { LAYER_CATALOG } from "@/lib/layers";
import { useCityStore } from "@/store/useCityStore";
import type { LayerCategory } from "@/lib/types";

/**
 * Control de capas: un toggle por capa con icono, color (que coincide con el
 * de las bolitas del mapa), descripción y una sección desplegable que explica
 * qué significan los colores/tamaños que se verán sobre el mapa.
 */
export function LayerController() {
  const visibility = useCityStore((s) => s.layerVisibility);
  const toggleLayer = useCityStore((s) => s.toggleLayer);

  return (
    <section>
      <ul className="space-y-2">
        {LAYER_CATALOG.map((layer) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            active={visibility[layer.id]}
            onToggle={() => toggleLayer(layer.id)}
          />
        ))}
      </ul>
    </section>
  );
}

function LayerRow({
  layer,
  active,
  onToggle,
}: {
  layer: LayerCategory;
  active: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = `layer-legend-${layer.id}`;

  return (
    <li
      className={`rounded-lg border transition ${
        active
          ? "border-accent/40 bg-base-600/50 shadow-glow"
          : "border-base-500/40 bg-base-700/40 hover:border-base-500"
      }`}
    >
      <div className="flex items-start gap-3 px-3 py-2.5">
        {/* Muestra de color que coincide con la bolita de esta capa en el mapa. */}
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] leading-none ring-2 ring-white/10"
          style={{ backgroundColor: hexWithAlpha(layer.color, 0.22), color: layer.color }}
          title={`Color de ${layer.label} en el mapa`}
        >
          {layer.icon}
        </span>

        {/* Botón principal: activa/desactiva la capa. */}
        <button
          onClick={onToggle}
          aria-pressed={active}
          className="flex flex-1 items-start gap-2 text-left"
        >
          <span className="flex-1">
            <span className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-100">{layer.label}</span>
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
            {/* Etiqueta derivada del catálogo, no del dato (19.4). */}
            {layer.example && (
              <span className="mt-1 inline-flex items-center rounded border border-base-500/60 bg-base-700/60 px-1.5 py-0.5 text-[9px] text-slate-400">
                datos de ejemplo (sin fuente)
              </span>
            )}
          </span>
        </button>
      </div>

      {/* Desplegable con la explicación de qué se verá en el mapa. */}
      {layer.legend && (
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={panelId}
            className="flex w-full items-center gap-1 text-[11px] font-medium text-accent/90 hover:text-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            <span className={`transition-transform ${expanded ? "rotate-90" : ""}`}>▸</span>
            {expanded ? "Ocultar qué significa" : "¿Qué veré en el mapa?"}
          </button>

          {expanded && (
            <div
              id={panelId}
              className="mt-2 space-y-2 rounded-md border border-base-500/40 bg-base-800/60 p-2.5 text-[11px] leading-snug text-slate-300"
            >
              <p>{layer.legend.summary}</p>
              {layer.legend.entries && layer.legend.entries.length > 0 && (
                <ul className="space-y-1">
                  {layer.legend.entries.map((e) => (
                    <li
                      key={`${e.icon ?? e.color}-${e.meaning}`}
                      className="flex items-center gap-2"
                    >
                      {e.icon ? (
                        <span
                          aria-hidden="true"
                          className="flex h-4 w-4 shrink-0 items-center justify-center text-[13px] leading-none"
                        >
                          {e.icon}
                        </span>
                      ) : (
                        <span
                          aria-hidden="true"
                          className="h-3 w-3 shrink-0 rounded-full ring-1 ring-white/20"
                          style={{ backgroundColor: e.color }}
                        />
                      )}
                      <span className="text-slate-300">{e.meaning}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/** Convierte un HEX ("#22d3ee") a rgba() con la opacidad indicada. */
function hexWithAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
