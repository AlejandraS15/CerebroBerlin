/**
 * Configuración central leída de variables de entorno (todas opcionales).
 * La app funciona sin ninguna variable gracias a la capa mock.
 */
export const CONFIG = {
  mapStyleUrl:
    process.env.NEXT_PUBLIC_MAP_STYLE_URL ||
    // Estilo abierto de MapLibre (demotiles): no requiere token.
    "https://demotiles.maplibre.org/style.json",
  vbbApiBase:
    process.env.NEXT_PUBLIC_VBB_API_BASE || "https://v6.vbb.transport.rest",
  openaqApiBase:
    process.env.NEXT_PUBLIC_OPENAQ_API_BASE || "https://api.openaq.org/v3",
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
