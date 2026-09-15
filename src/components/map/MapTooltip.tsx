"use client";

import type { HoverInfo } from "./buildDeckLayers";

const KIND_COLOR: Record<HoverInfo["kind"], string> = {
  district: "#f59e0b",
  transit: "#22d3ee",
  air: "#a78bfa",
  bike: "#22d3ee",
  hotspot: "#fb7185",
  infra: "#34d399",
};

/** Tooltip flotante que sigue al cursor sobre el mapa. */
export function MapTooltip({ info }: { info: HoverInfo | null }) {
  if (!info) return null;
  return (
    <div
      className="pointer-events-none absolute z-30 max-w-xs rounded-lg border border-base-500/60 bg-base-800/95 px-3 py-2 text-xs text-slate-200 shadow-panel backdrop-blur"
      style={{ left: info.x + 14, top: info.y + 14 }}
    >
      <div
        className="mb-1 font-semibold"
        style={{ color: KIND_COLOR[info.kind] }}
      >
        {info.title}
      </div>
      {info.lines.map((l, i) => (
        <div key={i} className="text-slate-400">
          {l}
        </div>
      ))}
    </div>
  );
}
