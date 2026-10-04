import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock del cliente HTTP antes de importar el servicio.
vi.mock("@/lib/http", () => ({ safeFetchJson: vi.fn() }));

import { safeFetchJson } from "@/lib/http";
import {
  fetchAirQuality,
  buildAirQualityUrl,
  pm25ToAqi,
} from "./airQuality";
import { MOCK_AIR } from "@/data/mock";

const mocked = safeFetchJson as unknown as ReturnType<typeof vi.fn>;

describe("pm25ToAqi", () => {
  it("mapea PM2.5 a AQI por tramos EPA", () => {
    expect(pm25ToAqi(0)).toBe(0);
    expect(pm25ToAqi(12)).toBe(50);
    expect(pm25ToAqi(1000)).toBe(500);
  });
});

describe("buildAirQualityUrl", () => {
  it("incluye lat/lon y los parámetros current esperados", () => {
    const url = buildAirQualityUrl(52.5, 13.4);
    expect(url).toContain("latitude=52.5");
    expect(url).toContain("longitude=13.4");
    expect(url).toContain("pm2_5");
    expect(url).toContain("european_aqi");
  });
});

describe("fetchAirQuality", () => {
  beforeEach(() => mocked.mockReset());

  it("mapea respuestas live de Open-Meteo a AirQualityPoint", async () => {
    mocked.mockResolvedValue({
      current: {
        pm2_5: 8.4,
        nitrogen_dioxide: 22,
        ozone: 55,
        european_aqi: 34,
      },
    });

    const { data, source } = await fetchAirQuality();
    expect(source).toBe("live");
    expect(data.length).toBeGreaterThan(0);
    const p = data[0];
    expect(p.pm25).toBe(8); // redondeado
    expect(p.no2).toBe(22);
    expect(p.o3).toBe(55);
    expect(p.aqi).toBe(34);
  });

  it("degrada a mock cuando todas las peticiones fallan", async () => {
    mocked.mockResolvedValue(null);
    const { data, source } = await fetchAirQuality();
    expect(source).toBe("mock");
    expect(data).toBe(MOCK_AIR);
  });
});
