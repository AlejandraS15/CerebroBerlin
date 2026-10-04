import { describe, it, expect } from "vitest";

// Forzamos modo mock ANTES de cualquier import del código de la app, porque
// config.ts evalúa CONFIG.useMockData una sola vez al cargarse el módulo.
process.env.NEXT_PUBLIC_USE_MOCK_DATA = "true";

describe("fetchCityData (modo mock, offline)", () => {
  it("ensambla un CityDataset completo con todas las secciones", async () => {
    const { fetchCityData } = await import("./cityData");
    const data = await fetchCityData();

    expect(data.districts.features.length).toBe(12);
    expect(data.air.length).toBeGreaterThan(0);
    expect(data.weather.length).toBeGreaterThan(0);
    expect(data.transit.length).toBeGreaterThan(0);
    expect(data.bikes.length).toBeGreaterThan(0);
    expect(data.timeSeries.length).toBe(24);

    // En modo mock todas las fuentes deben marcarse como "mock".
    expect(data.source.air).toBe("mock");
    expect(data.source.weather).toBe("mock");

    // Los puntos de aire traen el nuevo campo o3.
    expect(data.air[0]).toHaveProperty("o3");
    // La serie temporal trae temperatura.
    expect(data.timeSeries[0]).toHaveProperty("temperature");
  });
});
