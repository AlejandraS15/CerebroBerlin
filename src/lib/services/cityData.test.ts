import { describe, it, expect, vi } from "vitest";

// Forzamos modo mock ANTES de cualquier import del código de la app, porque
// config.ts evalúa CONFIG.useMockData una sola vez al cargarse el módulo.
process.env.NEXT_PUBLIC_USE_MOCK_DATA = "true";

// En modo mock los servicios no deberían llamar a la red; mockeamos el cliente
// HTTP para garantizar que el ensamblado es offline y determinista.
vi.mock("@/lib/http", () => ({ safeFetchJson: vi.fn().mockResolvedValue(null) }));

describe("fetchCityData (modo mock, offline)", () => {
  it("ensambla un CityDataset completo con la nueva forma", async () => {
    const { fetchCityData } = await import("./cityData");
    const data = await fetchCityData();

    // Secciones principales.
    expect(data.districts.features.length).toBe(12);
    expect(data.air.length).toBeGreaterThan(0);
    expect(data.airStations.length).toBeGreaterThan(0);
    expect(data.trafficDetectors.length).toBeGreaterThan(0);
    expect(data.weather.length).toBeGreaterThan(0);
    expect(data.transit.length).toBeGreaterThan(0);
    expect(data.bikes.length).toBeGreaterThan(0);
    expect(data.timeSeries.length).toBe(24);
  });

  it("marca el origen de cada bloque: snapshot para distritos y tráfico, example para ejemplo", async () => {
    const { fetchCityData } = await import("./cityData");
    const data = await fetchCityData();

    // `source` es Record<BlockId, Origin>.
    expect(data.source.districts).toBe("snapshot");
    expect(data.source.traffic).toBe("snapshot");
    expect(data.source.hotspots).toBe("example");
    expect(data.source.infrastructure).toBe("example");

    // En modo mock las fuentes en vivo degradan a "mock".
    expect(data.source.air).toBe("mock");
    expect(data.source.weather).toBe("mock");
    expect(data.source.airStations).toBe("mock");
  });

  it("conserva el origin por punto de aire y estación", async () => {
    const { fetchCityData } = await import("./cityData");
    const data = await fetchCityData();

    // En modo mock, cada punto/estación lleva origin "mock".
    expect(data.air.every((p) => p.origin === "mock")).toBe(true);
    expect(data.airStations.every((s) => s.origin === "mock")).toBe(true);
  });

  it("la serie de 24 h sale del perfil del lago + horario (sin series sintéticas)", async () => {
    const { fetchCityData } = await import("./cityData");
    const data = await fetchCityData();

    const p = data.timeSeries[0];
    // Nueva forma de TimeSeriesPoint: traffic/trafficIndex + aqi + temperature.
    expect(p).toHaveProperty("traffic");
    expect(p).toHaveProperty("trafficIndex");
    expect(p).toHaveProperty("aqi");
    expect(p).toHaveProperty("temperature");
    // Sin campos de las series sintéticas eliminadas.
    expect(p).not.toHaveProperty("mobilityIndex");
    expect(p).not.toHaveProperty("bikeUsage");
    expect(p).not.toHaveProperty("energyDemand");

    // Los puntos de aire traen los contaminantes nuevos.
    expect(data.air[0]).toHaveProperty("o3");
    expect(data.air[0]).toHaveProperty("districtCode");

    // Fecha_Probado del lago presente para los temas snapshot.
    expect(data.lake.probado.poblacion).toBeTruthy();
    expect(data.lake.probado.territorio).toBeTruthy();
  });
});
