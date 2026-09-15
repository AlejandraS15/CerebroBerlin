"use client";

import { useCityStore } from "@/store/useCityStore";
import { aqiTone } from "@/lib/format";

/**
 * Tarjeta de detalle que aparece al hacer click en un distrito.
 * Muestra métricas demográficas y ambientales del Bezirk seleccionado.
 */
export function DistrictPopup() {
  const district = useCityStore((s) => s.selectedDistrict);
  const setSelectedDistrict = useCityStore((s) => s.setSelectedDistrict);
  if (!district) return null;

  const tone = aqiTone(district.aqi);

  return (
    <div className="absolute right-3 top-3 z-30 w-72 rounded-xl border border-base-500/60 bg-base-800/95 p-4 shadow-panel backdrop-blur">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-accent">
            Distrito · Bezirk
          </div>
          <h3 className="text-lg font-semibold text-slate-100">
            {district.name}
          </h3>
        </div>
        <button
          onClick={() => setSelectedDistrict(null)}
          className="rounded-md px-2 py-0.5 text-slate-400 hover:bg-base-600 hover:text-slate-100"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <Metric label="Población" value={district.population.toLocaleString("es")} />
        <Metric label="Área" value={`${district.areaKm2} km²`} />
        <Metric
          label="Densidad"
          value={`${district.density.toLocaleString("es")}/km²`}
        />
        <Metric label="Edad media" value={`${district.medianAge} años`} />
        <Metric label="Zonas verdes" value={`${district.greenSpacePct}%`} />
        <Metric
          label="AQI"
          value={String(district.aqi)}
          valueClass={tone.text}
        />
      </dl>

      <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${tone.bg} ${tone.text}`}>
        Calidad del aire: {tone.label}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  valueClass = "text-slate-100",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg bg-base-700/60 px-3 py-2">
      <dt className="text-[10px] uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className={`font-semibold ${valueClass}`}>{value}</dd>
    </div>
  );
}
