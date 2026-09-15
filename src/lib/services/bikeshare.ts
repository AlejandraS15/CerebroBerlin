import { CONFIG, BERLIN_BBOX } from "@/lib/config";
import { safeFetchJson } from "@/lib/http";
import type { BikeStation } from "@/lib/types";
import { MOCK_BIKES } from "@/data/mock";

// ── Tipos parciales del estándar GBFS ──
interface GbfsFeed {
  name: string;
  url: string;
}
interface GbfsDiscovery {
  data?: { [lang: string]: { feeds?: GbfsFeed[] } };
}
interface StationInfo {
  data?: {
    stations?: { station_id: string; name: string; lon: number; lat: number }[];
  };
}
interface StationStatus {
  data?: {
    stations?: {
      station_id: string;
      num_bikes_available: number;
      num_docks_available: number;
    }[];
  };
}

function inBerlin(lon: number, lat: number): boolean {
  return (
    lon >= BERLIN_BBOX.west &&
    lon <= BERLIN_BBOX.east &&
    lat >= BERLIN_BBOX.south &&
    lat <= BERLIN_BBOX.north
  );
}

/**
 * Micromovilidad vía GBFS: descubre feeds, une station_information con
 * station_status y filtra al bbox de Berlín. Fallback a mock.
 */
export async function fetchBikeshare(): Promise<{
  data: BikeStation[];
  source: "live" | "mock";
}> {
  if (CONFIG.useMockData) return { data: MOCK_BIKES, source: "mock" };

  const discovery = await safeFetchJson<GbfsDiscovery>(CONFIG.gbfsUrl);
  const langs = discovery?.data ? Object.values(discovery.data) : [];
  const feeds = langs[0]?.feeds ?? [];
  const infoUrl = feeds.find((f) => f.name === "station_information")?.url;
  const statusUrl = feeds.find((f) => f.name === "station_status")?.url;
  if (!infoUrl || !statusUrl) return { data: MOCK_BIKES, source: "mock" };

  const [info, status] = await Promise.all([
    safeFetchJson<StationInfo>(infoUrl),
    safeFetchJson<StationStatus>(statusUrl),
  ]);
  const stations = info?.data?.stations ?? [];
  const statusMap = new Map(
    (status?.data?.stations ?? []).map((s) => [s.station_id, s]),
  );
  if (stations.length === 0) return { data: MOCK_BIKES, source: "mock" };

  const data: BikeStation[] = stations
    .filter((s) => inBerlin(s.lon, s.lat))
    .map((s) => {
      const st = statusMap.get(s.station_id);
      return {
        id: s.station_id,
        name: s.name,
        position: [s.lon, s.lat] as [number, number],
        bikesAvailable: st?.num_bikes_available ?? 0,
        docksAvailable: st?.num_docks_available ?? 0,
      };
    });

  return data.length > 0
    ? { data, source: "live" }
    : { data: MOCK_BIKES, source: "mock" };
}
