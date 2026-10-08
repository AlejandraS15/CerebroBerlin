#!/usr/bin/env python3
"""Fuente_Uso_Suelo (Flächennutzung 2020, Umweltatlas) → lago/verde.json.

Descarga los bloques de `ua_flaechennutzung_2020:c_ua_realnutz_2020` por
páginas sin geometría (propertyName=bez,flalle,nutz,nutzung), comprueba el
total contra numberMatched y calcula por Código_de_Distrito el % verde:

    Σ flalle (nutz ∈ NUTZ_VERDE) ÷ Σ flalle (todos los bloques) × 100

El denominador es la superficie de bloques (sin calles). `flalle` está en m²
según DescribeFeatureType ("Flächengröße [m²]", xsd:double); se convierte a
km² dividiendo por 10⁶. Todo código `nutz` observado tiene que figurar en
CLASIFICACION; un código no listado termina el script con error (6.5).
Solo biblioteca estándar.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import comun  # noqa: E402
from comun import IngestaError, cifra, escribir_tema, ficha, fuente_de, hoy, main_seguro, wfs_todas  # noqa: E402

ID_FUENTE = "ua-flaechennutzung-2020"
BASE = "https://gdi.berlin.de/services/wfs/ua_flaechennutzung_2020"
TYPE_NAME = "ua_flaechennutzung_2020:c_ua_realnutz_2020"
PROPIEDADES = ["bez", "flalle", "nutz", "nutzung"]
COUNT = 5000
CODIGOS = tuple(f"{i:02d}" for i in range(1, 13))
M2_POR_KM2 = 1_000_000

# Códigos de vegetación fijados por el requisito 6.3: 100 Wald,
# 130 Park/Grünfläche, 150 Friedhof, 160 Kleingarten, 172 y 173 Brache con
# vegetación.
NUTZ_VERDE = frozenset({100, 130, 150, 160, 172, 173})

# Tabla explícita de TODOS los códigos `nutz` observados en la respuesta real
# (descarga completa de 26.378 bloques: 22 códigos, ningún campo nulo).
# Comentario = `nutzung` del servicio.
CLASIFICACION: dict[int, bool] = {
    10: False,   # Wohnnutzung
    21: False,   # Mischnutzung
    30: False,   # Kerngebietsnutzung
    40: False,   # Gewerbe- und Industrienutzung, großflächiger Einzelhandel
    50: False,   # Gemeinbedarfs- und Sondernutzung
    60: False,   # Ver- und Entsorgung
    70: False,   # Wochenendhaus- und kleingartenähnliche Nutzung
    80: False,   # Verkehrsfläche (ohne Straßen)
    90: False,   # Baustelle
    100: True,   # Wald
    110: False,  # Gewässer
    121: False,  # Grünland (agrícola; fuera del conjunto fijado por 6.3)
    122: False,  # Ackerland (agrícola; fuera del conjunto fijado por 6.3)
    130: True,   # Park / Grünfläche
    140: False,  # Stadtplatz / Promenade
    150: True,   # Friedhof
    160: True,   # Kleingartenanlage
    171: False,  # Brachfläche, vegetationsfrei
    172: True,   # Brachfläche, wiesenartiger Vegetationsbestand
    173: True,   # Brachfläche, Mischbestand aus Wiesen, Gebüschen und Bäumen
    190: False,  # Sportnutzung
    200: False,  # Baumschule / Gartenbau
}

# La tabla y el conjunto del requisito deben coincidir siempre.
assert {k for k, v in CLASIFICACION.items() if v} == NUTZ_VERDE


def normalizar_bez(bez) -> str:
    """1 | "1" | "01" | "001" → "01"; fuera de 1–12 → IngestaError."""
    if isinstance(bez, bool):
        raise IngestaError(f"contenido no esperado: bez={bez!r} no es un código de distrito")
    if isinstance(bez, int):
        n = bez
    elif isinstance(bez, str) and bez.strip().isdigit():
        n = int(bez.strip())
    else:
        raise IngestaError(f"contenido no esperado: bez={bez!r} no es un código de distrito")
    if not 1 <= n <= 12:
        raise IngestaError(f"contenido no esperado: bez={bez!r} fuera de 01–12")
    return f"{n:02d}"


def _codigo_nutz(nutz):
    """Entero del código nutz (admite "130"); None/otros se devuelven tal cual."""
    if isinstance(nutz, bool):
        return nutz
    if isinstance(nutz, str) and nutz.strip().isdigit():
        return int(nutz.strip())
    return nutz


def clasificar(nutz, nutzung=None) -> bool:
    """True si el código es de vegetación. Código no listado en CLASIFICACION
    → IngestaError("nutz no clasificado: <código> (<nutzung>)")."""
    codigo = _codigo_nutz(nutz)
    if isinstance(codigo, bool) or not isinstance(codigo, int) or codigo not in CLASIFICACION:
        raise IngestaError(f"nutz no clasificado: {nutz} ({nutzung})")
    return CLASIFICACION[codigo]


def _flalle(valor, bloque: dict) -> float:
    if (isinstance(valor, bool) or not isinstance(valor, (int, float))
            or not math.isfinite(valor) or valor < 0):
        raise IngestaError(f"contenido no esperado: flalle={valor!r} en el bloque {bloque!r}")
    return float(valor)


def pct_verde(bloques: list[dict]) -> dict[str, dict]:
    """Por código de distrito: superficie_verde y superficie_bloques (m², sin
    redondear) y pct = verde ÷ bloques × 100."""
    agg: dict[str, dict] = {}
    for b in bloques:
        codigo = normalizar_bez(b.get("bez"))
        es_verde = clasificar(b.get("nutz"), b.get("nutzung"))
        area = _flalle(b.get("flalle"), b)
        d = agg.setdefault(codigo, {"superficie_verde": 0.0, "superficie_bloques": 0.0})
        d["superficie_bloques"] += area
        if es_verde:
            d["superficie_verde"] += area
    for codigo, d in agg.items():
        if d["superficie_bloques"] <= 0:
            raise IngestaError(f"contenido no esperado: distrito {codigo} sin superficie de bloques")
        d["pct"] = d["superficie_verde"] / d["superficie_bloques"] * 100
    return agg


def tabla_clasificacion(bloques: list[dict]) -> dict[str, dict]:
    """{ "<nutz>": {"nutzung", "verde"} } de los códigos observados. Un código
    con dos textos `nutzung` distintos es contenido no esperado."""
    textos: dict[int, str] = {}
    for b in bloques:
        clasificar(b.get("nutz"), b.get("nutzung"))
        codigo = _codigo_nutz(b.get("nutz"))
        texto = b.get("nutzung")
        if not isinstance(texto, str) or not texto.strip():
            raise IngestaError(f"contenido no esperado: nutzung={texto!r} para nutz {codigo}")
        previo = textos.setdefault(codigo, texto)
        if previo != texto:
            raise IngestaError(
                f"contenido no esperado: nutz {codigo} con dos nutzung: {previo!r} y {texto!r}")
    return {str(k): {"nutzung": textos[k], "verde": CLASIFICACION[k]} for k in sorted(textos)}


def construir_tema(bloques: list[dict], probado: str) -> dict:
    vigencia = ficha(ID_FUENTE)["vigencia"]
    agg = pct_verde(bloques)
    faltan = [c for c in CODIGOS if c not in agg]
    if faltan:
        raise IngestaError(f"contenido no esperado: distritos sin bloques: {', '.join(faltan)}")

    def c(valor, unidad):
        return cifra(valor, unidad, vigencia, ID_FUENTE)

    por_distrito = {
        codigo: {
            "pct_verde": c(agg[codigo]["pct"], "%"),
            "superficie_verde_km2": c(agg[codigo]["superficie_verde"] / M2_POR_KM2, "km²"),
            "superficie_bloques_km2": c(agg[codigo]["superficie_bloques"] / M2_POR_KM2, "km²"),
        }
        for codigo in CODIGOS
    }
    total_m2 = sum(agg[k]["superficie_bloques"] for k in CODIGOS)
    return {
        "tema": "verde",
        "probado": probado,
        "fuentes": [fuente_de(ID_FUENTE)],
        "cifras": {
            "superficie_bloques_total": c(total_m2 / M2_POR_KM2, "km²"),
        },
        "por_distrito": por_distrito,
        "clasificacion": tabla_clasificacion(bloques),
        "series": {},
    }


def main() -> None:
    bloques = wfs_todas(BASE, TYPE_NAME, PROPIEDADES, count=COUNT)
    tema = construir_tema(bloques, hoy())
    destino = escribir_tema("verde", tema)
    total = tema["cifras"]["superficie_bloques_total"]["valor"]
    print(f"{destino.relative_to(comun.RAIZ)}: {len(bloques)} bloques, {total} km² de bloques")
    for codigo, d in tema["por_distrito"].items():
        print(f"  {codigo}: {d['pct_verde']['valor']} % verde "
              f"({d['superficie_verde_km2']['valor']} / {d['superficie_bloques_km2']['valor']} km²)")


if __name__ == "__main__":
    main_seguro(main)
