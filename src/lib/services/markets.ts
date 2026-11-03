import { BERLIN_BBOX, CONFIG } from "@/lib/config";
import { safeFetchJson } from "@/lib/http";
import type { MarketPoint, SourceBlock } from "@/lib/types";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function text(record: JsonRecord, names: string[]): string {
  for (const name of names) {
    const value = record[name];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function number(record: JsonRecord, names: string[]): number | null {
  for (const name of names) {
    const value = record[name];
    const parsed =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value.replace(",", "."))
          : NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function categoryFor(record: JsonRecord, name: string): MarketPoint["category"] {
  const value = `${name} ${text(record, ["art", "typ", "kategorie", "category", "angebot"])}`.toLowerCase();
  if (/(floh|trödel|troedel|antik)/.test(value)) return "flea";
  if (/(bauern|farmer|bio|regional|wochenmarkt)/.test(value)) return "farmers";
  if (/(mini|kleinmarkt|minimarkt)/.test(value)) return "mini-market";
  return "market";
}

function inBerlin(position: [number, number]): boolean {
  return (
    position[0] >= BERLIN_BBOX.west &&
    position[0] <= BERLIN_BBOX.east &&
    position[1] >= BERLIN_BBOX.south &&
    position[1] <= BERLIN_BBOX.north
  );
}

function positionFromRecord(record: JsonRecord): [number, number] | null {
  const longitude = number(record, ["longitude", "lon", "lng", "laengengrad", "x"]);
  const latitude = number(record, ["latitude", "lat", "breitengrad", "y"]);
  return longitude !== null && latitude !== null ? [longitude, latitude] : null;
}

function normalizeRecord(record: JsonRecord, index: number, sourceUrl: string): MarketPoint | null {
  const name = text(record, ["name", "markt", "marktname", "bezeichnung", "titel", "title"]);
  const position = positionFromRecord(record);
  if (!name || !position || !inBerlin(position)) return null;
  return {
    id: text(record, ["id"]) || `market-${index}`,
    name,
    category: categoryFor(record, name),
    address: text(record, ["adresse", "address", "anschrift", "standort", "ort"]),
    schedule: text(record, ["oeffnungszeiten", "öffnungszeiten", "zeiten", "tage", "schedule"]),
    organizer: text(record, ["veranstalter", "organizer", "anbieter"]),
    position,
    sourceUrl,
  };
}

function recordsFromResponse(raw: unknown): JsonRecord[] {
  if (!isRecord(raw)) return [];
  const index = raw.index;
  if (Array.isArray(index)) return index.filter(isRecord);
  const features = raw.features;
  if (!Array.isArray(features)) return [];
  return features.flatMap((feature) => {
    if (!isRecord(feature) || !isRecord(feature.properties) || !isRecord(feature.geometry)) return [];
    const coordinates = feature.geometry.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) return [];
    return [{ ...feature.properties, longitude: coordinates[0], latitude: coordinates[1] }];
  });
}

/** Obtiene mercados publicados en vivo por la SimpleSearch de Berlín. */
export async function fetchMarkets(): Promise<SourceBlock<MarketPoint[]>> {
  if (CONFIG.useMockData) return { data: [], origin: "unavailable", fetchedAt: null };

  const base = CONFIG.marketsApiBase.replace(/\/+$/, "");
  const geoJsonUrl = `${base}/index/all.geojson`;
  const raw =
    (await safeFetchJson<unknown>(geoJsonUrl)) ??
    (await safeFetchJson<unknown>(`${base}/index/all.json`));
  const records = recordsFromResponse(raw);
  if (!records.length) return { data: [], origin: "unavailable", fetchedAt: null };

  const data = records
    .map((record, index) => normalizeRecord(record, index, geoJsonUrl))
    .filter((market): market is MarketPoint => market !== null);
  return data.length
    ? { data, origin: "live", fetchedAt: new Date().toISOString() }
    : { data: [], origin: "unavailable", fetchedAt: null };
}
