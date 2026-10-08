import { CONFIG } from "@/lib/config";
import { safeFetchJson } from "@/lib/http";
import type { DistrictFeatureCollection, SourceBlock } from "@/lib/types";
import { BERLIN_DISTRICTS } from "@/data/districts";
import { lakeProbado } from "@/data/lake";

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
 * Límites y métricas de distrito desde el lago versionado (Origen_de_Dato
 * `snapshot`). Los JSON los producen los Scripts_de_Ingesta contra las fuentes
 * oficiales (ALKIS, Umweltatlas) y los valida el Verificador; aquí solo se
 * leen. Es síncrono y funciona sin red.
 */
export function fetchDistricts(): SourceBlock<DistrictFeatureCollection> {
  return {
    data: BERLIN_DISTRICTS,
    origin: "snapshot",
    // El territorio fija la Fecha_Probado de los límites del distrito.
    fetchedAt: lakeProbado.territorio,
  };
}
