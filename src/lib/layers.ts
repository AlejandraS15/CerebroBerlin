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
    description: "PM2.5, NO2 y AQI por sensor (heatmap).",
    icon: "🌫️",
    color: "#a78bfa",
    defaultVisible: true,
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

/** Vista inicial de la cámara centrada en Berlín. */
export const BERLIN_VIEW = {
  longitude: 13.405,
  latitude: 52.52,
  zoom: 10.4,
  pitch: 45,
  bearing: 0,
};
