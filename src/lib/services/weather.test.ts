import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/http", () => ({ safeFetchJson: vi.fn() }));

import { safeFetchJson } from "@/lib/http";
import { fetchWeather, buildWeatherUrl, weatherCodeLabel } from "./weather";
import { MOCK_WEATHER } from "@/data/mock";
import { DISTRICT_LIST } from "@/data/districts";

const mocked = safeFetchJson as unknown as ReturnType<typeof vi.fn>;

describe("weatherCodeLabel", () => {
  it("traduce códigos WMO a texto", () => {
    expect(weatherCodeLabel(0)).toBe("Despejado");
    expect(weatherCodeLabel(3)).toBe("Nublado");
    expect(weatherCodeLabel(45)).toBe("Niebla");
    expect(weatherCodeLabel(95)).toBe("Tormenta");
  });
});

describe("buildWeatherUrl", () => {
  it("incluye los parámetros current de clima", () => {
    const url = buildWeatherUrl(52.5, 13.4);
    expect(url).toContain("temperature_2m");
    expect(url).toContain("wind_speed_10m");
    expect(url).toContain("latitude=52.5");
  });
});

describe("fetchWeather", () => {
  beforeEach(() => mocked.mockReset());

  it("consulta el Punto_de_Distrito (d.point) de cada distrito del lago", async () => {
    mocked.mockResolvedValue({
      current: {
        temperature_2m: 14.27,
        relative_humidity_2m: 63,
        wind_speed_10m: 11.9,
        weather_code: 2,
      },
    });

    await fetchWeather();

    // Una consulta por distrito, en el punto [lon, lat] del lago.
    expect(mocked).toHaveBeenCalledTimes(DISTRICT_LIST.length);
    const [lon0, lat0] = DISTRICT_LIST[0].point;
    const urls = mocked.mock.calls.map((c) => c[0] as string);
    expect(urls.some((u) => u.includes(`latitude=${lat0}`) && u.includes(`longitude=${lon0}`))).toBe(
      true,
    );
  });

  it("mapea respuestas live a WeatherPoint", async () => {
    mocked.mockResolvedValue({
      current: {
        temperature_2m: 14.27,
        relative_humidity_2m: 63,
        wind_speed_10m: 11.9,
        weather_code: 2,
      },
    });

    const { data, source } = await fetchWeather();
    expect(source).toBe("live");
    const p = data[0];
    expect(p.temperature).toBeCloseTo(14.3, 1);
    expect(p.humidity).toBe(63);
    expect(p.weatherCode).toBe(2);
    // Se posiciona en el punto del distrito.
    expect(p.position).toEqual(DISTRICT_LIST[0].point);
  });

  it("degrada a mock cuando falla la red", async () => {
    mocked.mockResolvedValue(null);
    const { data, source } = await fetchWeather();
    expect(source).toBe("mock");
    expect(data).toBe(MOCK_WEATHER);
  });
});
