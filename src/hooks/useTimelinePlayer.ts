"use client";

import { useEffect } from "react";
import { useCityStore } from "@/store/useCityStore";

/**
 * Avanza automáticamente la hora seleccionada del timeline cuando isPlaying
 * está activo, ciclando 0 → 23 → 0.
 */
export function useTimelinePlayer(intervalMs = 900) {
  const isPlaying = useCityStore((s) => s.isPlaying);
  const setSelectedHour = useCityStore((s) => s.setSelectedHour);

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      setSelectedHour((useCityStore.getState().selectedHour + 1) % 24);
    }, intervalMs);
    return () => clearInterval(id);
  }, [isPlaying, intervalMs, setSelectedHour]);
}
