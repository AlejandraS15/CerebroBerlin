import { describe, it, expect } from "vitest";
import { buildDeckLayers } from "./buildDeckLayers";
import { BERLIN_DISTRICTS } from "@/data/districts";
import {
  MOCK_AIR,
  MOCK_WEATHER,
  MOCK_BIKES,
  MOCK_TRANSIT,
  MOCK_HOTSPOTS,
  MOCK_INFRA,
  MOCK_TIMESERIES,
} from "@/data/mock";
import type { CityDataset, LayerId } from "@/lib/types";
import { DATA_ELEVATION_M } from "@/lib/mapStyle";

const dataset: CityDataset = {
  districts: BERLIN_DISTRICTS,
  transit: MOCK_TRANSIT,
  bikes: MOCK_BIKES,
  air: MOCK_AIR,
  weather: MOCK_WEATHER,
  hotspots: MOCK_HOTSPOTS,
  infrastructure: MOCK_INFRA,
  timeSeries: MOCK_TIMESERIES,
  source: {
    transit: "mock",
    bikes: "mock",
    air: "mock",
    weather: "mock",
    districts: "mock",
  },
};

const allVisible: Record<LayerId, boolean> = {
  mobility: true,
  air: true,
  weather: true,
  demographics: true,
  infrastructure: true,
  hotspots: true,
};

describe("buildDeckLayers", () => {
  it("crea todas las capas esperadas, incluida la de clima", () => {
    const layers = buildDeckLayers({
      data: dataset,
      visibility: allVisible,
      activity: 0.5,
      onDistrictClick: () => {},
      onHover: () => {},
    });

    const ids = layers.map((l) => l.id);
    expect(ids).toContain("districts");
    expect(ids).toContain("air-heat");
    expect(ids).toContain("air-points");
    expect(ids).toContain("transit");
    expect(ids).toContain("bikes");
    expect(ids).toContain("weather");
    expect(ids).toContain("hotspots");
  });

  it("propaga la visibilidad a cada capa", () => {
    const visibility: Record<LayerId, boolean> = {
      ...allVisible,
      weather: false,
    };
    const layers = buildDeckLayers({
      data: dataset,
      visibility,
      activity: 0,
      onDistrictClick: () => {},
      onHover: () => {},
    });
    const weather = layers.find((l) => l.id === "weather");
    expect(weather?.props.visible).toBe(false);
  });

  it("apoya los puntos sobre la cota del terreno", () => {
    const layers = buildDeckLayers({
      data: dataset,
      visibility: allVisible,
      activity: 0,
      onDistrictClick: () => {},
      onHover: () => {},
    });
    const transit = layers.find((l) => l.id === "transit");
    const { getPosition } = transit!.props as unknown as {
      getPosition: (d: unknown) => number[];
    };
    const [lng, lat, z] = getPosition(MOCK_TRANSIT[0]);
    expect([lng, lat]).toEqual(MOCK_TRANSIT[0].position);
    expect(z).toBe(DATA_ELEVATION_M);
  });
});
