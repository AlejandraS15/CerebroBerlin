"use client";

import { useMemo } from "react";
import type { CityDataset } from "@/lib/types";
import { buildAnalytics, type Analytics } from "@/lib/analytics";

export type { Analytics } from "@/lib/analytics";

/**
 * Envuelve la función pura `buildAnalytics` en un `useMemo`. Toda la lógica de
 * KPIs y series vive en `src/lib/analytics.ts` (testeable sin React).
 */
export function useAnalytics(
  data: CityDataset | undefined,
  hour: number,
): Analytics | null {
  return useMemo(() => buildAnalytics(data, hour), [data, hour]);
}
