import type {
  LayerSpecification,
  SourceSpecification,
  StyleSpecification,
} from "maplibre-gl";
import { CONFIG } from "@/lib/config";

/**
 * Estilo 3D del gemelo digital: toma un estilo base vectorial (OpenMapTiles) y
 * le añade lo que da volumen real a la ciudad:
 *  - terreno (raster-dem) sobre el que se apoya todo el mapa,
 *  - sombreado de relieve (hillshade) para leer la topografía,
 *  - edificios extruidos con su altura real (render_height de OSM),
 *  - cielo y niebla de horizonte para que el 3D no termine en un corte negro.
 */

export const TERRAIN_EXAGGERATION = 1.3;
export type MapTheme = "dark" | "light";

/** Zoom mínimo al que el esquema OpenMapTiles entrega la capa de edificios. */
export const BUILDINGS_MIN_ZOOM = 13;

/**
 * Id de la fuente raster-dem del terreno. Se exporta para que el muestreador
 * de cotas filtre los eventos `sourcedata` de esta fuente.
 */
export const TERRAIN_SOURCE_ID = "terrain-dem";
// MapLibre recomienda una fuente DEM separada para hillshade y para terreno.
const HILLSHADE_SOURCE_ID = "hillshade-dem";
const BUILDING_SOURCE_LAYER = "building";

function lightMapLayer(layer: LayerSpecification): LayerSpecification {
  const sourceLayer = "source-layer" in layer ? layer["source-layer"] : undefined;
  const id = layer.id.toLowerCase();

  if (layer.type === "background") {
    return {
      ...layer,
      paint: { ...layer.paint, "background-color": "#f8fafc" },
    };
  }

  if (layer.type !== "fill" && layer.type !== "line") return layer;

  const paint = { ...(layer.paint ?? {}) } as Record<string, unknown>;
  if (layer.type === "fill") {
    if (sourceLayer === "water" || sourceLayer === "waterway" || id.includes("water")) {
      paint["fill-color"] = "#dbeafe";
      paint["fill-outline-color"] = "#93c5fd";
    } else if (
      sourceLayer === "park" ||
      sourceLayer === "landcover" ||
      sourceLayer === "landuse" ||
      id.includes("park") ||
      id.includes("green")
    ) {
      paint["fill-color"] = "#dcfce7";
      paint["fill-outline-color"] = "#bbf7d0";
    } else {
      paint["fill-color"] = "#f1f5f9";
      paint["fill-outline-color"] = "#e2e8f0";
    }
  } else if (sourceLayer === "transportation" || id.includes("road")) {
    paint["line-color"] = "#94a3b8";
  }

  return { ...layer, paint: paint as typeof layer.paint } as LayerSpecification;
}

function demSource(): SourceSpecification {
  return {
    type: "raster-dem",
    tiles: [CONFIG.terrainTilesUrl],
    encoding: "terrarium",
    tileSize: 256,
    maxzoom: 15,
    attribution: "Terreno: Mapzen / AWS Terrarium",
  };
}

function hillshadeLayer(theme: MapTheme): LayerSpecification {
  return {
  id: "terrain-hillshade",
  type: "hillshade",
  source: HILLSHADE_SOURCE_ID,
  paint: {
    "hillshade-exaggeration": 0.45,
    "hillshade-shadow-color": theme === "dark" ? "#000000" : "#64748b",
    "hillshade-highlight-color": theme === "dark" ? "#94a3b8" : "#f8fafc",
    "hillshade-accent-color": theme === "dark" ? "#0f172a" : "#334155",
  },
  };
}

type FillExtrusionLayer = Extract<LayerSpecification, { type: "fill-extrusion" }>;
/** Tipo de una expresión de estilo MapLibre (derivado de la spec). */
type StyleExpression = Extract<
  NonNullable<FillExtrusionLayer["paint"]>["fill-extrusion-height"],
  unknown[]
>;

function buildingsLayer(source: string, theme: MapTheme): FillExtrusionLayer {
  const height: StyleExpression = ["coalesce", ["get", "render_height"], 8];
  const base: StyleExpression = ["coalesce", ["get", "render_min_height"], 0];
  return {
    id: "buildings-3d",
    type: "fill-extrusion",
    source,
    "source-layer": BUILDING_SOURCE_LAYER,
    minzoom: BUILDINGS_MIN_ZOOM,
    paint: {
      // Más claro cuanto más alto: facilita leer la silueta urbana.
      "fill-extrusion-color": [
        "interpolate", ["linear"], height,
        ...(theme === "dark"
          ? [0, "#1e293b", 20, "#334155", 50, "#475569", 100, "#64748b", 200, "#94a3b8"]
          : [0, "#cbd5e1", 20, "#94a3b8", 50, "#64748b", 100, "#475569", 200, "#334155"]),
      ],
      // Los edificios "crecen" entre z13 y z14 para evitar un salto brusco.
      "fill-extrusion-height": [
        "interpolate", ["linear"], ["zoom"],
        BUILDINGS_MIN_ZOOM, 0,
        BUILDINGS_MIN_ZOOM + 1, height,
      ],
      "fill-extrusion-base": [
        "interpolate", ["linear"], ["zoom"],
        BUILDINGS_MIN_ZOOM, 0,
        BUILDINGS_MIN_ZOOM + 1, base,
      ],
      "fill-extrusion-opacity": 0.9,
      "fill-extrusion-vertical-gradient": true,
    },
  };
}

function isBuildingFootprint(layer: LayerSpecification): boolean {
  return (
    "source-layer" in layer && layer["source-layer"] === BUILDING_SOURCE_LAYER
  );
}

/**
 * Transforma un estilo base en el estilo 3D de la ciudad. Función pura: no
 * muta el estilo recibido.
 */
export function buildCityStyle(
  base: StyleSpecification,
  theme: MapTheme = "dark",
): StyleSpecification {
  const baseLayers = base.layers ?? [];

  // La huella plana de edificios se sustituye por la versión extruida.
  const footprint = baseLayers.find(isBuildingFootprint);
  const buildingSource =
    footprint && "source" in footprint ? footprint.source : undefined;
  const layers = baseLayers
    .filter((l) => !isBuildingFootprint(l))
    .map((l) => (theme === "light" ? lightMapLayer(l) : l));

  // Edificios justo después de la última capa de "suelo" (calles, vías,
  // límites): así nada del plano se pinta encima de los volúmenes y solo las
  // etiquetas finales (barrios, ciudades) quedan por encima. En OpenMapTiles
  // hay etiquetas intercaladas antes de las calles, por eso no basta con
  // insertar antes del primer "symbol".
  const buildingsAt = layers.findLastIndex((l) => l.type !== "symbol") + 1;
  if (buildingSource) layers.splice(buildingsAt, 0, buildingsLayer(buildingSource, theme));

  // Relieve por encima de suelos/agua pero por debajo de calles y edificios.
  const firstLine = layers.findIndex((l) => l.type === "line");
  const hillshadeAt = firstLine === -1 ? buildingsAt : Math.min(firstLine, buildingsAt);
  layers.splice(hillshadeAt, 0, hillshadeLayer(theme));

  return {
    ...base,
    sources: {
      ...base.sources,
      [TERRAIN_SOURCE_ID]: demSource(),
      [HILLSHADE_SOURCE_ID]: demSource(),
    },
    layers,
    terrain: { source: TERRAIN_SOURCE_ID, exaggeration: TERRAIN_EXAGGERATION },
    sky: {
      "sky-color": theme === "dark" ? "#070b14" : "#e0f2fe",
      "horizon-color": theme === "dark" ? "#1e3a5f" : "#bae6fd",
      "fog-color": theme === "dark" ? "#070b14" : "#f8fafc",
      "sky-horizon-blend": 0.5,
      "horizon-fog-blend": 0.6,
      "fog-ground-blend": 0.35,
    },
  };
}

/**
 * Estilo mínimo para cuando el mapa base no carga: fondo oscuro + relieve.
 * Así el usuario sigue viendo el terreno y los datos encima.
 */
export function fallbackCityStyle(theme: MapTheme = "dark"): StyleSpecification {
  return buildCityStyle({
    version: 8,
    sources: {},
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": theme === "dark" ? "#070b14" : "#f8fafc" },
      },
    ],
  }, theme);
}
