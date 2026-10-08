import { describe, it, expect } from "vitest";
import { buildDeckLayers } from "./buildDeckLayers";
import { BERLIN_DISTRICTS } from "@/data/districts";
import {
  MOCK_AIR,
  MOCK_AIR_STATIONS,
  MOCK_WEATHER,
  MOCK_BIKES,
  MOCK_TRANSIT,
  MOCK_HOTSPOTS,
  MOCK_INFRA,
  MOCK_HOURLY,
} from "@/data/mock";
import { trafficDetectors, trafficProfile } from "@/data/lake";
import { buildTimeSeries } from "@/lib/services/timeSeries";
import type { BlockId, CityDataset, LayerId, Origin } from "@/lib/types";
import type { ElevationSampler } from "@/lib/terrain";

const source: Record<BlockId, Origin> = {
  districts: "snapshot",
  traffic: "snapshot",
  transit: "mock",
  bikes: "mock",
  air: "mock",
  airStations: "mock",
  weather: "mock",
  hourly: "mock",
  hotspots: "example",
  infrastructure: "example",
};

const dataset: CityDataset = {
  districts: BERLIN_DISTRICTS,
  transit: MOCK_TRANSIT,
  bikes: MOCK_BIKES,
  air: MOCK_AIR,
  airStations: MOCK_AIR_STATIONS,
  trafficDetectors,
  weather: MOCK_WEATHER,
  hotspots: MOCK_HOTSPOTS,
  infrastructure: MOCK_INFRA,
  timeSeries: buildTimeSeries(trafficProfile, MOCK_HOURLY),
  source,
  fetchedAt: {},
  lake: { probado: { territorio: "2026-10-07", poblacion: "2026-10-07", verde: "2026-10-07", trafico: "2026-10-07" } },
};

const allVisible: Record<LayerId, boolean> = {
  mobility: true,
  air: true,
  airStations: true,
  traffic: true,
  weather: true,
  demographics: true,
  infrastructure: true,
  hotspots: true,
};

// Sampler fijo: cota disponible (57 m) para comprobar la elevación por punto.
const sampler57: ElevationSampler = () => 57;
// Sampler sin terreno: withElevation debe caer a 0 m.
const samplerNull: ElevationSampler = () => null;

const base = {
  data: dataset,
  visibility: allVisible,
  hour: 8,
  elevationVersion: 1,
  onDistrictClick: () => {},
  onHover: () => {},
};

describe("buildDeckLayers", () => {
  it("crea las capas esperadas de la nueva arquitectura", () => {
    const ids = buildDeckLayers({ ...base, sampler: sampler57 }).map((l) => l.id);
    expect(ids).toContain("districts");
    expect(ids).toContain("air"); // scatter por banda EAQI (ya no heatmap)
    expect(ids).toContain("airStations");
    expect(ids).toContain("traffic");
    expect(ids).toContain("transit");
    expect(ids).toContain("bikes");
    expect(ids).toContain("weather");
    expect(ids).toContain("hotspots");
    expect(ids).toContain("infrastructure");
    expect(ids).not.toContain("air-heat");
  });

  it("propaga la visibilidad a cada capa", () => {
    const layers = buildDeckLayers({
      ...base,
      sampler: sampler57,
      visibility: { ...allVisible, weather: false, traffic: false },
    });
    expect(layers.find((l) => l.id === "weather")?.props.visible).toBe(false);
    expect(layers.find((l) => l.id === "traffic")?.props.visible).toBe(false);
    expect(layers.find((l) => l.id === "air")?.props.visible).toBe(true);
  });

  it("eleva los puntos a la cota del sampler y respalda a 0 m sin terreno", () => {
    const con = buildDeckLayers({ ...base, sampler: sampler57 });
    const transit = con.find((l) => l.id === "transit")!;
    const getPos = (transit.props as unknown as {
      getPosition: (d: unknown) => number[];
    }).getPosition;
    const [lng, lat, z] = getPos(MOCK_TRANSIT[0]);
    expect([lng, lat]).toEqual(MOCK_TRANSIT[0].position);
    expect(z).toBe(57);

    const sin = buildDeckLayers({ ...base, sampler: samplerNull });
    const t2 = sin.find((l) => l.id === "transit")!;
    const getPos2 = (t2.props as unknown as {
      getPosition: (d: unknown) => number[];
    }).getPosition;
    expect(getPos2(MOCK_TRANSIT[0])[2]).toBe(0);
  });

  it("los detectores de tráfico reaccionan a la hora vía updateTriggers", () => {
    const layers = buildDeckLayers({ ...base, sampler: sampler57, hour: 3 });
    const traffic = layers.find((l) => l.id === "traffic")!;
    const triggers = (traffic.props as unknown as {
      updateTriggers: { getRadius: number; getFillColor: number };
    }).updateTriggers;
    expect(triggers.getRadius).toBe(3);
    expect(triggers.getFillColor).toBe(3);
  });
});
