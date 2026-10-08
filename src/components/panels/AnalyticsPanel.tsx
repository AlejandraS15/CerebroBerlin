"use client";

import {
  Area,
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  LabelList,
  Line,
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
import { attributionsFor } from "@/lib/provenance";
import { NO_DATA } from "@/lib/format";
import { KpiCards } from "./KpiCards";
import { OriginBadge } from "@/components/provenance/OriginBadge";
import { EaqiInfoButton } from "@/components/eaqi/EaqiInfoButton";
import type { DistrictAqiBar } from "@/lib/analytics";

const PIE_COLORS = ["#2563eb", "#16a34a", "#dc2626", "#a855f7"];
const BAR_COLORS = ["#22d3ee", "#38bdf8", "#60a5fa"];
/** Gris neutro para barras EAQI sin dato. */
const NO_DATA_COLOR = "#475569";

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
 * Panel de analítica: KPIs + gráficos. La serie 24 h combina `trafficIndex`
 * (área) con las curvas horarias de EAQI y temperatura; "AQI por distrito"
 * usa `districtAqiBars` (barras por banda, lo simulado rayado y marcado);
 * "Reparto modal" lleva el `OriginBadge` del transporte y "Densidad" sale de
 * `densityByDistrict`. Las atribuciones se derivan de `attributionsFor`.
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

  // ¿Alguna barra de AQI es simulada? Marca el título del gráfico.
  const aqiHasMock = analytics.aqiByDistrict.some((b) => b.origin === "mock");

  // Atribuciones de las fuentes mostradas en los gráficos de este panel.
  const attributions = attributionsFor([
    "verkehrsdetektion", // tráfico 24 h
    "open-meteo-aire", // AQI horario y por distrito
    "open-meteo-meteo", // temperatura
    "vbb-transport-rest", // reparto modal
    "ua-einwohnerdichte-2024", // densidad
  ]);

  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        Dashboard · Analítica
      </h2>

      <KpiCards kpis={analytics.kpis} />

      {/* Serie temporal 24 h: tráfico (área) + EAQI y temperatura (líneas). */}
      <ChartCard title="Actividad urbana · 24h">
        <ResponsiveContainer width="100%" height={150}>
          <ComposedChart data={data.timeSeries} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gTraffic" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
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
              dataKey="trafficIndex"
              name="Tráfico"
              stroke="#22d3ee"
              fill="url(#gTraffic)"
              strokeWidth={2}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="aqi"
              name="EAQI"
              stroke="#a78bfa"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="temperature"
              name="Temp. (°C)"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
        <Legend
          items={[
            { label: "Tráfico (índice)", color: "#22d3ee" },
            { label: "EAQI", color: "#a78bfa" },
            { label: "Temperatura", color: "#f59e0b" },
          ]}
        />
      </ChartCard>

      <div className="grid grid-cols-2 gap-3">
        {/* Reparto modal de transporte con origen de la fuente. */}
        <ChartCard
          title="Reparto modal"
          badge={<OriginBadge origin={data.source.transit} compact />}
        >
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
          <Legend
            items={analytics.modeSplit.map((m, i) => ({
              label: m.name,
              color: PIE_COLORS[i % PIE_COLORS.length],
            }))}
          />
        </ChartCard>

        {/* AQI por distrito (EAQI) desde districtAqiBars. */}
        <ChartCard
          title="AQI por distrito (EAQI)"
          info={<EaqiInfoButton />}
          badge={aqiHasMock ? <OriginBadge origin="mock" compact /> : undefined}
        >
          {aqiHasMock && (
            <span className="sr-only">
              Algunas barras muestran valores simulados.
            </span>
          )}
          <AqiHatchDefs bars={analytics.aqiByDistrict} />
          <ResponsiveContainer width="100%" height={130}>
            <BarChart
              data={analytics.aqiByDistrict}
              margin={{ top: 10, right: 4, left: -24, bottom: 0 }}
            >
              <XAxis
                dataKey="name"
                tick={{ fontSize: 8, fill: "#64748b" }}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={34}
              />
              <YAxis tick={{ fontSize: 9, fill: "#64748b" }} width={26} />
              <Tooltip {...chartTooltip} content={<AqiBarTooltip />} />
              <Bar dataKey="aqi" radius={[3, 3, 0, 0]}>
                {analytics.aqiByDistrict.map((b, i) => (
                  <Cell
                    key={i}
                    fill={
                      b.aqi == null
                        ? NO_DATA_COLOR
                        : b.origin === "mock"
                          ? `url(#eaqi-hatch-${b.band?.id ?? "none"})`
                          : (b.band?.color ?? NO_DATA_COLOR)
                    }
                  />
                ))}
                {/* Marca "sim." sobre las barras simuladas. */}
                <LabelList dataKey="origin" content={<SimLabel />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Densidad por distrito. */}
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

      {/* Atribuciones de las fuentes mostradas en el panel. */}
      {attributions.length > 0 && (
        <p className="text-[10px] leading-tight text-slate-500">
          Fuentes: {attributions.join(" · ")}
        </p>
      )}
    </section>
  );
}

/**
 * Define un patrón rayado por banda EAQI para las barras simuladas. Recharts
 * dibuja SVG, así que los patrones viven en un `<svg>` oculto reutilizable.
 */
function AqiHatchDefs({ bars }: { bars: DistrictAqiBar[] }) {
  // Bandas distintas presentes en barras simuladas (evita patrones duplicados).
  const bands = Array.from(
    new Map(
      bars
        .filter((b) => b.origin === "mock")
        .map((b) => [b.band?.id ?? "none", b.band?.color ?? NO_DATA_COLOR] as const),
    ),
  );
  if (bands.length === 0) return null;
  return (
    <svg width="0" height="0" aria-hidden="true" className="absolute">
      <defs>
        {bands.map(([id, color]) => (
          <pattern
            key={id}
            id={`eaqi-hatch-${id}`}
            patternUnits="userSpaceOnUse"
            width={6}
            height={6}
            patternTransform="rotate(45)"
          >
            <rect width={6} height={6} fill={color} fillOpacity={0.35} />
            <line x1={0} y1={0} x2={0} y2={6} stroke={color} strokeWidth={2} />
          </pattern>
        ))}
      </defs>
    </svg>
  );
}

/** Etiqueta "sim." sobre las barras con origen simulado. */
function SimLabel(props: {
  x?: number;
  y?: number;
  width?: number;
  value?: string;
}) {
  const { x = 0, y = 0, width = 0, value } = props;
  if (value !== "mock") return null;
  return (
    <text
      x={x + width / 2}
      y={y - 2}
      textAnchor="middle"
      fontSize={8}
      fill="#fbbf24"
    >
      sim.
    </text>
  );
}

/** Tooltip del gráfico de AQI: valor o "sin datos", con fila "⚠ simulado". */
function AqiBarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: DistrictAqiBar }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const bar = payload[0].payload;
  return (
    <div style={chartTooltip.contentStyle}>
      <div style={{ color: "#94a3b8" }}>{bar.name}</div>
      <div>EAQI: {bar.aqi != null ? bar.aqi : NO_DATA}</div>
      {bar.band && <div>{bar.band.label}</div>}
      {bar.origin === "mock" && <div style={{ color: "#fbbf24" }}>⚠ simulado</div>}
    </div>
  );
}

function ChartCard({
  title,
  info,
  badge,
  children,
}: {
  title: string;
  info?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative rounded-lg border border-base-500/40 bg-base-700/40 p-3">
      <div className="mb-2 flex items-center gap-1 text-[11px] font-medium text-slate-300">
        <span>{title}</span>
        {info}
        {badge && <span className="ml-auto">{badge}</span>}
      </div>
      {children}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ background: it.color }} />
          {it.label}
        </li>
      ))}
    </ul>
  );
}
