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
    description:
      "Estaciones de transporte público y micromovilidad: cada bolita es una parada de U-Bahn/S-Bahn o una estación de bicis.",
    icon: "🚇",
    // Las bolitas de transporte se colorean por modo; el cian es la micromovilidad (bicis).
    color: "#22d3ee",
    legend: {
      summary: "El color de la bolita indica el modo de transporte:",
      entries: [
        { color: "#2563eb", meaning: "U-Bahn (metro)" },
        { color: "#16a34a", meaning: "S-Bahn (cercanías)" },
        { color: "#dc2626", meaning: "Tranvía" },
        { color: "#a855f7", meaning: "Autobús" },
        { color: "#22d3ee", meaning: "Estación de bicis" },
      ],
    },
    defaultVisible: true,
  },
  {
    id: "air",
    label: "Calidad del Aire",
    description:
      "Índice europeo de calidad del aire (EAQI) modelado en el punto de cada distrito. Una bolita por distrito.",
    icon: "🌫️",
    // La bolita se pinta con el color de su banda EAQI (verde = limpio → granate = muy malo).
    color: "#50f0e6",
    legend: {
      summary: "El color de la bolita sigue las bandas EAQI (verde = aire limpio, rojo/granate = aire muy contaminado):",
      entries: [
        { color: "#50f0e6", meaning: "Buena" },
        { color: "#50ccaa", meaning: "Razonable" },
        { color: "#f0e641", meaning: "Moderada" },
        { color: "#ff5050", meaning: "Mala" },
        { color: "#960032", meaning: "Muy mala / extrema" },
      ],
    },
    defaultVisible: true,
  },
  {
    id: "airStations",
    label: "Estaciones de Aire",
    description:
      "Mediciones reales por estación del Berliner Luftgütemessnetz (PM2.5, PM10, NO₂, O₃). Cada bolita es una estación física.",
    icon: "📡",
    color: "#50f0e6",
    legend: {
      summary: "Igual que la calidad del aire: el color de la bolita es su banda EAQI (verde limpio → granate muy contaminado):",
      entries: [
        { color: "#50f0e6", meaning: "Buena" },
        { color: "#f0e641", meaning: "Moderada" },
        { color: "#ff5050", meaning: "Mala" },
        { color: "#960032", meaning: "Muy mala / extrema" },
      ],
    },
    defaultVisible: false,
  },
  {
    id: "traffic",
    label: "Tráfico",
    description:
      "Detectores de vehículos con media horaria (perfil típico de junio de 2025). Cambia con la hora del timeline.",
    icon: "🚗",
    color: "#f97316",
    legend: {
      summary:
        "Cada detector se dibuja como un tramo alineado con la vía: cuanto más grueso y rojo, más vehículos/hora; fino y verde = tráfico fluido. El gris significa que a esa hora no hay dato:",
      entries: [
        { color: "#4ade80", meaning: "Tráfico fluido (pocos vehículos)" },
        { color: "#f59e0b", meaning: "Tráfico medio" },
        { color: "#ef4444", meaning: "Tráfico denso (muchos vehículos)" },
        { color: "#94a3b8", meaning: "Sin dato a esa hora" },
      ],
    },
    defaultVisible: false,
  },
  {
    id: "weather",
    label: "Clima",
    description:
      "Temperatura, humedad y viento por distrito (Open-Meteo). Una bolita por distrito coloreada por temperatura.",
    icon: "🌡️",
    color: "#38bdf8",
    legend: {
      summary: "El color de la bolita indica la temperatura: azul = frío, rojo = calor:",
      entries: [
        { color: "#2878e6", meaning: "Frío (≈ −5 °C)" },
        { color: "#7ce0a0", meaning: "Templado (≈ 15 °C)" },
        { color: "#ff3c1e", meaning: "Caluroso (≈ 35 °C)" },
      ],
    },
    defaultVisible: false,
  },
  {
    id: "demographics",
    label: "Demografía",
    description:
      "Población y densidad por distrito, pintadas como áreas de color (coropletas) sobre el mapa.",
    icon: "👥",
    color: "#f59e0b",
    legend: {
      summary: "El color del distrito indica la densidad de población: cuanto más rojo, más gente por km²:",
      entries: [
        { color: "#f59e0b", meaning: "Baja densidad (pocos habitantes/km²)" },
        { color: "#ea7a2e", meaning: "Densidad media" },
        { color: "#ef4444", meaning: "Alta densidad (mucha gente/km²)" },
      ],
    },
    defaultVisible: true,
  },
  {
    id: "infrastructure",
    label: "Infraestructura",
    description:
      "Hospitales, escuelas, cultura y servicios. Cada punto usa el icono de su tipo. Datos de ejemplo (sin fuente).",
    icon: "🏛️",
    color: "#34d399",
    legend: {
      summary: "Cada equipamiento se marca con el icono de su categoría:",
      entries: [
        { icon: "🏥", meaning: "Hospital" },
        { icon: "🏫", meaning: "Escuela" },
        { icon: "🎭", meaning: "Cultura (museos, teatros…)" },
        { icon: "⚡", meaning: "Energía" },
        { icon: "💧", meaning: "Agua" },
      ],
    },
    defaultVisible: false,
    example: true,
  },
  {
    id: "hotspots",
    label: "Puntos Críticos",
    description:
      "Incidencias, obras y congestión. La bolita más grande y roja indica mayor severidad. Datos de ejemplo (sin fuente).",
    icon: "⚠️",
    color: "#fb7185",
    legend: {
      summary: "Cuanto más grande y roja es la bolita, más grave es la incidencia:",
      entries: [
        { color: "#facc15", meaning: "Severidad baja" },
        { color: "#fb923c", meaning: "Severidad media" },
        { color: "#f87171", meaning: "Severidad alta" },
      ],
    },
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
