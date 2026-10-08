/**
 * Lago en la Aplicación: los cuatro Temas del lago (`lago/*.json`) importados
 * en tiempo de compilación y tipados según el Contrato_del_Lago.
 *
 * Los JSON los escriben los Scripts_de_Ingesta (`ingesta/*.py`) y los valida
 * el Verificador; aquí solo se tipan y se exponen. Todo lo que sale de este
 * módulo tiene Origen_de_Dato `snapshot`.
 */

import territorioJson from "@lago/territorio.json";
import poblacionJson from "@lago/poblacion.json";
import verdeJson from "@lago/verde.json";
import traficoJson from "@lago/trafico.json";

import type { DistrictCode, LakeTopic, SourceState, TrafficDetector } from "@/lib/types";

// ── Contrato_del_Lago ────────────────────────────────────────

/** Cifra del lago: valor normalizado con unidad, vigencia e id de fuente del Tema. */
export interface Cifra<T = number> {
  valor: T;
  unidad: string;
  vigencia: string;
  /** Id de una entrada de `fuentes` del mismo Tema (y de una ficha del catálogo). */
  fuente: string;
}

/** Entrada de `fuentes` de un Tema (coincide con la Ficha_de_Fuente del catálogo). */
export interface FuenteTema {
  id: string;
  nombre: string;
  url: string;
  estado: SourceState;
  licencia: string;
}

/** Estructura común a todos los Temas. */
export interface TemaBase<
  N extends LakeTopic,
  C extends Record<string, Cifra<unknown>>,
  S extends Record<string, Cifra<unknown>> = Record<string, never>,
> {
  tema: N;
  /** Fecha_Probado (YYYY-MM-DD): día en que la fuente respondió. */
  probado: string;
  fuentes: FuenteTema[];
  cifras: C;
  series: S;
}

// territorio ─────────────────────────────────────────────────

export interface TerritorioDistrito {
  nombre: string;
  /** Superficie ALKIS (EPSG:25833), km². */
  area_km2: Cifra;
  /** Punto_de_Distrito [lng, lat], unidad "° WGS84". */
  punto: Cifra<[number, number]>;
}

export interface TerritorioFeature {
  type: "Feature";
  properties: { codigo: DistrictCode; nombre: string };
  geometry: { type: "MultiPolygon"; coordinates: number[][][][] };
}

export interface TerritorioTema
  extends TemaBase<
    "territorio",
    {
      superficie_total: Cifra;
      tolerancia_simplificacion: Cifra;
    }
  > {
  por_distrito: Record<DistrictCode, TerritorioDistrito>;
  /** Límites WGS84 simplificados, features ordenadas por `codigo`. */
  geometria: { type: "FeatureCollection"; features: TerritorioFeature[] };
}

// poblacion ──────────────────────────────────────────────────

export interface PoblacionDistrito {
  poblacion: Cifra;
  pct_menor_18: Cifra;
  pct_65_mas: Cifra;
  cobertura_edad: Cifra;
}

export interface PoblacionTema
  extends TemaBase<
    "poblacion",
    {
      poblacion_total: Cifra;
      bloques: Cifra;
      bloques_sin_edad: Cifra;
    }
  > {
  por_distrito: Record<DistrictCode, PoblacionDistrito>;
}

// verde ──────────────────────────────────────────────────────

export interface VerdeDistrito {
  pct_verde: Cifra;
  superficie_verde_km2: Cifra;
  superficie_bloques_km2: Cifra;
}

export interface VerdeTema
  extends TemaBase<
    "verde",
    {
      superficie_bloques_total: Cifra;
    }
  > {
  por_distrito: Record<DistrictCode, VerdeDistrito>;
  /** Clasificación por código `nutz` del Umweltatlas. */
  clasificacion: Record<string, { nutzung: string; verde: boolean }>;
}

// trafico ────────────────────────────────────────────────────

/** Detector tal como se guarda en el lago. */
export interface DetectorLago {
  id: string;
  /** [lng, lat] WGS84. */
  punto: [number, number];
  /** 24 medias horarias veh/h; `null` si la hora no alcanza `min_registros_por_hora`. */
  qkfz: (number | null)[];
}

export interface TraficoTema
  extends TemaBase<
    "trafico",
    {
      detectores_archivo: Cifra;
      detectores_con_ubicacion: Cifra;
      detectores_excluidos: Cifra;
      min_registros_por_hora: Cifra;
      detector_horas_descartadas: Cifra;
    },
    {
      /** 24 valores veh/h (perfil típico de ciudad). */
      perfil_ciudad: Cifra<number[]>;
      detectores: Cifra<DetectorLago[]>;
    }
  > {}

// ── Temas tipados ────────────────────────────────────────────

/*
 * La inferencia de TypeScript sobre JSON ensancha tuplas a `number[]` y
 * literales a `string`, por eso se usa una aserción hacia el contrato.
 * La forma real la garantiza el Verificador (`verificacion/verificar.py`).
 */
export const territorio = territorioJson as TerritorioTema;
export const poblacion = poblacionJson as PoblacionTema;
export const verde = verdeJson as VerdeTema;
export const trafico = traficoJson as TraficoTema;

export const themes = { territorio, poblacion, verde, trafico } as const;

/** Perfil horario de tráfico de la ciudad (24 valores, veh/h). */
export const trafficProfile: readonly number[] = trafico.series.perfil_ciudad.valor;

/** Detectores de tráfico con su perfil horario; `position` = `punto` del lago. */
export const trafficDetectors: TrafficDetector[] = trafico.series.detectores.valor.map((d) => ({
  id: d.id,
  position: [d.punto[0], d.punto[1]],
  qkfz: d.qkfz,
}));

/** Fecha_Probado de cada Tema. */
export const lakeProbado: Record<LakeTopic, string> = {
  territorio: territorio.probado,
  poblacion: poblacion.probado,
  verde: verde.probado,
  trafico: trafico.probado,
};
