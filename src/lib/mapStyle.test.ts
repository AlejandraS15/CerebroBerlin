import { describe, it, expect } from "vitest";
import type { StyleSpecification } from "maplibre-gl";
import {
  buildCityStyle,
  fallbackCityStyle,
  TERRAIN_EXAGGERATION,
} from "./mapStyle";

// Estilo base mínimo con el orden real de OpenFreeMap "dark": una etiqueta
// (water_name) aparece ANTES que la huella de edificios y las calles.
const base: StyleSpecification = {
  version: 8,
  sources: { openmaptiles: { type: "vector", url: "https://example.org/planet" } },
  layers: [
    { id: "background", type: "background" },
    { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water" },
    { id: "waterway", type: "line", source: "openmaptiles", "source-layer": "waterway" },
    { id: "water_name", type: "symbol", source: "openmaptiles", "source-layer": "water_name" },
    { id: "building", type: "fill", source: "openmaptiles", "source-layer": "building" },
    { id: "road", type: "line", source: "openmaptiles", "source-layer": "transportation" },
    { id: "place_city", type: "symbol", source: "openmaptiles", "source-layer": "place" },
  ],
};

const ids = (s: StyleSpecification) => s.layers.map((l) => l.id);

describe("buildCityStyle", () => {
  const style = buildCityStyle(base);

  it("activa el terreno con su fuente DEM y el cielo", () => {
    expect(style.terrain?.exaggeration).toBe(TERRAIN_EXAGGERATION);
    const dem = style.sources[style.terrain!.source];
    expect(dem?.type).toBe("raster-dem");
    expect(style.sky).toBeDefined();
  });

  it("sustituye la huella plana de edificios por edificios extruidos", () => {
    expect(ids(style)).not.toContain("building");
    const buildings = style.layers.find((l) => l.id === "buildings-3d");
    expect(buildings?.type).toBe("fill-extrusion");
  });

  it("pone los edificios sobre todo el plano y bajo las etiquetas finales", () => {
    const order = ids(style);
    // Ninguna calle debe pintarse encima de los edificios...
    expect(order.indexOf("buildings-3d")).toBeGreaterThan(order.indexOf("road"));
    // ...pero los nombres de lugares sí quedan por encima.
    expect(order.indexOf("buildings-3d")).toBeLessThan(order.indexOf("place_city"));
  });

  it("pone el relieve sobre agua/suelos y bajo las líneas", () => {
    const order = ids(style);
    expect(order.indexOf("terrain-hillshade")).toBeGreaterThan(order.indexOf("water"));
    expect(order.indexOf("terrain-hillshade")).toBeLessThan(order.indexOf("waterway"));
  });

  it("no muta el estilo base", () => {
    expect(ids(base)).toEqual([
      "background", "water", "waterway", "water_name", "building", "road", "place_city",
    ]);
    expect(base.terrain).toBeUndefined();
  });
});

describe("fallbackCityStyle", () => {
  it("mantiene terreno y relieve aunque no haya mapa base", () => {
    const style = fallbackCityStyle();
    expect(style.terrain).toBeDefined();
    expect(ids(style)).toContain("terrain-hillshade");
    expect(ids(style)).not.toContain("buildings-3d");
  });
});
