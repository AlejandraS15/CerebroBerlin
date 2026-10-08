/**
 * Configuración central leída de variables de entorno (todas opcionales).
 * La app funciona sin ninguna variable gracias a la capa mock.
 */
export const CONFIG = {
  mapStyleUrl:
    process.env.NEXT_PUBLIC_MAP_STYLE_URL ||
    // Estilo oscuro de OpenFreeMap (sin token). Usa el esquema OpenMapTiles,
    // cuya capa "building" trae render_height para extruir edificios en 3D.
    "https://tiles.openfreemap.org/styles/dark",
  // Modelo de elevación (Mapzen/AWS Terrarium, abierto y sin token).
  terrainTilesUrl:
    process.env.NEXT_PUBLIC_TERRAIN_TILES_URL ||
    "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
  vbbApiBase:
    process.env.NEXT_PUBLIC_VBB_API_BASE || "https://v6.vbb.transport.rest",
  // Open-Meteo: APIs abiertas, sin token, con datos reales por coordenada.
  airQualityApiBase:
    process.env.NEXT_PUBLIC_AIR_QUALITY_API_BASE ||
    "https://air-quality-api.open-meteo.com/v1",
  weatherApiBase:
    process.env.NEXT_PUBLIC_WEATHER_API_BASE ||
    "https://api.open-meteo.com/v1",
  // Berliner Luftgütemessnetz (BLUME): estaciones de medición reales, sin token.
  luftgueteApiBase:
    process.env.NEXT_PUBLIC_LUFTGUETE_API_BASE || "https://luftdaten.berlin.de",
  berlinOpenDataBase:
    process.env.NEXT_PUBLIC_BERLIN_OPENDATA_BASE ||
    "https://datenregister.berlin.de/api/3",
  gbfsUrl:
    process.env.NEXT_PUBLIC_GBFS_URL ||
    "https://gbfs.nextbike.net/maps/gbfs/v2/nextbike_bn/gbfs.json",
  useMockData: process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true",
} as const;

/** Bounding box de Berlín [oeste, sur, este, norte] para filtrar consultas. */
export const BERLIN_BBOX = {
  west: 13.088,
  south: 52.338,
  east: 13.761,
  north: 52.675,
} as const;
