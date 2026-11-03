import { CONFIG, BERLIN_BBOX } from "@/lib/config";
import { safeFetchJson } from "@/lib/http";
import type { Departure, SourceBlock, TransitStation } from "@/lib/types";
import { MOCK_TRANSIT } from "@/data/mock";

// Respuesta parcial del endpoint /locations/nearby de transport.rest (HAFAS).
interface VbbStop {
  id: string;
  name: string;
  location?: { longitude?: number; latitude?: number };
  products?: Record<string, boolean>;
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
 * Obtiene paradas de transporte cercanas al centro de Berlín desde la API
 * pública de BVG (transport.rest), incluidos los buses. Ante fallo o modo mock,
 * devuelve datos mock.
 */
export async function fetchTransit(): Promise<SourceBlock<TransitStation[]>> {
  if (CONFIG.useMockData) {
    return { data: MOCK_TRANSIT, origin: "mock", fetchedAt: null };
  }

  const cx = (BERLIN_BBOX.west + BERLIN_BBOX.east) / 2;
  const cy = (BERLIN_BBOX.south + BERLIN_BBOX.north) / 2;
  const url = `${CONFIG.vbbApiBase}/locations/nearby?latitude=${cy}&longitude=${cx}&results=100&distance=8000`;

  const raw = await safeFetchJson<VbbStop[]>(url);
  if (!raw || !Array.isArray(raw) || raw.length === 0) {
    return { data: MOCK_TRANSIT, origin: "mock", fetchedAt: null };
  }

  const data: TransitStation[] = raw
    .filter((s) => s.location?.longitude != null && s.location?.latitude != null)
    .map((s) => ({
      id: s.id,
      name: s.name,
      mode: classifyMode(s.products),
      lines: [],
      position: [s.location!.longitude!, s.location!.latitude!] as [number, number],
    }));

  if (data.length === 0) {
    return { data: MOCK_TRANSIT, origin: "mock", fetchedAt: null };
  }

  // Enriquecemos estaciones representativas, incluyendo buses, con salidas live.
  // Limitamos la cantidad para no saturar la API (rate limit 100/min).
  const withDepartures = await Promise.all(
    data.slice(0, 12).map(async (s) => {
      const departures = await fetchDepartures(s.id);
      return {
        ...s,
        lines: [...new Set(departures.map((d) => d.line).filter((line) => line !== "—"))].slice(0, 6),
        departures,
      };
    }),
  );
  const merged = [...withDepartures, ...data.slice(6)];

  return { data: merged, origin: "live", fetchedAt: new Date().toISOString() };
}
