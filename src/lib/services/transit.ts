import { CONFIG, BERLIN_BBOX } from "@/lib/config";
import { safeFetchJson } from "@/lib/http";
import type { Departure, TransitStation } from "@/lib/types";
import { MOCK_TRANSIT } from "@/data/mock";

// Respuesta parcial del endpoint /stops de vbb.transport.rest (HAFAS).
interface VbbStop {
  id: string;
  name: string;
  location?: { longitude?: number; latitude?: number };
  products?: Record<string, boolean>;
  lines?: { name?: string }[];
}

// Respuesta parcial de /stops/{id}/departures.
interface VbbDeparture {
  when?: string | null;
  plannedWhen?: string | null;
  delay?: number | null; // segundos
  direction?: string | null;
  line?: { name?: string | null } | null;
}
interface VbbDeparturesResponse {
  departures?: VbbDeparture[];
}

export function classifyMode(
  products?: Record<string, boolean>,
): TransitStation["mode"] {
  if (!products) return "u";
  if (products.subway) return "u";
  if (products.suburban) return "s";
  if (products.tram) return "tram";
  return "bus";
}

/** Normaliza la respuesta cruda de VBB a nuestro tipo Departure. */
export function mapDepartures(raw: VbbDeparture[], limit = 4): Departure[] {
  return raw.slice(0, limit).map((d) => ({
    line: d.line?.name ?? "—",
    direction: d.direction ?? "—",
    when: d.when ?? d.plannedWhen ?? null,
    delayMin: d.delay != null ? Math.round(d.delay / 60) : null,
  }));
}

/** Obtiene las próximas salidas de una estación (o [] si falla). */
async function fetchDepartures(stopId: string): Promise<Departure[]> {
  const url = `${CONFIG.vbbApiBase}/stops/${encodeURIComponent(
    stopId,
  )}/departures?results=4&duration=60`;
  const raw = await safeFetchJson<VbbDeparturesResponse>(url);
  return raw?.departures ? mapDepartures(raw.departures) : [];
}

/**
 * Obtiene estaciones de transporte cercanas al centro de Berlín desde la API
 * pública de VBB (transport.rest). Ante fallo o modo mock, devuelve datos mock.
 */
export async function fetchTransit(): Promise<{
  data: TransitStation[];
  source: "live" | "mock";
}> {
  if (CONFIG.useMockData) return { data: MOCK_TRANSIT, source: "mock" };

  const cx = (BERLIN_BBOX.west + BERLIN_BBOX.east) / 2;
  const cy = (BERLIN_BBOX.south + BERLIN_BBOX.north) / 2;
  const url = `${CONFIG.vbbApiBase}/stops/nearby?latitude=${cy}&longitude=${cx}&results=60&distance=8000&subway=true&suburban=true`;

  const raw = await safeFetchJson<VbbStop[]>(url);
  if (!raw || !Array.isArray(raw) || raw.length === 0) {
    return { data: MOCK_TRANSIT, source: "mock" };
  }

  const data: TransitStation[] = raw
    .filter((s) => s.location?.longitude != null && s.location?.latitude != null)
    .map((s) => ({
      id: s.id,
      name: s.name,
      mode: classifyMode(s.products),
      lines: (s.lines ?? []).map((l) => l.name ?? "").filter(Boolean).slice(0, 6),
      position: [s.location!.longitude!, s.location!.latitude!] as [number, number],
    }));

  if (data.length === 0) return { data: MOCK_TRANSIT, source: "mock" };

  // Enriquecemos las 6 primeras estaciones con salidas en tiempo real.
  // Limitamos la cantidad para no saturar la API (rate limit 100/min).
  const withDepartures = await Promise.all(
    data.slice(0, 6).map(async (s) => ({
      ...s,
      departures: await fetchDepartures(s.id),
    })),
  );
  const merged = [...withDepartures, ...data.slice(6)];

  return { data: merged, source: "live" };
}
