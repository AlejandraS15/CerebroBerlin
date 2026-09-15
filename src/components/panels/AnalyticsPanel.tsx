"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CityDataset } from "@/lib/types";
import { useAnalytics } from "@/hooks/useAnalytics";
import { KpiCards } from "./KpiCards";

const PIE_COLORS = ["#2563eb", "#16a34a", "#dc2626", "#a855f7"];
const BAR_COLORS = ["#22d3ee", "#38bdf8", "#60a5fa"];

const chartTooltip = {
  contentStyle: {
    background: "#0b1120",
    border: "1px solid #243252",
    borderRadius: 8,
    fontSize: 12,
    color: "#e2e8f0",
  },
  labelStyle: { color: "#94a3b8" },
};

/**
 * Panel de analítica: KPIs + gráficos dinámicos (serie temporal 24h,
 * reparto modal de transporte y AQI por distrito).
 */
export function AnalyticsPanel({
  data,
  hour,
}: {
  data: CityDataset | undefined;
  hour: number;
}) {
  const analytics = useAnalytics(data, hour);
  if (!data || !analytics) {
    return (
      <div className="animate-pulseSoft rounded-lg border border-base-500/40 bg-base-700/40 p-6 text-center text-sm text-slate-400">
        Cargando analítica…
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        Dashboard · Analítica
      </h2>

      <KpiCards kpis={analytics.kpis} />

      {/* Serie temporal 24h con marca de la hora seleccionada */}
      <ChartCard title="Actividad urbana · 24h">
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={data.timeSeries} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gMob" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.7} />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gAqi" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#64748b" }} interval={5} />
            <YAxis tick={{ fontSize: 9, fill: "#64748b" }} width={28} />
            <Tooltip {...chartTooltip} />
            <ReferenceLine
              x={`${String(hour).padStart(2, "0")}:00`}
              stroke="#f59e0b"
              strokeDasharray="3 3"
            />
            <Area
              type="monotone"
              dataKey="mobilityIndex"
              name="Movilidad"
              stroke="#22d3ee"
              fill="url(#gMob)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="aqi"
              name="AQI"
              stroke="#a78bfa"
              fill="url(#gAqi)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-2 gap-3">
        {/* Reparto modal de transporte */}
        <ChartCard title="Reparto modal">
          <ResponsiveContainer width="100%" height={130}>
            <PieChart>
              <Pie
                data={analytics.modeSplit}
                dataKey="value"
                nameKey="name"
                innerRadius={28}
                outerRadius={50}
                paddingAngle={2}
              >
                {analytics.modeSplit.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...chartTooltip} />
            </PieChart>
          </ResponsiveContainer>
          <Legend items={analytics.modeSplit.map((m, i) => ({
            label: m.name,
            color: PIE_COLORS[i % PIE_COLORS.length],
          }))} />
        </ChartCard>

        {/* AQI por distrito */}
        <ChartCard title="AQI por distrito">
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={analytics.aqiByDistrict} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 8, fill: "#64748b" }} interval={0} angle={-30} textAnchor="end" height={34} />
              <YAxis tick={{ fontSize: 9, fill: "#64748b" }} width={26} />
              <Tooltip {...chartTooltip} />
              <Bar dataKey="aqi" radius={[3, 3, 0, 0]}>
                {analytics.aqiByDistrict.map((d, i) => (
                  <Cell
                    key={i}
                    fill={
                      d.aqi <= 50
                        ? "#4ade80"
                        : d.aqi <= 100
                        ? "#facc15"
                        : "#f87171"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Densidad por distrito */}
      <ChartCard title="Densidad poblacional (hab/km²)">
        <ResponsiveContainer width="100%" height={130}>
          <BarChart
            data={analytics.densityByDistrict}
            layout="vertical"
            margin={{ top: 0, right: 8, left: 4, bottom: 0 }}
          >
            <XAxis type="number" tick={{ fontSize: 9, fill: "#64748b" }} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 9, fill: "#94a3b8" }}
              width={70}
            />
            <Tooltip {...chartTooltip} />
            <Bar dataKey="density" radius={[0, 3, 3, 0]}>
              {analytics.densityByDistrict.map((_, i) => (
                <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </section>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-base-500/40 bg-base-700/40 p-3">
      <div className="mb-2 text-[11px] font-medium text-slate-300">{title}</div>
      {children}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: it.color }}
          />
          {it.label}
        </li>
      ))}
    </ul>
  );
}
