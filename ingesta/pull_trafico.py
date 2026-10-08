#!/usr/bin/env python3
"""Fuente_Tráfico (Verkehrsdetektion Berlin) → lago/trafico.json.

Descarga las ubicaciones de los detectores (`teu_standorte.json`) y el archivo
mensual `detektor_2025_06.tgz` del contenedor `mdhopendata`. Cada CSV del
archivo (`2025_06/<teuID>.csv`, separador `;`) trae una fila por día y hora con
la intensidad `qkfz` (vehículos/hora). Por detector se calcula la media de
`qkfz` en cada hora 0–23 descartando `NaN` y vacíos (7.2, 7.3); el perfil de
ciudad es la media por hora de las medias de los detectores con dato en esa
hora (7.4). Las medias se unen con las ubicaciones por `teuID` (7.5); los
detectores sin ubicación se excluyen de la capa y se cuentan (7.6).

Umbral de registros (MIN_REGISTROS_POR_HORA = 3): la media de un detector en
una hora solo cuenta si ese detector tiene al menos 3 filas válidas (qkfz no
`NaN` ni vacío) para esa hora del día en el mes; con menos, esa hora del
detector es `None`: queda fuera del perfil de ciudad y aparece como null en la
capa (7.3, 7.4). Motivo: en 2025-06 hay detectores con una sola fila en todo
el mes (2025-06-25 10 h, qkfz=0, Datapoints_Rel=0,08) que hundían la media de
ciudad de las 10 h. El umbral y el número de horas-detector descartadas
(horas con 1 a 2 filas válidas) se registran en el lago como cifras
`min_registros_por_hora` y `detector_horas_descartadas`.

El listado del contenedor solo se usa para avisar por consola si hay un mes más
reciente que MES; no se escribe en el lago (determinismo, 3.6–3.7).
Solo biblioteca estándar.
"""

from __future__ import annotations

import csv
import io
import json
import math
import re
import sys
import tarfile
import xml.etree.ElementTree as ET
from pathlib import Path, PurePosixPath
from typing import Iterable

sys.path.insert(0, str(Path(__file__).resolve().parent))

import comun  # noqa: E402
from comun import (IngestaError, cifra, escribir_tema, ficha, fuente_de, guardar_raw,  # noqa: E402
                   http_get, hoy, main_seguro, redondear)

ID_FUENTE = "verkehrsdetektion"
MES = "2025-06"  # 7.1, 7.7
CONTENEDOR = "https://mdhopendata.blob.core.windows.net/verkehrsdetektion"
RUTA_ARCHIVOS = "neue_qualitaetssicherung/Fahrstreifendetektoren"
URL_STANDORTE = "https://api.viz.berlin.de/daten/verkehrsdetektion/teu_standorte.json"

COL_HORA = "Stunde des Tages (Ortszeit)"
COL_QKFZ = "qkfz"
HORAS = 24
# Filas válidas mínimas de un detector en una hora del día para que su media cuente.
MIN_REGISTROS_POR_HORA = 3
UNIDAD = "veh/h"
_NULOS = {"", "nan"}
_RE_ARCHIVO = re.compile(r"/detektor_(\d{4})_(\d{2})\.tgz$")


# --------------------------------------------------------------------------- URLs y listado


def _partes_mes(mes: str) -> tuple[str, str]:
    m = re.fullmatch(r"(\d{4})-(\d{2})", mes)
    if not m or not 1 <= int(m.group(2)) <= 12:
        raise ValueError(f"mes no válido (YYYY-MM): {mes!r}")
    return m.group(1), m.group(2)


def url_archivo(mes: str) -> str:
    """…/2025/neue_qualitaetssicherung/Fahrstreifendetektoren/detektor_2025_06.tgz"""
    anio, mm = _partes_mes(mes)
    return f"{CONTENEDOR}/{anio}/{RUTA_ARCHIVOS}/detektor_{anio}_{mm}.tgz"


def url_listado(anio: str) -> str:
    """Listado del contenedor (Azure Blob) limitado a un año."""
    return f"{CONTENEDOR}?restype=container&comp=list&prefix={anio}/"


def meses_disponibles(xml_listado: bytes) -> list[str]:
    """Meses "YYYY-MM" con archivo de Fahrstreifendetektoren en el listado,
    ordenados y sin repetir."""
    try:
        raiz = ET.fromstring(xml_listado)
    except ET.ParseError as err:
        raise IngestaError(f"contenido no esperado del listado del contenedor: {err}") from None
    meses = set()
    for nombre in raiz.iter("Name"):
        texto = (nombre.text or "").strip()
        if f"/{RUTA_ARCHIVOS}/" not in f"/{texto}":
            continue
        m = _RE_ARCHIVO.search(texto)
        if m:
            meses.add(f"{m.group(1)}-{m.group(2)}")
    return sorted(meses)


# --------------------------------------------------------------------------- CSV y medias


def _hora(texto, detector: str) -> int:
    try:
        h = int(str(texto).strip())
    except ValueError:
        raise IngestaError(f"contenido no esperado en {detector}: {COL_HORA}={texto!r}") from None
    if not 0 <= h < HORAS:
        raise IngestaError(f"contenido no esperado en {detector}: hora fuera de 0–23 ({h})")
    return h


def _qkfz(texto, detector: str) -> float | None:
    """Valor de qkfz o None si es NaN o vacío; cualquier otro texto no numérico
    o un valor negativo es contenido no esperado."""
    t = "" if texto is None else str(texto).strip()
    if t.lower() in _NULOS:
        return None
    try:
        v = float(t)
    except ValueError:
        raise IngestaError(f"contenido no esperado en {detector}: {COL_QKFZ}={texto!r}") from None
    if math.isnan(v):
        return None
    if not math.isfinite(v) or v < 0:
        raise IngestaError(f"contenido no esperado en {detector}: {COL_QKFZ}={texto!r}")
    return v


def _acumular(filas: Iterable[dict], detector: str) -> tuple[list[float], list[int]]:
    """(suma de qkfz válidos, nº de filas válidas) por hora del día."""
    sumas = [0.0] * HORAS
    n = [0] * HORAS
    for fila in filas:
        h = _hora(fila.get(COL_HORA), detector)
        v = _qkfz(fila.get(COL_QKFZ), detector)
        if v is None:
            continue
        sumas[h] += v
        n[h] += 1
    return sumas, n


def registros_por_hora(filas: Iterable[dict], detector: str = "?") -> list[int]:
    """24 enteros: nº de filas válidas (qkfz no NaN ni vacío) por hora del día."""
    return _acumular(filas, detector)[1]


def medias_por_hora(filas: Iterable[dict], detector: str = "?",
                    min_registros: int = MIN_REGISTROS_POR_HORA) -> list[float | None]:
    """24 valores: media de qkfz por hora del día. Las filas son dicts con las
    columnas COL_HORA y COL_QKFZ; NaN y vacíos se descartan. Una hora con menos
    de `min_registros` filas válidas (incluida 0) es None."""
    if isinstance(min_registros, bool) or not isinstance(min_registros, int) or min_registros < 1:
        raise ValueError(f"min_registros debe ser un entero ≥ 1: {min_registros!r}")
    sumas, n = _acumular(filas, detector)
    return [sumas[h] / n[h] if n[h] >= min_registros else None for h in range(HORAS)]


def horas_descartadas(registros: dict[str, list[int]],
                      min_registros: int = MIN_REGISTROS_POR_HORA) -> int:
    """Nº de horas-detector con dato válido (≥ 1 fila) pero por debajo del umbral."""
    return sum(1 for n in registros.values() for k in n if 0 < k < min_registros)


def _leer_csv(texto: str, detector: str) -> tuple[list[float | None], list[int]]:
    lector = csv.DictReader(io.StringIO(texto), delimiter=";")
    columnas = lector.fieldnames or []
    faltan = [c for c in (COL_HORA, COL_QKFZ) if c not in columnas]
    if faltan:
        raise IngestaError(f"contenido no esperado en {detector}: faltan columnas "
                           f"{faltan} (cabecera: {columnas})")
    filas = list(lector)
    return medias_por_hora(filas, detector), registros_por_hora(filas, detector)


def leer_archivo(tgz: bytes) -> tuple[dict[str, list[float | None]], dict[str, list[int]]]:
    """({detector: 24 medias}, {detector: 24 nº de filas válidas}) a partir del
    .tgz; el id es el nombre del CSV sin extensión. Los miembros que no son CSV
    (p. ej. la carpeta) se ignoran."""
    try:
        tar = tarfile.open(fileobj=io.BytesIO(tgz), mode="r:gz")
    except (tarfile.TarError, OSError, EOFError) as err:
        raise IngestaError(f"contenido no esperado: el archivo no es un .tgz válido ({err})") from None
    medias: dict[str, list[float | None]] = {}
    registros: dict[str, list[int]] = {}
    with tar:
        for miembro in tar:
            if not miembro.isfile() or not miembro.name.lower().endswith(".csv"):
                continue
            detector = PurePosixPath(miembro.name).stem
            if detector in medias:
                raise IngestaError(f"contenido no esperado: detector repetido en el archivo: {detector}")
            fh = tar.extractfile(miembro)
            if fh is None:
                raise IngestaError(f"contenido no esperado: no se puede leer {miembro.name}")
            try:
                texto = fh.read().decode("utf-8-sig")
            except UnicodeDecodeError as err:
                raise IngestaError(f"contenido no esperado en {miembro.name}: {err}") from None
            medias[detector], registros[detector] = _leer_csv(texto, detector)
    if not medias:
        raise IngestaError("contenido no esperado: el archivo no contiene CSV de detectores")
    return medias, registros


def perfil_ciudad(medias: dict[str, list]) -> list[float]:
    """Media por hora de las medias de los detectores con dato en esa hora.
    Una hora sin ningún dato es contenido no esperado (el perfil exige 24 números)."""
    perfil = []
    for h in range(HORAS):
        valores = [m[h] for m in medias.values() if m[h] is not None]
        if not valores:
            raise IngestaError(f"contenido no esperado: ningún detector tiene dato a las {h} h")
        perfil.append(sum(valores) / len(valores))
    return perfil


# --------------------------------------------------------------------------- Ubicaciones


def leer_standorte(datos) -> dict[str, tuple[float, float]]:
    """{teuID: (lng, lat)} desde la FeatureCollection de teu_standorte.json."""
    features = datos.get("features") if isinstance(datos, dict) else None
    if not isinstance(features, list) or not features:
        raise IngestaError("contenido no esperado en teu_standorte.json: falta 'features'")
    puntos: dict[str, tuple[float, float]] = {}
    for f in features:
        props = f.get("properties") if isinstance(f, dict) else None
        geom = f.get("geometry") if isinstance(f, dict) else None
        teu = props.get("teuID") if isinstance(props, dict) else None
        coords = geom.get("coordinates") if isinstance(geom, dict) else None
        if (not isinstance(teu, str) or not teu
                or not isinstance(geom, dict) or geom.get("type") != "Point"
                or not isinstance(coords, list) or len(coords) < 2
                or not all(isinstance(c, (int, float)) and not isinstance(c, bool)
                           and math.isfinite(c) for c in coords[:2])):
            raise IngestaError(f"contenido no esperado en teu_standorte.json: {json.dumps(f)[:300]}")
        if teu in puntos:
            raise IngestaError(f"contenido no esperado en teu_standorte.json: teuID repetido {teu}")
        puntos[teu] = (float(coords[0]), float(coords[1]))
    return puntos


def unir_ubicaciones(medias: dict[str, list],
                     standorte: dict[str, tuple[float, float]]) -> tuple[list[dict], int]:
    """(detectores con punto ordenados por id, nº de detectores sin ubicación).
    Cada detector: {id, punto: [lng, lat], qkfz: 24 × número | None}, sin redondear."""
    detectores = [
        {"id": d, "punto": [standorte[d][0], standorte[d][1]], "qkfz": list(medias[d])}
        for d in sorted(medias) if d in standorte
    ]
    return detectores, len(medias) - len(detectores)


# --------------------------------------------------------------------------- Tema


def construir_tema(medias: dict[str, list], registros: dict[str, list[int]],
                   standorte: dict[str, tuple[float, float]], probado: str) -> dict:
    vigencia = ficha(ID_FUENTE)["vigencia"]
    if vigencia != MES:
        raise IngestaError(f"la vigencia del catálogo ({vigencia!r}) no coincide con MES ({MES!r})")
    if set(registros) != set(medias):
        raise ValueError("medias y registros deben tener los mismos detectores")
    perfil = perfil_ciudad(medias)
    detectores, excluidos = unir_ubicaciones(medias, standorte)
    if not detectores:
        raise IngestaError("contenido no esperado: ningún detector del archivo tiene ubicación")

    def c(valor, unidad):
        return cifra(valor, unidad, vigencia, ID_FUENTE)

    capa = [
        {"id": d["id"],
         "punto": redondear(d["punto"], "°"),
         "qkfz": [None if v is None else redondear(v, UNIDAD) for v in d["qkfz"]]}
        for d in detectores
    ]
    return {
        "tema": "trafico",
        "probado": probado,
        "fuentes": [fuente_de(ID_FUENTE)],
        "cifras": {
            "detectores_archivo": c(len(medias), "detectores"),
            "detectores_con_ubicacion": c(len(detectores), "detectores"),
            "detectores_excluidos": c(excluidos, "detectores"),
            "min_registros_por_hora": c(MIN_REGISTROS_POR_HORA, "registros"),
            "detector_horas_descartadas": c(horas_descartadas(registros), "detector-horas"),
        },
        "series": {
            "perfil_ciudad": c(perfil, UNIDAD),
            # cifra() no redondea listas de objetos: el valor ya va redondeado.
            "detectores": {"valor": capa, "unidad": UNIDAD, "vigencia": vigencia,
                           "fuente": ID_FUENTE},
        },
    }


def _avisar_mes_reciente() -> None:
    anio = int(_partes_mes(MES)[0])
    meses: list[str] = []
    for a in (anio, anio + 1):
        cuerpo = http_get(url_listado(str(a)))
        guardar_raw(f"verkehrsdetektion_listado_{a}.xml", cuerpo)
        meses += meses_disponibles(cuerpo)
    recientes = [m for m in meses if m > MES]
    if recientes:
        print(f"aviso: hay meses más recientes que {MES} en el contenedor: "
              f"{', '.join(recientes)} (no se integran; MES es fijo)")


def main() -> None:
    _avisar_mes_reciente()

    cuerpo_standorte = http_get(URL_STANDORTE)
    guardar_raw("teu_standorte.json", cuerpo_standorte)
    try:
        standorte = leer_standorte(json.loads(cuerpo_standorte.decode("utf-8")))
    except (UnicodeDecodeError, json.JSONDecodeError) as err:
        raise IngestaError(f"contenido no esperado en teu_standorte.json: no es JSON ({err})") from None

    url = url_archivo(MES)
    tgz = http_get(url, timeout=180)
    guardar_raw(PurePosixPath(url).name, tgz)
    medias, registros = leer_archivo(tgz)

    tema = construir_tema(medias, registros, standorte, hoy())
    destino = escribir_tema("trafico", tema)
    cif = tema["cifras"]
    sin_dato = sum(1 for d in tema["series"]["detectores"]["valor"]
                   if all(v is None for v in d["qkfz"]))
    print(f"{destino.relative_to(comun.RAIZ)}: {cif['detectores_archivo']['valor']} detectores en el "
          f"archivo, {cif['detectores_con_ubicacion']['valor']} con ubicación "
          f"({sin_dato} sin ningún dato), {cif['detectores_excluidos']['valor']} excluidos; "
          f"ubicaciones sin CSV: {len(set(standorte) - set(medias))}")
    print(f"umbral: ≥ {MIN_REGISTROS_POR_HORA} filas válidas por detector y hora; "
          f"{cif['detector_horas_descartadas']['valor']} horas-detector descartadas")
    print("perfil_ciudad (veh/h): " + ", ".join(
        f"{h}h={v}" for h, v in enumerate(tema["series"]["perfil_ciudad"]["valor"])))


if __name__ == "__main__":
    main_seguro(main)
