"use client";

import { EAQI_BANDS, EAQI_THRESHOLDS } from "@/lib/eaqi";

/**
 * Leyenda del EAQI: umbrales horarios por contaminante, fórmula del subíndice
 * y las seis Bandas_EAQI con su color. Solo la importa `EaqiPanel.tsx` (es el
 * contenido del único Panel_EAQI); no se usa suelta en ninguna otra vista.
 */

const POLLUTANT_LABEL: Record<string, string> = {
  pm25: "PM2.5",
  pm10: "PM10",
  no2: "NO₂",
  o3: "O₃",
};

/** Rango textual [min, max) de una banda sobre el valor mostrado. */
function bandRange(min: number, max: number | null): string {
  if (max === null) return `> ${min - 1}`;
  if (min === 0) return `< ${max + 1}`;
  return `${min}–${max}`;
}

export function EaqiLegend() {
  return (
    <div className="space-y-4 text-sm text-slate-300">
      <p>
        El Índice Europeo de Calidad del Aire (EAQI) clasifica el aire con las
        bandas de la Agencia Europea de Medio Ambiente, distintas de la escala
        US EPA. El subíndice de cada contaminante se calcula como{" "}
        <span className="font-mono text-slate-200">
          (índice del tramo + posición lineal en el tramo) × 20
        </span>
        , extrapolando con el último tramo por encima del último umbral. El EAQI
        global es el máximo de los subíndices disponibles.
      </p>

      {/* Umbrales horarios en µg/m³ */}
      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Umbrales horarios (µg/m³)
        </h3>
        <table className="w-full border-collapse text-xs">
          <tbody>
            {(Object.keys(EAQI_THRESHOLDS) as (keyof typeof EAQI_THRESHOLDS)[]).map(
              (p) => (
                <tr key={p} className="border-b border-base-500/30">
                  <th scope="row" className="py-1 pr-2 text-left font-medium text-slate-200">
                    {POLLUTANT_LABEL[p] ?? p}
                  </th>
                  <td className="py-1 font-mono text-slate-400">
                    {EAQI_THRESHOLDS[p].join(", ")}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      {/* Bandas EAQI */}
      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Bandas
        </h3>
        <ul className="space-y-1">
          {EAQI_BANDS.map((b) => (
            <li key={b.id} className="flex items-center gap-2 text-xs">
              <span
                aria-hidden="true"
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ background: b.color }}
              />
              <span className="w-36 text-slate-200">{b.label}</span>
              <span className="font-mono text-slate-400">
                {bandRange(b.min, b.max)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
