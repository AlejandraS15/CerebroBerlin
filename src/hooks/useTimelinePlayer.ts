"use client";

import { useEffect } from "react";
import { useCityStore } from "@/store/useCityStore";

/**
 * Avanza automáticamente la hora seleccionada del timeline cuando isPlaying
 * está activo, ciclando 0 → 23 → 0.
 *
 * Además, al montar (solo en cliente) ajusta la hora inicial a la hora real
 * del navegador. Esto se hace en un efecto —no en el estado inicial— para que
 * el render del servidor y el del cliente coincidan y no haya error de
 * hidratación.
 */
export function useTimelinePlayer(intervalMs = 900) {
  const isPlaying = useCityStore((s) => s.isPlaying);
  const setSelectedHour = useCityStore((s) => s.setSelectedHour);

  // Sincroniza con la hora local del navegador una sola vez tras el montaje.
  useEffect(() => {
    setSelectedHour(new Date().getHours());
  }, [setSelectedHour]);

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      setSelectedHour((useCityStore.getState().selectedHour + 1) % 24);
    }, intervalMs);
    return () => clearInterval(id);
  }, [isPlaying, intervalMs, setSelectedHour]);
}
