"use client";

import { useCityStore } from "@/store/useCityStore";

/** Barra superior con marca, toggle de sidebar y control 3D/2D. */
export function Header({
  onToggleSidebar,
}: {
  onToggleSidebar: () => void;
}) {
  const is3D = useCityStore((s) => s.is3D);
  const toggle3D = useCityStore((s) => s.toggle3D);

  return (
    <header className="z-30 flex items-center justify-between border-b border-base-500/50 bg-base-900/80 px-4 py-2.5 backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-base-500/50 text-slate-300 hover:bg-base-600 md:hidden"
          aria-label="Alternar panel"
        >
          ☰
        </button>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20 text-accent shadow-glow">
            🧠
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight text-slate-100">
              Gemelo Digital · Berlín
            </h1>
            <p className="text-[10px] leading-tight text-slate-400">
              Plataforma de datos abiertos urbanos
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="hidden items-center gap-1.5 rounded-full border border-signal-good/40 bg-signal-good/10 px-2.5 py-1 text-[11px] text-signal-good sm:inline-flex">
          <span className="h-1.5 w-1.5 animate-pulseSoft rounded-full bg-signal-good" />
          En vivo
        </span>
        <button
          onClick={toggle3D}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            is3D
              ? "border-accent/50 bg-accent/15 text-accent"
              : "border-base-500/50 text-slate-300 hover:bg-base-600"
          }`}
        >
          {is3D ? "Vista 3D" : "Vista 2D"}
        </button>
      </div>
    </header>
  );
}
