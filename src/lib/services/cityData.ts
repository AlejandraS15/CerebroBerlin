import type { CityDataset, TimeSeriesPoint, WeatherPoint } from "@/lib/types";
import { fetchAirQuality } from "./airQuality";
import { fetchTransit } from "./transit";
import { fetchBikeshare } from "./bikeshare";
import { fetchWeather } from "./weather";
import { fetchDistricts } from "./openData";
import { MOCK_HOTSPOTS, MOCK_INFRA, MOCK_TIMESERIES } from "@/data/mock";

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Desplaza la curva sintética de temperatura para que su media coincida con la
 * temperatura media observada en el clima real. Si no hay clima, devuelve la
 * serie base sin cambios. Mantiene la forma diaria (mínimo de madrugada, pico
 * de tarde) pero la centra en el valor real.
 */
function shiftSeriesToObservedTemp(
  series: TimeSeriesPoint[],
  weather: WeatherPoint[],
): TimeSeriesPoint[] {
  if (weather.length === 0 || series.length === 0) return series;

  const observedAvg =
    weather.reduce((s, w) => s + w.temperature, 0) / weather.length;
  const baseAvg =
    series.reduce((s, p) => s + p.temperature, 0) / series.length;
  const shift = observedAvg - baseAvg;

  return series.map((p) => ({
    ...p,
    temperature: round1(p.temperature + shift),
  }));
}

/**
 * Compone el snapshot completo de datos de la ciudad ejecutando todos los
 * servicios en paralelo. Cada servicio ya trae su propio fallback a mock,
 * por lo que esta función nunca falla; solo agrega.
 */
export async function fetchCityData(): Promise<CityDataset> {
  const [air, transit, bikes, weather, districts] = await Promise.all([
    fetchAirQuality(),
    fetchTransit(),
    fetchBikeshare(),
    fetchWeather(),
    fetchDistricts(),
  ]);

  // Enriquecemos la serie temporal con la temperatura real actual (si la hay),
  // manteniendo la curva diaria sintética como forma base: desplazamos la
  // curva para que su media coincida con la temperatura observada.
  const timeSeries = shiftSeriesToObservedTemp(MOCK_TIMESERIES, weather.data);

  return {
    districts: districts.data,
    transit: transit.data,
    bikes: bikes.data,
    air: air.data,
    weather: weather.data,
    // Hotspots e infraestructura no tienen aún fuente pública unificada:
    // se sirven desde el paquete de datos de demostración.
    hotspots: MOCK_HOTSPOTS,
    infrastructure: MOCK_INFRA,
    timeSeries,
    source: {
      transit: transit.source,
      bikes: bikes.source,
      air: air.source,
      weather: weather.source,
      districts: districts.source,
    },
  };
}
