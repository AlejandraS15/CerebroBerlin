import type { LayerCategory } from "./types";

/**
 * Catálogo de capas del gemelo digital. El LayerController las renderiza
 * y el store controla su visibilidad.
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
    description: "PM2.5, NO2, O3 y AQI europeo por sensor (heatmap).",
    icon: "🌫️",
    color: "#a78bfa",
    defaultVisible: true,
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
    description: "Hospitales, escuelas, cultura y servicios.",
    icon: "🏛️",
    color: "#34d399",
    defaultVisible: false,
  },
  {
    id: "hotspots",
    label: "Puntos Críticos",
    description: "Incidencias, obras y congestión en tiempo real.",
    icon: "⚠️",
    color: "#fb7185",
    defaultVisible: true,
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
