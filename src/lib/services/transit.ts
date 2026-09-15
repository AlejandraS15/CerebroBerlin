import { CONFIG, BERLIN_BBOX } from "@/lib/config";
import { safeFetchJson } from "@/lib/http";
import type { TransitStation } from "@/lib/types";
import { MOCK_TRANSIT } from "@/data/mock";

// Respuesta parcial del endpoint /stops de vbb.transport.rest (HAFAS).
interface VbbStop {
  id: string;
  name: string;
  location?: { longitude?: number; latitude?: number };
  products?: Record<string, boolean>;
  lines?: { name?: string }[];
}

function classifyMode(products?: Record<string, boolean>): TransitStation["mode"] {
  if (!products) return "u";
  if (products.subway) return "u";
  if (products.suburban) return "s";
  if (products.tram) return "tram";
  return "bus";
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

  return data.length > 0
    ? { data, source: "live" }
    : { data: MOCK_TRANSIT, source: "mock" };
}
