"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useCityData } from "@/hooks/useCityData";
import { useCityStore } from "@/store/useCityStore";
import { filterDatasetByDistrict } from "@/lib/districtFilter";

// recharts accede a React.useContext al cargarse; si se renderiza en el
// servidor durante el prerender estático, falla. El dashboard es puramente de
// cliente, así que se carga con ssr:false, igual que el mapa.
const AnalyticsPanel = dynamic(
  () => import("@/components/panels/AnalyticsPanel").then((m) => m.AnalyticsPanel),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border border-base-500/40 bg-base-700/40 p-6 text-center text-sm text-slate-400">
        Cargando analítica…
      </div>
    ),
  },
);

/** Valor del filtro que representa "todas las provincias". */
const ALL = "__all__";

/**
 * Vista "Análisis": el dashboard de KPIs y gráficas. Incluye un filtro de
 * provincia: con "Todas" muestra la ciudad completa (comportamiento actual);
 * al elegir una provincia (p. ej. Pankow), las tablas y gráficas se calculan
 * solo con los datos de esa provincia.
 */
export function AnalyticsView() {
  const { data } = useCityData();
  const selectedHour = useCityStore((s) => s.selectedHour);
  const [districtId, setDistrictId] = useState<string>(ALL);

  // Opciones del filtro a partir de los distritos del dataset (ordenadas).
  const options = useMemo(() => {
    const feats = data?.districts.features ?? [];
    return feats
      .map((f) => ({ id: f.properties.id, name: f.properties.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  // Dataset filtrado a la provincia elegida (o completo con "Todas").
  const filteredData = useMemo(() => {
    if (!data) return data;
    return districtId === ALL ? data : filterDatasetByDistrict(data, districtId);
  }, [data, districtId]);

  const selectedName =
    districtId === ALL
      ? null
      : (options.find((o) => o.id === districtId)?.name ?? null);

  return (
    <div className="h-full flex-1 overflow-y-auto bg-base-900">
      <div className="mx-auto w-full max-w-5xl p-4 md:p-6">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">Dashboard · Analítica</h1>
            <p className="text-xs text-slate-400">
              {selectedName
                ? `Mostrando solo ${selectedName}.`
                : "KPIs, series temporales y comparativas por distrito del gemelo digital."}
            </p>
          </div>

          {/* Filtro de búsqueda por provincia. */}
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <span className="uppercase tracking-wide text-slate-400">Provincia</span>
            <select
              value={districtId}
              onChange={(e) => setDistrictId(e.target.value)}
              className="rounded-lg border border-base-500/60 bg-base-800 px-3 py-1.5 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Filtrar analítica por provincia"
            >
              <option value={ALL}>Todas las provincias</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        </header>

        <AnalyticsPanel data={filteredData} hour={selectedHour} />
      </div>
    </div>
  );
}
