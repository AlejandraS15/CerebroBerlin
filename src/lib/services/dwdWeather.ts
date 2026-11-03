import { CONFIG } from "@/lib/config";
import { safeFetchText } from "@/lib/http";

export interface DwdStation {
  id: string;
  name: string;
  position: [number, number];
}

export interface DwdObservation {
  stationId: string;
  observedAt: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
}

export const DWD_STATIONS: readonly DwdStation[] = [
  { id: "10381", name: "Berlin-Dahlem", position: [13.301731, 52.453711] },
  { id: "10384", name: "Berlin-Tempelhof", position: [13.401981, 52.467551] },
  { id: "10385", name: "Berlin Brandenburg", position: [13.530429, 52.380535] },
];

export function buildDwdWeatherUrl(stationId: string): string {
  return `${CONFIG.dwdWeatherBase}/${stationId}-BEOB.csv`;
}

function numberValue(value: string | undefined): number | null {
  if (!value || value === "---") return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function weatherCode(cloudCover: number | null, presentWeather: number | null): number {
  if (presentWeather != null) return presentWeather;
  if (cloudCover == null) return 3;
  if (cloudCover === 0) return 0;
  if (cloudCover <= 50) return 2;
  return 3;
}

export function parseDwdObservation(csv: string, stationId: string): DwdObservation | null {
  const rows = csv.trim().split(/\r?\n/).map((line) => line.split(";"));
  if (rows.length < 4 || rows[0][0] !== "surface observations") return null;
  const row = rows[3];
  const temperature = numberValue(row[9]);
  const humidity = numberValue(row[37]);
  const windSpeed = numberValue(row[23]);
  if (temperature == null || humidity == null || windSpeed == null) return null;
  const cloudCover = numberValue(row[2]);
  const presentWeather = numberValue(row[35]);
  return {
    stationId,
    observedAt: `${row[0] ?? ""} ${row[1] ?? ""} UTC`,
    temperature,
    humidity,
    windSpeed,
    weatherCode: weatherCode(cloudCover, presentWeather),
  };
}

export async function fetchDwdObservations(): Promise<DwdObservation[]> {
  const results = await Promise.all(
    DWD_STATIONS.map(async (station) => {
      const csv = await safeFetchText(buildDwdWeatherUrl(station.id));
      return csv ? parseDwdObservation(csv, station.id) : null;
    }),
  );
  return results.filter((observation): observation is DwdObservation => observation !== null);
}
