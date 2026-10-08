#!/usr/bin/env python3
"""Fuente_Población (Einwohnerdichte 2024, Umweltatlas) → lago/poblacion.json.

Descarga los bloques de `ua_einwohnerdichte_2024` por páginas sin geometría
(propertyName, count, startIndex), comprueba el total contra numberMatched y
agrega por Código_de_Distrito (los dos primeros caracteres de `schluessel`
son el distrito anterior a 2001, 01–23, y se traducen con ANTIGUO_A_ACTUAL):
población, % menor de 18, % de 65 y más y cobertura de edad.

Un bloque con cualquier grupo de edad nulo cuenta en la población pero queda
fuera de los porcentajes de edad (5.6). Solo biblioteca estándar.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import comun  # noqa: E402
from comun import IngestaError, cifra, escribir_tema, ficha, fuente_de, hoy, main_seguro, wfs_todas  # noqa: E402

ID_FUENTE = "ua-einwohnerdichte-2024"
BASE = "https://gdi.berlin.de/services/wfs/ua_einwohnerdichte_2024"
TYPE_NAME = "ua_einwohnerdichte_2024:ua_einwohnerdichte_2024"
COUNT = 3000  # ~4,5 s por página sin geometría

GRUPOS_MENOR_18 = ("alter_u6", "alter_6_u10", "alter_10_u18")
GRUPOS_65_MAS = ("alter_65_u70", "alter_70_u75", "alter75_u80", "alter_80plus")
GRUPOS = (*GRUPOS_MENOR_18, "alter_18_u65", *GRUPOS_65_MAS)
PROPIEDADES = ["schluessel", "ew2024", *GRUPOS]
CODIGOS = tuple(f"{i:02d}" for i in range(1, 13))

# `schluessel` es la clave de bloque del RBS: sus dos primeros caracteres son el
# número de uno de los 23 distritos anteriores a la reforma de 2001 (no el
# Código_de_Distrito actual). La reforma (Gebietsreform, 01.01.2001) fusionó
# distritos completos, así que cada distrito antiguo cae entero en uno actual.
ANTIGUO_A_ACTUAL = {
    "01": "01", "02": "01", "03": "01",  # Mitte, Tiergarten, Wedding → Mitte
    "05": "02", "06": "02",              # Friedrichshain, Kreuzberg → Friedrichshain-Kreuzberg
    "04": "03", "18": "03", "19": "03",  # Prenzlauer Berg, Weißensee, Pankow → Pankow
    "07": "04", "09": "04",              # Charlottenburg, Wilmersdorf → Charlottenburg-Wilmersdorf
    "08": "05",                          # Spandau
    "10": "06", "12": "06",              # Zehlendorf, Steglitz → Steglitz-Zehlendorf
    "11": "07", "13": "07",              # Schöneberg, Tempelhof → Tempelhof-Schöneberg
    "14": "08",                          # Neukölln
    "15": "09", "16": "09",              # Treptow, Köpenick → Treptow-Köpenick
    "21": "10", "23": "10",              # Marzahn, Hellersdorf → Marzahn-Hellersdorf
    "17": "11", "22": "11",              # Lichtenberg, Hohenschönhausen → Lichtenberg
    "20": "12",                          # Reinickendorf
}


def codigo_distrito(schluessel) -> str:
    """Código_de_Distrito actual (01–12) a partir de schluessel[:2]."""
    if not isinstance(schluessel, str) or schluessel[:2] not in ANTIGUO_A_ACTUAL:
        raise IngestaError(f"contenido no esperado: schluessel={schluessel!r} "
                           "no empieza por un distrito antiguo 01–23")
    return ANTIGUO_A_ACTUAL[schluessel[:2]]


def _numero(valor, campo: str, bloque) -> float | None:
    """Número no negativo o None; cualquier otra cosa es contenido no esperado."""
    if valor is None:
        return None
    if isinstance(valor, bool) or not isinstance(valor, (int, float)) or valor < 0:
        raise IngestaError(f"contenido no esperado: {campo}={valor!r} en el bloque {bloque!r}")
    return valor


def agregar_poblacion(bloques: list[dict]) -> dict[str, dict]:
    """Por código (codigo_distrito(schluessel)): poblacion, pob_con_edad,
    menor_18, mas_65, bloques, bloques_sin_edad. Un bloque con cualquier grupo
    de edad nulo suma a poblacion pero no a pob_con_edad (ni a menor_18 / mas_65)."""
    agg: dict[str, dict] = {}
    for b in bloques:
        clave = b.get("schluessel")
        codigo = codigo_distrito(clave)
        ew = _numero(b.get("ew2024"), "ew2024", clave)
        if ew is None:
            raise IngestaError(f"contenido no esperado: ew2024 nulo en el bloque {clave!r}")
        d = agg.setdefault(codigo, {"poblacion": 0, "pob_con_edad": 0, "menor_18": 0,
                                       "mas_65": 0, "bloques": 0, "bloques_sin_edad": 0})
        d["poblacion"] += ew
        d["bloques"] += 1
        edades = {g: _numero(b.get(g), g, clave) for g in GRUPOS}
        if any(v is None for v in edades.values()):
            d["bloques_sin_edad"] += 1
            continue
        d["pob_con_edad"] += ew
        d["menor_18"] += sum(edades[g] for g in GRUPOS_MENOR_18)
        d["mas_65"] += sum(edades[g] for g in GRUPOS_65_MAS)
    return agg


def porcentajes(agg: dict) -> dict:
    """pct_menor_18, pct_65_mas (sobre la población con edad) y cobertura_edad
    (% de la población en bloques con edad), sin redondear."""
    if agg["poblacion"] <= 0 or agg["pob_con_edad"] <= 0:
        raise IngestaError(f"contenido no esperado: distrito sin población con edad ({agg!r})")
    base = agg["pob_con_edad"]
    return {
        "pct_menor_18": agg["menor_18"] / base * 100,
        "pct_65_mas": agg["mas_65"] / base * 100,
        "cobertura_edad": base / agg["poblacion"] * 100,
    }


def construir_tema(bloques: list[dict], probado: str) -> dict:
    vigencia = ficha(ID_FUENTE)["vigencia"]
    agg = agregar_poblacion(bloques)
    faltan = [c for c in CODIGOS if c not in agg]
    if faltan:
        raise IngestaError(f"contenido no esperado: distritos sin bloques: {', '.join(faltan)}")

    def c(valor, unidad):
        return cifra(valor, unidad, vigencia, ID_FUENTE)

    por_distrito = {}
    for codigo in CODIGOS:
        a = agg[codigo]
        p = porcentajes(a)
        por_distrito[codigo] = {
            "poblacion": c(a["poblacion"], "hab"),
            "pct_menor_18": c(p["pct_menor_18"], "%"),
            "pct_65_mas": c(p["pct_65_mas"], "%"),
            "cobertura_edad": c(p["cobertura_edad"], "%"),
        }
    # Σ distritos = total: se suman los valores ya redondeados (ew2024 es entero).
    total = sum(por_distrito[k]["poblacion"]["valor"] for k in CODIGOS)
    return {
        "tema": "poblacion",
        "probado": probado,
        "fuentes": [fuente_de(ID_FUENTE)],
        "cifras": {
            "poblacion_total": c(total, "hab"),
            "bloques": c(len(bloques), "bloques"),
            "bloques_sin_edad": c(sum(agg[k]["bloques_sin_edad"] for k in CODIGOS), "bloques"),
        },
        "por_distrito": por_distrito,
        "series": {},
    }


def main() -> None:
    bloques = wfs_todas(BASE, TYPE_NAME, PROPIEDADES, count=COUNT)
    tema = construir_tema(bloques, hoy())
    destino = escribir_tema("poblacion", tema)
    cif = tema["cifras"]
    print(f"{destino.relative_to(comun.RAIZ)}: {cif['poblacion_total']['valor']} hab, "
          f"{cif['bloques']['valor']} bloques ({cif['bloques_sin_edad']['valor']} sin edad)")


if __name__ == "__main__":
    main_seguro(main)
