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

/**
 * Altitud media aproximada de Berlín (m s. n. m.). deck.gl apunta la cámara a
 * la superficie del terreno, así que los datos a z=0 quedarían "hundidos"; los
 * elevamos a esta cota (ya exagerada) para que se apoyen sobre el relieve.
 */
const BERLIN_MEAN_ELEVATION_M = 40;
export const DATA_ELEVATION_M = BERLIN_MEAN_ELEVATION_M * TERRAIN_EXAGGERATION;

/** Zoom mínimo al que el esquema OpenMapTiles entrega la capa de edificios. */
export const BUILDINGS_MIN_ZOOM = 13;

const TERRAIN_SOURCE_ID = "terrain-dem";
// MapLibre recomienda una fuente DEM separada para hillshade y para terreno.
const HILLSHADE_SOURCE_ID = "hillshade-dem";
const BUILDING_SOURCE_LAYER = "building";

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

const HILLSHADE_LAYER: LayerSpecification = {
  id: "terrain-hillshade",
  type: "hillshade",
  source: HILLSHADE_SOURCE_ID,
  paint: {
    "hillshade-exaggeration": 0.45,
    "hillshade-shadow-color": "#000000",
    "hillshade-highlight-color": "#94a3b8",
    "hillshade-accent-color": "#0f172a",
  },
};

type FillExtrusionLayer = Extract<LayerSpecification, { type: "fill-extrusion" }>;
/** Tipo de una expresión de estilo MapLibre (derivado de la spec). */
type StyleExpression = Extract<
  NonNullable<FillExtrusionLayer["paint"]>["fill-extrusion-height"],
  unknown[]
>;

function buildingsLayer(source: string): FillExtrusionLayer {
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
        0, "#1e293b",
        20, "#334155",
        50, "#475569",
        100, "#64748b",
        200, "#94a3b8",
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
export function buildCityStyle(base: StyleSpecification): StyleSpecification {
  const baseLayers = base.layers ?? [];

  // La huella plana de edificios se sustituye por la versión extruida.
  const footprint = baseLayers.find(isBuildingFootprint);
  const buildingSource =
    footprint && "source" in footprint ? footprint.source : undefined;
  const layers = baseLayers.filter((l) => !isBuildingFootprint(l));

  // Edificios justo después de la última capa de "suelo" (calles, vías,
  // límites): así nada del plano se pinta encima de los volúmenes y solo las
  // etiquetas finales (barrios, ciudades) quedan por encima. En OpenMapTiles
  // hay etiquetas intercaladas antes de las calles, por eso no basta con
  // insertar antes del primer "symbol".
  const buildingsAt = layers.findLastIndex((l) => l.type !== "symbol") + 1;
  if (buildingSource) layers.splice(buildingsAt, 0, buildingsLayer(buildingSource));

  // Relieve por encima de suelos/agua pero por debajo de calles y edificios.
  const firstLine = layers.findIndex((l) => l.type === "line");
  const hillshadeAt = firstLine === -1 ? buildingsAt : Math.min(firstLine, buildingsAt);
  layers.splice(hillshadeAt, 0, HILLSHADE_LAYER);

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
      "sky-color": "#070b14",
      "horizon-color": "#1e3a5f",
      "fog-color": "#070b14",
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
export function fallbackCityStyle(): StyleSpecification {
  return buildCityStyle({
    version: 8,
    sources: {},
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#070b14" } },
    ],
  });
}
