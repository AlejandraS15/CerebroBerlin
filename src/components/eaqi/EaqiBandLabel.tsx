"use client";

import { aqiTone } from "@/lib/format";
import { EaqiInfoButton } from "./EaqiInfoButton";

/**
 * Único componente que renderiza `aqiTone(v).label` (la etiqueta de banda
 * EAQI). Muestra la etiqueta coloreada por su banda seguida de un
 * Control_de_Definición_EAQI (10.15): toda etiqueta de banda lleva su control.
 *
 * `null` o no finito → "sin datos" con tono neutro.
 */
export function EaqiBandLabel({ value }: { value: number | null }) {
  const tone = aqiTone(value);
  return (
    <span className="inline-flex items-center">
      <span className={tone.text}>{tone.label}</span>
      <EaqiInfoButton />
    </span>
  );
}
