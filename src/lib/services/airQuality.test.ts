import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock del cliente HTTP antes de importar el servicio.
vi.mock("@/lib/http", () => ({ safeFetchJson: vi.fn() }));

import { safeFetchJson } from "@/lib/http";
import { fetchAirQuality, buildAirQualityUrl } from "./airQuality";
import { MOCK_AIR } from "@/data/mock";
import { DISTRICT_LIST } from "@/data/districts";

const mocked = safeFetchJson as unknown as ReturnType<typeof vi.fn>;

describe("buildAirQualityUrl", () => {
  it("incluye lat/lon y los 5 parámetros current del EAQI (sin pm25ToAqi)", () => {
    const url = buildAirQualityUrl(52.5, 13.4);
    expect(url).toContain("latitude=52.5");
    expect(url).toContain("longitude=13.4");
    // Los 5 parámetros current esperados.
    expect(url).toContain("european_aqi");
    expect(url).toContain("pm2_5");
    expect(url).toContain("pm10");
    expect(url).toContain("nitrogen_dioxide");
    expect(url).toContain("ozone");
  });
});

describe("fetchAirQuality", () => {
  beforeEach(() => mocked.mockReset());

  it("mapea respuestas live de Open-Meteo a AirQualityPoint por Código_de_Distrito", async () => {
    mocked.mockResolvedValue({
      current: {
        pm2_5: 8.4,
        nitrogen_dioxide: 22,
        ozone: 55,
        european_aqi: 34,
      },
    });

    const { data, origin } = await fetchAirQuality();
    expect(origin).toBe("live");
    expect(data.length).toBe(DISTRICT_LIST.length);

    const p = data[0];
    expect(p.districtCode).toBe(DISTRICT_LIST[0].id); // asociado por código
    expect(p.pm25).toBe(8); // redondeado
    expect(p.no2).toBe(22);
    expect(p.o3).toBe(55);
    expect(p.pm10).toBeNull(); // contaminante ausente → null, nunca 0
    expect(p.aqi).toBe(34);
    expect(p.origin).toBe("live");
  });

  it("usa el EAQI del Módulo_EAQI cuando falta european_aqi", async () => {
    // PM2.5 19,5 + O3 104 → EAQI 44 (10.4). Se redondean las concentraciones.
    mocked.mockResolvedValue({
      current: { pm2_5: 19.5, ozone: 104 },
    });
    const { data } = await fetchAirQuality();
    // La concentración se redondea (20 y 104) antes del EAQI; comprobamos que
    // hay un valor y una banda razonable (moderada ≈ 40–59).
    expect(data[0].aqi).not.toBeNull();
    expect(data[0].aqi as number).toBeGreaterThanOrEqual(40);
  });

  it("marca el distrito fallido con origin 'live' y todo en null (no simulado)", async () => {
    // El primer distrito falla; el resto responde.
    const [lon0, lat0] = DISTRICT_LIST[0].point;
    mocked.mockImplementation((url: unknown) => {
      const u = String(url);
      const falla = u.includes(`latitude=${lat0}`) && u.includes(`longitude=${lon0}`);
      if (falla) return Promise.resolve(null);
      return Promise.resolve({ current: { european_aqi: 30, pm2_5: 5 } });
    });

    const { data, origin } = await fetchAirQuality();
    // Hay al menos un éxito → no degrada a mock.
    expect(origin).toBe("live");

    const fallido = data.find((p) => p.districtCode === DISTRICT_LIST[0].id)!;
    expect(fallido.origin).toBe("live");
    expect(fallido.aqi).toBeNull();
    expect(fallido.pm25).toBeNull();
    expect(fallido.o3).toBeNull();
  });

  it("degrada a MOCK_AIR (origin mock) cuando fallan los 12 distritos", async () => {
    mocked.mockResolvedValue(null);
    const { data, origin } = await fetchAirQuality();
    expect(origin).toBe("mock");
    expect(data).toBe(MOCK_AIR);
    // Cada punto del mock lleva origin "mock".
    expect(data.every((p) => p.origin === "mock")).toBe(true);
  });
});
