"use client";

import { GapsList } from "@/components/panels/GapsList";
import { SourcesFooter } from "@/components/layout/SourcesFooter";
import { SourceBadges } from "@/components/panels/SourceBadges";

/**
 * Vista "Fuentes y huecos": reúne todo lo relacionado con procedencia y
 * límites de datos en una pestaña dedicada — insignias de origen por bloque,
 * la Lista_de_Huecos y el pie de fuentes integradas/catalogadas.
 */
export function SourcesView() {
  return (
    <div className="h-full flex-1 overflow-y-auto bg-base-900">
      <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-6">
        <header>
          <h1 className="text-lg font-semibold text-slate-100">Fuentes y huecos de datos</h1>
          <p className="text-xs text-slate-400">
            Procedencia de cada bloque, límites del tablero y catálogo de fuentes.
          </p>
        </header>

        <section className="space-y-3 rounded-lg border border-base-500/40 bg-base-800/40 p-4">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Origen de los datos por bloque
          </h2>
          <SourceBadges />
        </section>

        <section className="rounded-lg border border-base-500/40 bg-base-800/40 p-4">
          <GapsList />
        </section>

        <section className="rounded-lg border border-base-500/40 bg-base-800/40 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Catálogo de fuentes
          </h2>
          <SourcesFooter />
        </section>
      </div>
    </div>
  );
}
