import type { CityDataset } from "@/lib/types";
import { fetchAirQuality } from "./airQuality";
import { fetchTransit } from "./transit";
import { fetchBikeshare } from "./bikeshare";
import { fetchDistricts } from "./openData";
import { MOCK_HOTSPOTS, MOCK_INFRA, MOCK_TIMESERIES } from "@/data/mock";

/**
 * Compone el snapshot completo de datos de la ciudad ejecutando todos los
 * servicios en paralelo. Cada servicio ya trae su propio fallback a mock,
 * por lo que esta función nunca falla; solo agrega.
 */
export async function fetchCityData(): Promise<CityDataset> {
  const [air, transit, bikes, districts] = await Promise.all([
    fetchAirQuality(),
    fetchTransit(),
    fetchBikeshare(),
    fetchDistricts(),
  ]);

  return {
    districts: districts.data,
    transit: transit.data,
    bikes: bikes.data,
    air: air.data,
    // Hotspots e infraestructura no tienen aún fuente pública unificada:
    // se sirven desde el paquete de datos de demostración.
    hotspots: MOCK_HOTSPOTS,
    infrastructure: MOCK_INFRA,
    timeSeries: MOCK_TIMESERIES,
    source: {
      transit: transit.source,
      bikes: bikes.source,
      air: air.source,
      districts: districts.source,
    },
  };
}
