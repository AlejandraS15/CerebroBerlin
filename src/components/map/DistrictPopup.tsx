"use client";

import { useCityStore } from "@/store/useCityStore";
import { useCityData } from "@/hooks/useCityData";
import { NO_DATA } from "@/lib/format";
import { METRICS } from "@/lib/metrics";
import type { AirQualityPoint, Origin, ProvenanceRef } from "@/lib/types";
import { OriginBadge } from "@/components/provenance/OriginBadge";
import { ProvenanceButton } from "@/components/provenance/ProvenanceButton";
import { EaqiInfoButton } from "@/components/eaqi/EaqiInfoButton";
import { EaqiBandLabel } from "@/components/eaqi/EaqiBandLabel";

/**
 * Popup_de_Distrito: detalle del Bezirk seleccionado (store.selectedDistrict,
 * con la nueva forma de `District`). Muestra población, densidad, superficie,
 * % < 18, % 65+ (+ cobertura de edad), % verde (+ definición corta) y el AQI
 * del modelo CAMS (Open-Meteo) tomado de `data.air` por Código_de_Distrito.
 *
 * Cada métrica lleva su vigencia, `OriginBadge` y `ProvenanceButton` (17.x).
 * El AQI añade `EaqiInfoButton` y la banda con `EaqiBandLabel`; si el punto de
 * aire es `mock`, muestra la insignia "⚠ simulado" (11.9). Sin edad mediana.
 */
export function DistrictPopup() {
  const district = useCityStore((s) => s.selectedDistrict);
  const setSelectedDistrict = useCityStore((s) => s.setSelectedDistrict);
  const { data } = useCityData();

  if (!district) return null;

  // AQI del distrito: punto de aire asociado por Código_de_Distrito.
  const air: AirQualityPoint | undefined = data?.air.find(
    (p) => p.districtCode === district.id,
  );
  const aqi = air?.aqi ?? null;
  const airOrigin: Origin = air?.origin ?? "live";

  // Momento de consulta del aire (para la procedencia del AQI).
  const airFetchedAt = data?.fetchedAt.air ?? undefined;

  // Fechas probadas del lago (vigencia snapshot de las métricas de distrito).
  const probado = data?.lake.probado;

  const prov = (
    metric: ProvenanceRef["metric"],
    origin: Origin,
    extra: Partial<ProvenanceRef> = {},
  ): ProvenanceRef => ({ metric, origin, scope: district.name, ...extra });

  return (
    <div className="absolute right-3 top-3 z-30 w-80 rounded-xl border border-base-500/60 bg-base-800/95 p-4 shadow-panel backdrop-blur">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-accent">
            Distrito · Bezirk
          </div>
          <h3 className="text-lg font-semibold text-slate-100">{district.name}</h3>
        </div>
        <button
          type="button"
          onClick={() => setSelectedDistrict(null)}
          className="rounded-md px-2 py-0.5 text-slate-400 transition hover:bg-base-600 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>

      <dl className="space-y-2 text-sm">
        <Metric
          label={METRICS.population.label}
          value={district.population.toLocaleString("es")}
          vigencia={probado?.poblacion}
          origin="snapshot"
          provenance={prov("population", "snapshot", {
            vigencia: probado?.poblacion,
            probado: probado?.poblacion,
          })}
        />
        <Metric
          label={METRICS.density.label}
          value={`${district.density.toLocaleString("es")} ${METRICS.density.unit}`}
          vigencia={probado?.territorio}
          origin="snapshot"
          provenance={prov("density", "snapshot", {
            vigencia: probado?.territorio,
            probado: probado?.territorio,
          })}
        />
        <Metric
          label={METRICS.area.label}
          value={`${district.areaKm2} ${METRICS.area.unit}`}
          vigencia={probado?.territorio}
          origin="snapshot"
          provenance={prov("area", "snapshot", {
            vigencia: probado?.territorio,
            probado: probado?.territorio,
          })}
        />
        <Metric
          label={METRICS.pctUnder18.label}
          value={`${district.pctUnder18} %`}
          vigencia={probado?.poblacion}
          origin="snapshot"
          provenance={prov("pctUnder18", "snapshot", {
            vigencia: probado?.poblacion,
            probado: probado?.poblacion,
          })}
        />
        <Metric
          label={METRICS.pct65Plus.label}
          value={`${district.pct65Plus} %`}
          note={`cobertura de edad: ${district.ageCoveragePct} %`}
          vigencia={probado?.poblacion}
          origin="snapshot"
          provenance={prov("pct65Plus", "snapshot", {
            vigencia: probado?.poblacion,
            probado: probado?.poblacion,
          })}
        />
        <Metric
          label={METRICS.greenPct.label}
          value={`${district.greenPct} %`}
          note="Σ bloques de vegetación ÷ superficie de bloques sin calles (Flächennutzung 2020)"
          vigencia={probado?.verde}
          origin="snapshot"
          provenance={prov("greenPct", "snapshot", {
            vigencia: probado?.verde,
            probado: probado?.verde,
          })}
        />

        {/* AQI: modelo CAMS (Open-Meteo) o "sin datos". */}
        <div className="rounded-lg bg-base-700/60 px-3 py-2">
          <dt className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">
            EAQI · modelo CAMS (Open-Meteo)
            <EaqiInfoButton />
            <span className="ml-auto flex items-center gap-1">
              {airOrigin === "mock" && <OriginBadge origin="mock" compact />}
              <ProvenanceButton
                provenance={prov("aqiModel", airOrigin, { fetchedAt: airFetchedAt })}
              />
            </span>
          </dt>
          <dd className="mt-0.5 flex items-baseline justify-between gap-2">
            <span className="font-semibold text-slate-100">
              {aqi != null ? String(aqi) : NO_DATA}
            </span>
            {aqi != null && <EaqiBandLabel value={aqi} />}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/** Fila de métrica con vigencia, OriginBadge y ProvenanceButton. */
function Metric({
  label,
  value,
  note,
  vigencia,
  origin,
  provenance,
}: {
  label: string;
  value: string;
  note?: string;
  vigencia?: string;
  origin: Origin;
  provenance: ProvenanceRef;
}) {
  return (
    <div className="rounded-lg bg-base-700/60 px-3 py-2">
      <dt className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">
        {label}
        <span className="ml-auto flex items-center gap-1">
          <OriginBadge origin={origin} compact />
          <ProvenanceButton provenance={provenance} />
        </span>
      </dt>
      <dd className="mt-0.5 font-semibold text-slate-100">{value}</dd>
      {note && <p className="mt-0.5 text-[10px] leading-tight text-slate-400">{note}</p>}
      {vigencia && (
        <p className="mt-0.5 text-[10px] text-slate-500">vigencia {vigencia}</p>
      )}
    </div>
  );
}
