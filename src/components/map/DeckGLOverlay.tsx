"use client";

import { MapboxOverlay, type MapboxOverlayProps } from "@deck.gl/mapbox";
import { useControl } from "react-map-gl/maplibre";

/**
 * Integra Deck.gl como un control/overlay dentro del mapa MapLibre.
 * Usa MapboxOverlay (compatible con MapLibre) vía el hook useControl.
 */
export function DeckGLOverlay(props: MapboxOverlayProps) {
  const overlay = useControl(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}
