import { BERLIN_BBOX, CONFIG } from "@/lib/config";
import { safeFetchJson } from "@/lib/http";
import type { Hotspot, SourceBlock } from "@/lib/types";

interface TrafficReportEvent {
  id?: unknown;
  type?: unknown;
  comment?: unknown;
  latitude?: unknown;
  longitude?: unknown;
}

interface TrafficReportsResponse {
  data?: {
    observed_at?: unknown;
    retrieved_at?: unknown;
    payload?: {
      events?: unknown;
    };
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function eventType(type: string): Hotspot["type"] {
  const normalized = type.toLowerCase();
  if (/(accident|collision|crash|unfall)/.test(normalized)) return "accidente";
  if (/(maintenance|roadwork|construction|works|baustelle|sperr)/.test(normalized)) {
    return "obra";
  }
  if (/(congestion|traffic|jam|stau|delay)/.test(normalized)) return "congestion";
  return "alerta";
}

function severityFor(type: Hotspot["type"], comment: string): Hotspot["severity"] {
  const normalized = comment.toLowerCase();
  if (
    type === "accidente" ||
    /(vollsperrung|gesperrt|blocked|closure|sperrung|umleitung)/.test(normalized)
  ) {
    return 3;
  }
  if (type === "obra" || /(stau|congestion|delay|verzögerung)/.test(normalized)) return 2;
  return 1;
}

function reportTitle(type: Hotspot["type"], comment: string): string {
  const labels: Record<Hotspot["type"], string> = {
    accidente: "Accidente",
    obra: "Obra o mantenimiento",
    congestion: "Congestión",
    alerta: "Alerta de tráfico",
  };
  const summary = comment.trim().replace(/\s+/g, " ");
  return summary ? `${labels[type]}: ${summary}` : labels[type];
}

function isTrafficReportEvent(value: unknown): value is TrafficReportEvent {
  return typeof value === "object" && value !== null;
}

function toHotspot(event: TrafficReportEvent, index: number, reportedAt: string): Hotspot | null {
  if (!isFiniteNumber(event.latitude) || !isFiniteNumber(event.longitude)) return null;
  if (
    event.longitude < BERLIN_BBOX.west ||
    event.longitude > BERLIN_BBOX.east ||
    event.latitude < BERLIN_BBOX.south ||
    event.latitude > BERLIN_BBOX.north
  ) {
    return null;
  }

  const rawType = typeof event.type === "string" ? event.type : "TrafficReport";
  const comment = typeof event.comment === "string" ? event.comment : "";
  const type = eventType(rawType);
  return {
    id: typeof event.id === "string" && event.id ? event.id : `traffic-report-${index}`,
    type,
    title: reportTitle(type, comment),
    district: "Berlín",
    position: [event.longitude, event.latitude],
    severity: severityFor(type, comment),
    reportedAt,
  };
}

/**
 * Obtiene incidencias, obras, bloqueos y congestiones publicadas por SenMVKU
 * mediante el endpoint DATEX-II de InfraNode. No crea incidencias sintéticas:
 * una respuesta válida sin eventos devuelve una lista vacía.
 */
export async function fetchTrafficReports(): Promise<SourceBlock<Hotspot[]>> {
  if (CONFIG.useMockData) {
    return { data: [], origin: "unavailable", fetchedAt: null };
  }

  const url = `${CONFIG.trafficReportsApiBase}/api/v1/live/berlin/traffic-reports`;
  const raw = await safeFetchJson<TrafficReportsResponse>(url);
  if (!raw?.data) {
    return { data: [], origin: "unavailable", fetchedAt: null };
  }
  const responseData = raw.data;
  const events = responseData?.payload?.events;
  if (!responseData || !Array.isArray(events)) {
    return { data: [], origin: "unavailable", fetchedAt: null };
  }

  const observedAt =
    typeof responseData.observed_at === "string"
      ? responseData.observed_at
      : typeof responseData.retrieved_at === "string"
        ? responseData.retrieved_at
        : new Date().toISOString();
  const hotspots = events
    .filter(isTrafficReportEvent)
    .map((event, index) => toHotspot(event, index, observedAt))
    .filter((event): event is Hotspot => event !== null);

  return { data: hotspots, origin: "live", fetchedAt: observedAt };
}
