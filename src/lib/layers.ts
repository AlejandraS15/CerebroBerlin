import type { LayerCategory } from "./types";

/**
 * Catálogo de capas del gemelo digital. El LayerController las renderiza
 * y el store controla su visibilidad.
 *
 * `example: true` marca las capas de Datos_de_Ejemplo (hotspots e
 * infraestructura). Es una constante por tipo de capa: la etiqueta
 * "datos de ejemplo (sin fuente)" se deriva de `LAYER_CATALOG[id].example`,
 * nunca del dato. Esas capas se fuerzan a invisibles al iniciar el store
 * (19.4) aunque `defaultVisible` dijera otra cosa; solo las activa un evento
 * explícito del usuario desde el LayerController.
 */
export const LAYER_CATALOG: LayerCategory[] = [
  {
    id: "mobility",
    label: "Movilidad",
    description: "U-Bahn, S-Bahn y micromovilidad (bicis/scooters).",
    icon: "🚇",
    color: "#22d3ee",
    defaultVisible: true,
  },
  {
    id: "air",
    label: "Calidad del Aire",
    description: "EAQI modelado (CAMS/Open-Meteo) en el punto de cada distrito.",
    icon: "🌫️",
    color: "#a78bfa",
    defaultVisible: true,
  },
  {
    id: "airStations",
    label: "Estaciones de Aire",
    description: "Mediciones del Berliner Luftgütemessnetz por estación.",
    icon: "📡",
    color: "#c084fc",
    defaultVisible: false,
  },
  {
    id: "traffic",
    label: "Tráfico",
    description: "Detectores con media horaria de vehículos (perfil jun-2025).",
    icon: "🚗",
    color: "#f97316",
    defaultVisible: false,
  },
  {
    id: "weather",
    label: "Clima",
    description: "Temperatura, humedad y viento por distrito (Open-Meteo).",
    icon: "🌡️",
    color: "#38bdf8",
    defaultVisible: false,
  },
  {
    id: "demographics",
    label: "Demografía",
    description: "Población y densidad por distrito (coropletas).",
    icon: "👥",
    color: "#f59e0b",
    defaultVisible: true,
  },
  {
    id: "infrastructure",
    label: "Infraestructura",
    description: "Hospitales, escuelas, cultura y servicios. Datos de ejemplo (sin fuente).",
    icon: "🏛️",
    color: "#34d399",
    defaultVisible: false,
    example: true,
  },
  {
    id: "hotspots",
    label: "Puntos Críticos",
    description: "Incidencias, obras y congestión. Datos de ejemplo (sin fuente).",
    icon: "⚠️",
    color: "#fb7185",
    defaultVisible: false,
    example: true,
  },
];

/** Vista 2D panorámica: toda la ciudad, cenital. */
export const BERLIN_VIEW = {
  longitude: 13.405,
  latitude: 52.52,
  zoom: 10.4,
  pitch: 0,
  bearing: 0,
};

/**
 * Vista 3D a escala urbana (Museumsinsel / Unter den Linden). Los edificios
 * solo existen a partir de z13, por eso la vista 3D se acerca a la ciudad.
 */
export const CITY_3D_VIEW = {
  longitude: 13.4015,
  latitude: 52.5185,
  zoom: 14.6,
  pitch: 60,
  bearing: -17,
};
