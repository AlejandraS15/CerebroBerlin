import { CONFIG } from "@/lib/config";
import { safeFetchJson } from "@/lib/http";
import type { DistrictFeatureCollection } from "@/lib/types";
import { BERLIN_DISTRICTS } from "@/data/districts";

// Respuesta parcial de la API CKAN de datenregister.berlin.de.
interface CkanPackageSearch {
  success?: boolean;
  result?: {
    count?: number;
    results?: { id: string; title: string; notes?: string }[];
  };
}

/**
 * Busca datasets en el Portal de Datos Abiertos de Berlín (CKAN).
 * Útil para descubrir capas adicionales (catastro, uso de suelo, etc.).
 */
export async function searchOpenDatasets(query: string): Promise<
  { id: string; title: string; notes?: string }[]
> {
  const url = `${CONFIG.berlinOpenDataBase}/action/package_search?q=${encodeURIComponent(
    query,
  )}&rows=10`;
  const raw = await safeFetchJson<CkanPackageSearch>(url);
  return raw?.result?.results ?? [];
}

/**
 * Límites de distritos. En este proyecto usamos geometrías simplificadas
 * empaquetadas; en producción se cargarían los límites oficiales publicados
 * en daten.berlin.de (RBS/ALKIS). Se marca la fuente en consecuencia.
 */
export async function fetchDistricts(): Promise<{
  data: DistrictFeatureCollection;
  source: "live" | "mock";
}> {
  // Nota: los límites oficiales suelen servirse como WFS/GeoJSON externos.
  // Mantenemos la geometría empaquetada como fuente estable y offline-friendly.
  void CONFIG.berlinOpenDataBase;
  return { data: BERLIN_DISTRICTS, source: "mock" };
}
