"use client";

import { useMemo } from "react";
import type { CityDataset, Kpi } from "@/lib/types";
import { abbreviate } from "@/lib/format";

export interface Analytics {
  kpis: Kpi[];
  totalPopulation: number;
  avgAqi: number;
  totalBikes: number;
  transitCount: number;
  /** Distribución de modos de transporte para gráfico. */
  modeSplit: { name: string; value: number }[];
  /** AQI por distrito para barras. */
  aqiByDistrict: { name: string; aqi: number }[];
  /** Densidad por distrito. */
  densityByDistrict: { name: string; density: number }[];
}

/**
 * Deriva indicadores y series agregadas del dataset para el dashboard.
 * `hour` sincroniza algunos indicadores con la línea de tiempo.
 */
export function useAnalytics(
  data: CityDataset | undefined,
  hour: number,
): Analytics | null {
  return useMemo(() => {
    if (!data) return null;

    const districts = data.districts.features.map((f) => f.properties);
    const totalPopulation = districts.reduce((s, d) => s + d.population, 0);
    const avgAqi = Math.round(
      districts.reduce((s, d) => s + d.aqi, 0) / (districts.length || 1),
    );
    const totalBikes = data.bikes.reduce((s, b) => s + b.bikesAvailable, 0);
    const transitCount = data.transit.length;

    const point =
      data.timeSeries.find((t) => t.hour === hour) ?? data.timeSeries[0];

    const modeCounts = data.transit.reduce<Record<string, number>>((acc, t) => {
      acc[t.mode] = (acc[t.mode] ?? 0) + 1;
      return acc;
    }, {});
    const modeLabels: Record<string, string> = {
      u: "U-Bahn",
      s: "S-Bahn",
      tram: "Tranvía",
      bus: "Bus",
    };
    const modeSplit = Object.entries(modeCounts).map(([k, v]) => ({
      name: modeLabels[k] ?? k,
      value: v,
    }));

    const aqiByDistrict = districts
      .map((d) => ({ name: d.name.split("-")[0], aqi: d.aqi }))
      .sort((a, b) => b.aqi - a.aqi)
      .slice(0, 8);

    const densityByDistrict = districts
      .map((d) => ({ name: d.name.split("-")[0], density: d.density }))
      .sort((a, b) => b.density - a.density)
      .slice(0, 8);

    const kpis: Kpi[] = [
      {
        id: "pop",
        label: "Población total",
        value: abbreviate(totalPopulation),
        delta: "+0.9%",
        trend: "up",
        tone: "neutral",
      },
      {
        id: "mobility",
        label: "Índice de movilidad",
        value: String(point.mobilityIndex),
        unit: "/100",
        delta: point.mobilityIndex > 60 ? "Alta demanda" : "Estable",
        trend: point.mobilityIndex > 60 ? "up" : "flat",
        tone: point.mobilityIndex > 75 ? "warn" : "good",
      },
      {
        id: "aqi",
        label: "AQI medio ciudad",
        value: String(point.aqi),
        delta: point.aqi > 70 ? "Elevado" : "Aceptable",
        trend: point.aqi > 70 ? "up" : "flat",
        tone: point.aqi <= 50 ? "good" : point.aqi <= 100 ? "warn" : "bad",
      },
      {
        id: "bikes",
        label: "Bicis activas",
        value: abbreviate(point.bikeUsage),
        delta: "en tiempo real",
        trend: "up",
        tone: "good",
      },
      {
        id: "energy",
        label: "Demanda energética",
        value: String(point.energyDemand),
        unit: " MW",
        delta: point.energyDemand > 1000 ? "Pico" : "Normal",
        trend: point.energyDemand > 1000 ? "up" : "flat",
        tone: point.energyDemand > 1050 ? "warn" : "neutral",
      },
      {
        id: "hotspots",
        label: "Puntos críticos",
        value: String(data.hotspots.length),
        delta: "activos",
        trend: "flat",
        tone: data.hotspots.length > 6 ? "bad" : "warn",
      },
    ];

    return {
      kpis,
      totalPopulation,
      avgAqi,
      totalBikes,
      transitCount,
      modeSplit,
      aqiByDistrict,
      densityByDistrict,
    };
  }, [data, hour]);
}
