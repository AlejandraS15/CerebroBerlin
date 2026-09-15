"use client";

import { useCityStore } from "@/store/useCityStore";
import { useTimelinePlayer } from "@/hooks/useTimelinePlayer";
import { formatHour } from "@/lib/format";

/**
 * Control de línea de tiempo (24h): slider + play/pause. Anima la actividad
 * de las capas y sincroniza los charts del dashboard.
 */
export function TimelineControl() {
  useTimelinePlayer();
  const selectedHour = useCityStore((s) => s.selectedHour);
  const setSelectedHour = useCityStore((s) => s.setSelectedHour);
  const isPlaying = useCityStore((s) => s.isPlaying);
  const togglePlaying = useCityStore((s) => s.togglePlaying);

  return (
    <div className="pointer-events-auto flex items-center gap-4 rounded-xl border border-base-500/60 bg-base-800/90 px-4 py-3 shadow-panel backdrop-blur">
      <button
        onClick={togglePlaying}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20 text-accent transition hover:bg-accent/30"
        aria-label={isPlaying ? "Pausar" : "Reproducir"}
      >
        {isPlaying ? "❚❚" : "▶"}
      </button>

      <div className="flex-1">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="uppercase tracking-wider text-slate-400">
            Línea de tiempo · 24h
          </span>
          <span className="font-mono text-accent">{formatHour(selectedHour)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={23}
          step={1}
          value={selectedHour}
          onChange={(e) => setSelectedHour(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-base-500 accent-accent"
          aria-label="Hora del día"
        />
        <div className="mt-1 flex justify-between text-[10px] text-slate-500">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>23:00</span>
        </div>
      </div>
    </div>
  );
}
