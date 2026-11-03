/**
 * Compone el snapshot completo de datos de la ciudad (`CityDataset`).
 *
 * Ejecuta en paralelo los servicios en vivo (aire, estaciones, horario, clima,
 * bicis, transporte y mercados); cada uno degrada a mock por su cuenta, así que esta
 * función nunca falla. Los límites y el perfil histórico de tráfico vienen
 * del lago (`snapshot`); las incidencias se consultan en vivo desde InfraNode.
 * La serie de 24 h se arma con `buildTimeSeries(perfil, horario)`.
 */

import type { BlockId, CityDataset, Origin } from "@/lib/types";
import { fetchAirQuality } from "./airQuality";
import { fetchAirStations } from "./luftguete";
import { fetchHourly } from "./hourly";
import { fetchTransit } from "./transit";
import { fetchBikeshare } from "./bikeshare";
import { fetchWeather } from "./weather";
import { fetchDistricts } from "./openData";
import { fetchTrafficReports } from "./trafficReports";
import { fetchMarkets } from "./markets";
import { buildTimeSeries } from "./timeSeries";
import { trafficProfile, trafficDetectors, infraestructura, lakeProbado } from "@/data/lake";

export async function fetchCityData(): Promise<CityDataset> {
  const districts = fetchDistricts(); // síncrono (lago)
  const [air, airStations, hourly, transit, bikes, weather, hotspots, markets] = await Promise.all([
    fetchAirQuality(),
    fetchAirStations(),
    fetchHourly(),
    fetchTransit(),
    fetchBikeshare(),
    fetchWeather(),
    fetchTrafficReports(),
    fetchMarkets(),
  ]);

  const timeSeries = buildTimeSeries(trafficProfile, hourly.data);

  // `fetchWeather` aún devuelve { data, source }: se normaliza su origen.
  const weatherOrigin: Origin = weather.source === "live" ? "live" : "mock";

  const source: Record<BlockId, Origin> = {
    districts: districts.origin,
    traffic: "snapshot",
    transit: transit.origin,
    bikes: bikes.origin,
    air: air.origin,
    airStations: airStations.origin,
    weather: weatherOrigin,
    hourly: hourly.origin,
    hotspots: hotspots.origin,
    markets: markets.origin,
    infrastructure: "snapshot",
  };

  const fetchedAt: Partial<Record<BlockId, string>> = {};
  const setAt = (id: BlockId, at: string | null) => {
    if (at) fetchedAt[id] = at;
  };
  setAt("districts", districts.fetchedAt);
  setAt("transit", transit.fetchedAt);
  setAt("bikes", bikes.fetchedAt);
  setAt("air", air.fetchedAt);
  setAt("airStations", airStations.fetchedAt);
  setAt("hourly", hourly.fetchedAt);
  setAt("hotspots", hotspots.fetchedAt);
  setAt("markets", markets.fetchedAt);

  return {
    districts: districts.data,
    transit: transit.data,
    bikes: bikes.data,
    air: air.data,
    airStations: airStations.data,
    trafficDetectors,
    weather: weather.data,
    hotspots: hotspots.data,
    markets: markets.data,
    infrastructure: infraestructura.puntos,
    timeSeries,
    source,
    fetchedAt,
    lake: { probado: lakeProbado },
  };
}
