#!/usr/bin/env python3
"""Límites_ALKIS (alkis_bezirke:bezirksgrenzen) → lago/territorio.json.

Descarga los 12 distritos dos veces: con srsName=EPSG:4326 (geometría que se
simplifica y se publica en el lago) y en el CRS por defecto EPSG:25833 (área
planar en m², convertida a km²). Ambas respuestas se guardan en lago/raw/.
El punto de distrito se calcula sobre el polígono oficial WGS84 y se comprueba
que cae dentro tanto del oficial como del simplificado. Solo biblioteca
estándar; la E/S queda en main().
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import geometria  # noqa: E402
from comun import (  # noqa: E402
    IngestaError, cifra, escribir_tema, ficha, fuente_de, guardar_raw, hoy,
    http_get, main_seguro, wfs_url,
)

ID_FUENTE = "alkis-bezirke"
BASE = "https://gdi.berlin.de/services/wfs/alkis_bezirke"
TYPE_NAME = "alkis_bezirke:bezirksgrenzen"
CODIGOS = tuple(f"{i:02d}" for i in range(1, 13))

TOLERANCIA_INICIAL = 0.00005  # grados
TOLERANCIA_MAXIMA = 0.01      # grados
LIMITE_BYTES = 200_000
DECIMALES = 5

# Caja amplia de Berlín en lon/lat: detecta un eje invertido en EPSG:4326.
_LON, _LAT = (12.9, 13.9), (52.2, 52.8)


# --------------------------------------------------------------------------- Funciones puras


def codigo_de(props: dict) -> str:
    """`gem` "001"–"012" → Código_de_Distrito "01"–"12"; otro valor → IngestaError."""
    gem = props.get("gem") if isinstance(props, dict) else None
    if isinstance(gem, str) and len(gem) == 3 and gem.isdigit() and 1 <= int(gem) <= 12:
        return f"{int(gem):02d}"
    raise IngestaError(f"contenido no esperado: gem fuera de 001–012: {gem!r}")


def _multipoligono(geom, codigo: str) -> list:
    """Coordenadas como MultiPolygon (un Polygon se envuelve en una lista)."""
    if not isinstance(geom, dict) or not isinstance(geom.get("coordinates"), list):
        raise IngestaError(f"contenido no esperado: distrito {codigo} sin geometría")
    tipo, coords = geom.get("type"), geom["coordinates"]
    if tipo == "Polygon":
        coords = [coords]
    elif tipo != "MultiPolygon":
        raise IngestaError(f"contenido no esperado: distrito {codigo} con geometría {tipo!r}")
    if not coords or any(not p or any(len(a) < 4 for a in p) for p in coords):
        raise IngestaError(f"contenido no esperado: distrito {codigo} con anillos vacíos o degenerados")
    return coords


def _por_codigo(features, crs: str) -> dict[str, dict]:
    """{codigo: {"nombre", "coords"}} con exactamente los 12 códigos, sin repetidos."""
    if not isinstance(features, list):
        raise IngestaError(f"contenido no esperado ({crs}): falta 'features'")
    resultado: dict[str, dict] = {}
    for f in features:
        props = f.get("properties") if isinstance(f, dict) else None
        if not isinstance(props, dict):
            raise IngestaError(f"contenido no esperado ({crs}): feature sin 'properties'")
        codigo = codigo_de(props)
        if codigo in resultado:
            raise IngestaError(f"contenido no esperado ({crs}): distrito {codigo} repetido")
        nombre = props.get("namgem")
        if not isinstance(nombre, str) or not nombre.strip():
            raise IngestaError(f"contenido no esperado ({crs}): distrito {codigo} sin namgem")
        resultado[codigo] = {"nombre": nombre, "coords": _multipoligono(f.get("geometry"), codigo)}
    if sorted(resultado) != list(CODIGOS):
        raise IngestaError(
            f"contenido no esperado ({crs}): se esperaban los distritos 01–12, "
            f"llegaron {sorted(resultado)}")
    return resultado


def _comprobar_wgs84(coords, codigo: str) -> None:
    for parte in coords:
        for anillo in parte:
            for pt in anillo:
                if not (_LON[0] <= pt[0] <= _LON[1] and _LAT[0] <= pt[1] <= _LAT[1]):
                    raise IngestaError(
                        f"contenido no esperado: coordenada {pt[:2]!r} del distrito {codigo} "
                        "fuera de Berlín en EPSG:4326 (¿ejes invertidos?)")


def _sin_repetidos(anillo: list) -> list:
    """Quita vértices consecutivos iguales (tras redondear); conserva ≥ 4 posiciones."""
    limpio = [anillo[0]]
    for pt in anillo[1:]:
        if pt != limpio[-1]:
            limpio.append(pt)
    return limpio if len(limpio) >= 4 else anillo


def _simplificar_feature(feature: dict, tolerancia: float) -> dict:
    coords = feature["geometry"]["coordinates"]
    nuevas = []
    for parte in coords:
        anillos = []
        for anillo in parte:
            simple = geometria.simplificar_anillo(anillo, tolerancia)
            anillos.append(_sin_repetidos(geometria.redondear_coords(simple, DECIMALES)))
        nuevas.append(anillos)
    return {
        "type": "Feature",
        "properties": dict(feature["properties"]),
        "geometry": {"type": "MultiPolygon", "coordinates": nuevas},
    }


def tamano_geometria(features: list) -> int:
    """Bytes UTF-8 de la FeatureCollection serializada sin espacios."""
    fc = {"type": "FeatureCollection", "features": features}
    texto = json.dumps(fc, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return len(texto.encode("utf-8"))


def simplificar_hasta(features, limite_bytes: int = LIMITE_BYTES) -> tuple[list, float]:
    """Tolerancia inicial 0.00005°, se duplica hasta que la geometría serializada
    (separators=(",", ":")) mida ≤ limite_bytes. Determinista. Coordenadas
    redondeadas a 5 decimales. Si ni con 0.01° cabe → IngestaError."""
    tolerancia = TOLERANCIA_INICIAL
    while tolerancia <= TOLERANCIA_MAXIMA:
        simples = [_simplificar_feature(f, tolerancia) for f in features]
        if tamano_geometria(simples) <= limite_bytes:
            return simples, tolerancia
        tolerancia *= 2
    raise IngestaError(
        f"la geometría no cabe en {limite_bytes} bytes ni con tolerancia {TOLERANCIA_MAXIMA}°")


def _punto(coords_oficiales: list, coords_simples: list, codigo: str) -> list[float]:
    """Punto interior del polígono oficial, redondeado y comprobado en ambas geometrías."""
    x, y = geometria.punto_interior(coords_oficiales)
    punto = [round(x, DECIMALES), round(y, DECIMALES)]
    for nombre, mp in (("oficial", coords_oficiales), ("simplificado", coords_simples)):
        if not any(geometria.punto_en_poligono(punto, p) for p in mp):
            raise IngestaError(f"el punto {punto} del distrito {codigo} cae fuera del polígono {nombre}")
    return punto


def construir_territorio(f4326: list, f25833: list, probado: str, vigencia: str,
                         fuente: dict | None = None) -> dict:
    """Tema `territorio` a partir de las features de ambas descargas.

    `fuente` es la entrada de `fuentes` (por defecto, la ficha del catálogo)."""
    wgs = _por_codigo(f4326, "EPSG:4326")
    utm = _por_codigo(f25833, "EPSG:25833")
    for codigo in CODIGOS:
        if wgs[codigo]["nombre"] != utm[codigo]["nombre"]:
            raise IngestaError(
                f"contenido no esperado: distrito {codigo} se llama {wgs[codigo]['nombre']!r} "
                f"en EPSG:4326 y {utm[codigo]['nombre']!r} en EPSG:25833")
        _comprobar_wgs84(wgs[codigo]["coords"], codigo)

    oficiales = [
        {
            "type": "Feature",
            "properties": {"codigo": c, "nombre": wgs[c]["nombre"]},
            "geometry": {"type": "MultiPolygon", "coordinates": wgs[c]["coords"]},
        }
        for c in CODIGOS
    ]
    simples, tolerancia = simplificar_hasta(oficiales)

    def c_(valor, unidad):
        return cifra(valor, unidad, vigencia, ID_FUENTE)

    por_distrito: dict[str, dict] = {}
    total_km2 = 0.0
    for c, simple in zip(CODIGOS, simples):
        area_km2 = geometria.area_multipoligono(utm[c]["coords"]) / 1_000_000
        if area_km2 <= 0:
            raise IngestaError(f"contenido no esperado: distrito {c} con área {area_km2} km²")
        total_km2 += area_km2
        punto = _punto(wgs[c]["coords"], simple["geometry"]["coordinates"], c)
        por_distrito[c] = {
            "nombre": wgs[c]["nombre"],
            "area_km2": c_(area_km2, "km²"),
            "punto": c_(punto, "° WGS84"),
        }

    return {
        "tema": "territorio",
        "probado": probado,
        "fuentes": [fuente if fuente is not None else fuente_de(ID_FUENTE)],
        "cifras": {
            "superficie_total": c_(total_km2, "km²"),
            "tolerancia_simplificacion": c_(tolerancia, "°"),
        },
        "por_distrito": por_distrito,
        "geometria": {"type": "FeatureCollection", "features": simples},
        "series": {},
    }


# --------------------------------------------------------------------------- E/S


def _descargar(srs: str | None, nombre_raw: str) -> list:
    url = wfs_url(BASE, TYPE_NAME, srs_name=srs)
    cuerpo = http_get(url)
    guardar_raw(nombre_raw, cuerpo)
    try:
        datos = json.loads(cuerpo.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as err:
        raise IngestaError(f"contenido no esperado de {url}: no es JSON ({err})") from None
    if not isinstance(datos, dict) or not isinstance(datos.get("features"), list):
        raise IngestaError(f"contenido no esperado de {url}: falta 'features'")
    return datos["features"]


def main() -> None:
    vigencia = ficha(ID_FUENTE)["vigencia"]
    fuente = fuente_de(ID_FUENTE)
    f4326 = _descargar("EPSG:4326", "alkis_bezirke_bezirksgrenzen_4326.json")
    f25833 = _descargar(None, "alkis_bezirke_bezirksgrenzen_25833.json")
    probado = hoy()
    tema = construir_territorio(f4326, f25833, probado, vigencia, fuente)
    destino = escribir_tema("territorio", tema)
    cifras = tema["cifras"]
    print(f"territorio: {len(tema['por_distrito'])} distritos, "
          f"Σ área {cifras['superficie_total']['valor']} km², "
          f"tolerancia {cifras['tolerancia_simplificacion']['valor']}°, "
          f"geometría {tamano_geometria(tema['geometria']['features'])} B → {destino}")


if __name__ == "__main__":
    main_seguro(main)
