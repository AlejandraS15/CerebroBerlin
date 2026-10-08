#!/usr/bin/env python3
"""Verificador del lago de CerebroBerlin: puerta de publicación.

Recorre todos los JSON de Tema de `lago/` y el catálogo `catalogo/fuentes.json`,
imprime un resultado PASS o FAIL por comprobación y termina con código distinto
de cero si alguna comprobación falla. Un solo FAIL impide publicar el lago.

Solo usa la biblioteca estándar de Python 3 (8.10).

Uso:
    python3 verificacion/verificar.py [--lago DIR] [--catalogo ARCHIVO]
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import unicodedata
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any, Iterator, TextIO

RAIZ = Path(__file__).resolve().parent.parent
LAGO_POR_DEFECTO = RAIZ / "lago"
CATALOGO_POR_DEFECTO = RAIZ / "catalogo" / "fuentes.json"

# --------------------------------------------------------------------------- reglas
CAMPOS_FICHA = (
    "id", "nombre", "entidad", "url", "cobertura", "vigencia", "probado",
    "estado", "licencia", "personas", "proteccion", "uso", "nota",
)
ESTADOS = ("integrado", "candidato", "caído", "declarado", "excluido")
PERSONAS = ("no", "conteos agregados por zona", "personas identificables", "texto libre")
PREFIJO_EN_VIVO = "en vivo:"

CLAVES_TEMA = ("tema", "probado", "fuentes", "cifras", "series")
CAMPOS_FUENTE = ("id", "nombre", "url", "estado", "licencia")
CAMPOS_CIFRA = ("valor", "unidad", "vigencia", "fuente")

# Claves con datos personales (comparación normalizada: minúsculas, sin acentos,
# guiones y espacios como "_"). `nombre` no se prohíbe: designa fuentes y distritos.
CLAVES_PERSONALES = frozenset({
    "vorname", "nachname", "apellido", "apellidos", "first_name", "last_name",
    "nombre_persona", "email", "e_mail", "correo", "telefono", "telefon", "phone",
    "direccion", "address", "adresse", "fecha_nacimiento", "geburtsdatum", "birthdate",
})
RE_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]{2,}")
RE_TELEFONO = re.compile(r"(?:\+|\b0)\d[\d /-]{6,}\d")
MIN_DIGITOS_TELEFONO = 9
CLAVES_SIN_ESCANEO = frozenset({"url"})

RE_FECHA = re.compile(r"^\d{4}-\d{2}-\d{2}$")

CODIGOS_DISTRITO = tuple(f"{n:02d}" for n in range(1, 13))
TEMAS_CON_DISTRITOS = ("territorio", "poblacion", "verde")
POBLACION_MIN, POBLACION_MAX = 3_400_000, 4_200_000
AREA_BERLIN_KM2 = 891.1
TOLERANCIA_AREA = 0.01  # ±1 %
LON_MIN, LON_MAX = 13.08, 13.77
LAT_MIN, LAT_MAX = 52.33, 52.68
CLAVES_COORDENADAS = ("coordinates", "punto")
HORAS_PERFIL = 24
LIMITE_GEOMETRIA_BYTES = 200_000

# Máximo de casos citados en el detalle de un FAIL.
_MAX_DETALLE = 5


@dataclass
class Resultado:
    nombre: str
    ok: bool
    detalle: str = ""


# --------------------------------------------------------------------------- utilidades
def _resultado(nombre: str, problemas: list[str]) -> Resultado:
    """PASS si no hay problemas; FAIL con los primeros casos si los hay."""
    if not problemas:
        return Resultado(nombre, True)
    detalle = "; ".join(problemas[:_MAX_DETALLE])
    if len(problemas) > _MAX_DETALLE:
        detalle += f"; … y {len(problemas) - _MAX_DETALLE} más"
    return Resultado(nombre, False, detalle)


def _es_numero(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _numeros(v: Any) -> Iterator[float]:
    """Todos los números (no booleanos) contenidos en v, a cualquier profundidad."""
    if _es_numero(v):
        yield v
    elif isinstance(v, list):
        for x in v:
            yield from _numeros(x)
    elif isinstance(v, dict):
        for x in v.values():
            yield from _numeros(x)


def _texto_no_vacio(v: Any) -> bool:
    return isinstance(v, str) and v.strip() != ""


def _fecha_valida(v: Any) -> bool:
    if not isinstance(v, str) or not RE_FECHA.match(v):
        return False
    try:
        date.fromisoformat(v)
    except ValueError:
        return False
    return True


def _normalizar_clave(clave: str) -> str:
    sin_acentos = "".join(
        c for c in unicodedata.normalize("NFKD", clave) if not unicodedata.combining(c)
    )
    return re.sub(r"[\s\-]+", "_", sin_acentos.strip().lower())


def _get(obj: Any, *ruta: str) -> Any:
    for clave in ruta:
        if not isinstance(obj, dict):
            return None
        obj = obj.get(clave)
    return obj


def _ids_fuentes(tema: dict) -> set[str]:
    fuentes = tema.get("fuentes")
    if not isinstance(fuentes, list):
        return set()
    return {f["id"] for f in fuentes if isinstance(f, dict) and isinstance(f.get("id"), str)}


# --------------------------------------------------------------------------- catálogo
def comprobar_catalogo(catalogo: Any, temas: dict[str, dict] | None = None) -> list[Resultado]:
    """Fichas completas, enumeraciones, fecha `probado`, ids únicos y regla
    `integrado` (1.2–1.4, 1.6, 1.10, 8.8)."""
    if not isinstance(catalogo, list) or not catalogo:
        return [Resultado("catalogo: estructura", False, "se esperaba un arreglo no vacío de fichas")]
    resultados = [Resultado("catalogo: estructura", True)]

    ids_en_lago: set[str] = set()
    for tema in (temas or {}).values():
        if isinstance(tema, dict):
            ids_en_lago |= _ids_fuentes(tema)

    vistos: dict[str, int] = {}
    for i, ficha in enumerate(catalogo):
        if not isinstance(ficha, dict):
            resultados.append(Resultado(f"catalogo[{i}]: ficha", False, "la ficha no es un objeto"))
            continue
        ident = ficha.get("id") if _texto_no_vacio(ficha.get("id")) else f"[{i}]"
        vistos[ident] = vistos.get(ident, 0) + 1

        faltan = [c for c in CAMPOS_FICHA if not _texto_no_vacio(ficha.get(c))]
        resultados.append(_resultado(f"catalogo {ident}: campos obligatorios",
                                     [f"falta o vacío: {c}" for c in faltan]))

        problemas = []
        if ficha.get("estado") not in ESTADOS:
            problemas.append(f"estado no permitido: {ficha.get('estado')!r}")
        if ficha.get("personas") not in PERSONAS:
            problemas.append(f"personas no permitido: {ficha.get('personas')!r}")
        if not _fecha_valida(ficha.get("probado")):
            problemas.append(f"probado no es YYYY-MM-DD: {ficha.get('probado')!r}")
        resultados.append(_resultado(f"catalogo {ident}: estado, personas y probado", problemas))

        if ficha.get("estado") == "integrado":
            en_lago = ident in ids_en_lago
            uso = ficha.get("uso")
            en_vivo = isinstance(uso, str) and uso.startswith(PREFIJO_EN_VIVO)
            problemas = [] if (en_lago or en_vivo) else [
                "integrado sin Tema del lago que la cite y sin uso 'en vivo: …'"
            ]
            resultados.append(_resultado(f"catalogo {ident}: regla integrado", problemas))

    duplicados = [f"id repetido: {k} (×{n})" for k, n in sorted(vistos.items()) if n > 1]
    resultados.append(_resultado("catalogo: ids únicos", duplicados))
    return resultados


# --------------------------------------------------------------------------- cifras
def recorrer_cifras(obj: Any, ruta: str = "") -> Iterator[tuple[str, dict]]:
    """Todo dict que contenga algún campo de Cifra (valor, unidad, vigencia,
    fuente), a cualquier profundidad. Una Cifra no se recorre por dentro."""
    if isinstance(obj, dict):
        if any(c in obj for c in CAMPOS_CIFRA):
            yield ruta, obj
            return
        for clave, v in obj.items():
            yield from recorrer_cifras(v, f"{ruta}.{clave}" if ruta else str(clave))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from recorrer_cifras(v, f"{ruta}[{i}]")


def _problemas_cifra(ruta: str, c: dict, ids_tema: set[str], ids_catalogo: set[str]) -> list[str]:
    problemas = []
    if c.get("valor") is None:
        problemas.append(f"{ruta}: sin valor")
    for campo in ("unidad", "vigencia", "fuente"):
        if not _texto_no_vacio(c.get(campo)):
            problemas.append(f"{ruta}: sin {campo}")
    valor = c.get("valor")
    # 2.4: valores ya normalizados (números JSON, sin texto ni booleanos).
    if isinstance(valor, (str, bool)) or (
        isinstance(valor, list) and any(isinstance(x, (str, bool)) for x in valor)
    ):
        problemas.append(f"{ruta}: valor no numérico ({valor!r:.40})")
    if any(not math.isfinite(x) for x in _numeros(valor)):
        problemas.append(f"{ruta}: valor no finito")
    fuente = c.get("fuente")
    if _texto_no_vacio(fuente):
        if fuente not in ids_tema:
            problemas.append(f"{ruta}: fuente {fuente!r} no está en fuentes del Tema")
        if fuente not in ids_catalogo:
            problemas.append(f"{ruta}: fuente {fuente!r} no está en el catálogo")
    return problemas


# --------------------------------------------------------------------------- tema
def comprobar_tema(nombre: str, tema: Any, catalogo_por_id: dict[str, dict]) -> list[Resultado]:
    """Contrato_del_Lago: claves, `probado`, `fuentes` y Cifras (2.1–2.4, 8.2–8.5)."""
    pre = f"{nombre}"
    if not isinstance(tema, dict):
        return [Resultado(f"{pre}: contrato del lago", False, "el Tema no es un objeto JSON")]
    resultados = []

    problemas = [f"falta clave {k}" for k in CLAVES_TEMA if k not in tema]
    if "tema" in tema and tema.get("tema") != nombre:
        problemas.append(f"tema {tema.get('tema')!r} no coincide con el archivo {nombre}.json")
    for k, tipo in (("fuentes", list), ("cifras", dict), ("series", dict)):
        if k in tema and not isinstance(tema[k], tipo):
            problemas.append(f"{k} debe ser {'arreglo' if tipo is list else 'objeto'}")
    resultados.append(_resultado(f"{pre}: contrato del lago", problemas))

    probado = tema.get("probado")
    resultados.append(_resultado(
        f"{pre}: probado es fecha YYYY-MM-DD",
        [] if _fecha_valida(probado) else [f"probado inválido: {probado!r}"],
    ))

    problemas = []
    fuentes = tema.get("fuentes")
    if not isinstance(fuentes, list) or not fuentes:
        problemas.append("fuentes vacío o ausente")
    else:
        for i, f in enumerate(fuentes):
            if not isinstance(f, dict):
                problemas.append(f"fuentes[{i}] no es un objeto")
                continue
            ident = f.get("id") if _texto_no_vacio(f.get("id")) else f"[{i}]"
            for campo in CAMPOS_FUENTE:
                if not _texto_no_vacio(f.get(campo)):
                    problemas.append(f"fuente {ident}: falta o vacío {campo}")
            ficha = catalogo_por_id.get(f.get("id"))
            if ficha is None:
                problemas.append(f"fuente {ident}: no existe en el catálogo")
                continue
            for campo in CAMPOS_FUENTE:
                if campo in f and f.get(campo) != ficha.get(campo):
                    problemas.append(f"fuente {ident}: {campo} difiere del catálogo")
    resultados.append(_resultado(f"{pre}: fuentes completas y coincidentes con el catálogo", problemas))

    ids_tema = _ids_fuentes(tema)
    ids_catalogo = set(catalogo_por_id)
    problemas = []
    cifras = tema.get("cifras")
    if isinstance(cifras, dict):
        for clave, c in cifras.items():
            if not isinstance(c, dict) or not any(k in c for k in CAMPOS_CIFRA):
                problemas.append(f"cifras.{clave}: no es una Cifra")
    n = 0
    for ruta, c in recorrer_cifras({k: v for k, v in tema.items() if k != "fuentes"}):
        n += 1
        problemas.extend(_problemas_cifra(ruta, c, ids_tema, ids_catalogo))
    if n == 0:
        problemas.append("el Tema no contiene ninguna Cifra")
    resultados.append(_resultado(f"{pre}: cifras con valor, unidad, vigencia y fuente ({n})", problemas))
    return resultados


# --------------------------------------------------------------------------- datos personales
def _personales(obj: Any, ruta: str, clave_padre: str | None,
                claves: list[str], textos: list[str]) -> None:
    if isinstance(obj, dict):
        for k, v in obj.items():
            sub = f"{ruta}.{k}" if ruta else str(k)
            if isinstance(k, str) and _normalizar_clave(k) in CLAVES_PERSONALES:
                claves.append(f"clave personal: {sub}")
            _personales(v, sub, k, claves, textos)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            _personales(v, f"{ruta}[{i}]", clave_padre, claves, textos)
    elif isinstance(obj, str):
        if clave_padre in CLAVES_SIN_ESCANEO:
            return
        if RE_EMAIL.search(obj):
            textos.append(f"correo en {ruta}")
        for m in RE_TELEFONO.finditer(obj):
            if sum(ch.isdigit() for ch in m.group()) >= MIN_DIGITOS_TELEFONO:
                textos.append(f"teléfono en {ruta}")
                break


def comprobar_personales(obj: Any, nombre: str = "lago") -> list[Resultado]:
    """Claves de la lista de nombres personales (8.6) y correos o teléfonos en
    textos (8.7). Las claves `url` no se escanean como texto."""
    claves: list[str] = []
    textos: list[str] = []
    _personales(obj, "", None, claves, textos)
    return [
        _resultado(f"{nombre}: sin claves de datos personales", claves),
        _resultado(f"{nombre}: sin correos ni teléfonos en textos", textos),
    ]


# --------------------------------------------------------------------------- dominio
def _posiciones(v: Any) -> Iterator[list]:
    """Posiciones [lon, lat(, alt)] contenidas en v (GeoJSON o Cifra `punto`)."""
    if isinstance(v, list):
        if 2 <= len(v) <= 3 and all(_es_numero(x) for x in v):
            yield v
        else:
            for x in v:
                yield from _posiciones(x)
    elif isinstance(v, dict):
        for x in v.values():
            yield from _posiciones(x)


def _coordenadas(obj: Any, ruta: str, fuera: list[str]) -> None:
    if isinstance(obj, dict):
        for k, v in obj.items():
            sub = f"{ruta}.{k}" if ruta else str(k)
            if k in CLAVES_COORDENADAS:
                posiciones = list(_posiciones(v))
                if not posiciones:
                    fuera.append(f"{sub}: sin coordenadas numéricas")
                for p in posiciones:
                    lon, lat = p[0], p[1]
                    if not (LON_MIN <= lon <= LON_MAX and LAT_MIN <= lat <= LAT_MAX):
                        fuera.append(f"{sub}: ({lon}, {lat}) fuera de Berlín")
            else:
                _coordenadas(v, sub, fuera)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            _coordenadas(v, f"{ruta}[{i}]", fuera)


def _codigos(problemas: list[str], codigos: Any, donde: str) -> None:
    if not isinstance(codigos, (list, tuple)):
        problemas.append(f"{donde}: ausente")
        return
    cods = sorted(c if isinstance(c, str) else repr(c) for c in codigos)
    if cods != list(CODIGOS_DISTRITO):
        problemas.append(f"{donde}: códigos {cods} ≠ 01–12")


def comprobar_dominio(temas: dict[str, Any]) -> list[Resultado]:
    """Comprobaciones propias de Berlín (9.1–9.7) y tamaño de geometría (2.5)."""
    resultados = []
    territorio = temas.get("territorio")
    poblacion = temas.get("poblacion")
    trafico = temas.get("trafico")

    # 9.1 / 2.6: 12 distritos con códigos 01–12 en cada Tema por distrito y en la geometría.
    problemas: list[str] = []
    for nombre in TEMAS_CON_DISTRITOS:
        pd = _get(temas.get(nombre), "por_distrito")
        _codigos(problemas, list(pd) if isinstance(pd, dict) else None, f"{nombre}.por_distrito")
    features = _get(territorio, "geometria", "features")
    if isinstance(features, list):
        _codigos(problemas, [_get(f, "properties", "codigo") for f in features],
                 "territorio.geometria")
    else:
        problemas.append("territorio.geometria.features: ausente")
    resultados.append(_resultado("dominio: 12 distritos con códigos 01–12", problemas))

    # 9.2 / 9.3: población total plausible e igual a la suma de distritos.
    total = _get(poblacion, "cifras", "poblacion_total", "valor")
    if _es_numero(total):
        problemas = [] if POBLACION_MIN <= total <= POBLACION_MAX else [
            f"poblacion_total {total} fuera de {POBLACION_MIN}–{POBLACION_MAX}"
        ]
    else:
        problemas = ["poblacion.cifras.poblacion_total ausente o no numérica"]
    resultados.append(_resultado("dominio: población total en 3,4–4,2 millones", problemas))

    problemas = []
    pd = _get(poblacion, "por_distrito")
    valores = [_get(d, "poblacion", "valor") for d in pd.values()] if isinstance(pd, dict) else []
    if not valores or not all(_es_numero(v) for v in valores):
        problemas.append("población por distrito ausente o no numérica")
    elif not _es_numero(total) or sum(valores) != total:
        problemas.append(f"Σ distritos {sum(valores)} ≠ poblacion_total {total}")
    resultados.append(_resultado("dominio: Σ población de distritos = total", problemas))

    # 9.4: superficie total a ±1 % de 891,1 km².
    problemas = []
    pd = _get(territorio, "por_distrito")
    areas = [_get(d, "area_km2", "valor") for d in pd.values()] if isinstance(pd, dict) else []
    if not areas or not all(_es_numero(a) for a in areas):
        problemas.append("territorio.por_distrito.*.area_km2 ausente o no numérica")
    else:
        suma = sum(areas)
        if abs(suma - AREA_BERLIN_KM2) > AREA_BERLIN_KM2 * TOLERANCIA_AREA:
            problemas.append(f"Σ área {suma:.2f} km² difiere más de 1 % de {AREA_BERLIN_KM2}")
    resultados.append(_resultado("dominio: Σ superficie a ±1 % de 891,1 km²", problemas))

    # 9.5: toda coordenada dentro del rectángulo de Berlín.
    fuera: list[str] = []
    for nombre in sorted(temas):
        _coordenadas(temas[nombre], nombre, fuera)
    resultados.append(_resultado("dominio: coordenadas dentro del rectángulo de Berlín", fuera))

    # 9.6: todo porcentaje en [0, 100].
    problemas = []
    for nombre in sorted(temas):
        for ruta, c in recorrer_cifras(temas[nombre], nombre):
            if c.get("unidad") == "%":
                malos = [x for x in _numeros(c.get("valor")) if not (0 <= x <= 100)]
                if malos:
                    problemas.append(f"{ruta}: {malos[0]} fuera de 0–100")
    resultados.append(_resultado("dominio: porcentajes en 0–100", problemas))

    # 9.7: perfil de tráfico con 24 valores horarios no negativos.
    perfil = _get(trafico, "series", "perfil_ciudad", "valor")
    if not isinstance(perfil, list):
        problemas = ["trafico.series.perfil_ciudad.valor ausente"]
    else:
        problemas = []
        if len(perfil) != HORAS_PERFIL:
            problemas.append(f"{len(perfil)} valores en lugar de {HORAS_PERFIL}")
        malos = [i for i, v in enumerate(perfil)
                 if not _es_numero(v) or not math.isfinite(v) or v < 0]
        if malos:
            problemas.append(f"horas sin valor numérico ≥ 0: {malos}")
    resultados.append(_resultado("dominio: perfil de tráfico de 24 valores ≥ 0", problemas))

    # 2.5: geometría GeoJSON de distritos ≤ 200 KB.
    geometria = _get(territorio, "geometria")
    if not isinstance(geometria, dict) or geometria.get("type") != "FeatureCollection":
        problemas = ["territorio.geometria no es una FeatureCollection"]
    else:
        problemas = []
        tipos = {_get(f, "geometry", "type") for f in geometria.get("features") or []}
        if not tipos <= {"Polygon", "MultiPolygon"}:
            problemas.append(f"tipos de geometría no admitidos: {sorted(map(str, tipos))}")
        tam = len(json.dumps(geometria, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
        if tam > LIMITE_GEOMETRIA_BYTES:
            problemas.append(f"{tam} bytes > {LIMITE_GEOMETRIA_BYTES}")
    resultados.append(_resultado("dominio: geometría de distritos ≤ 200 KB", problemas))
    return resultados


# --------------------------------------------------------------------------- orquestación
def _leer_json(ruta: Path) -> tuple[Any, str | None]:
    try:
        with open(ruta, encoding="utf-8") as fh:
            return json.load(fh), None
    except Exception as exc:  # ilegible, no UTF-8, JSON inválido…
        return None, f"{type(exc).__name__}: {exc}"


def _seguro(nombre: str, fn, *args) -> list[Resultado]:
    """Ejecuta una comprobación; si lanza, la convierte en FAIL (verificar nunca lanza)."""
    try:
        return fn(*args)
    except Exception as exc:
        return [Resultado(nombre, False, f"error interno {type(exc).__name__}: {exc}")]


def verificar(lago: Path, catalogo: Path) -> list[Resultado]:
    """Ejecuta todas las comprobaciones. Nunca lanza: lo ilegible es FAIL."""
    resultados: list[Resultado] = []
    lago, catalogo = Path(lago), Path(catalogo)

    datos_catalogo, error_catalogo = _leer_json(catalogo)
    resultados.append(_resultado(
        "catalogo: legible", [f"{catalogo}: {error_catalogo}"] if error_catalogo else []
    ))
    fichas = datos_catalogo if isinstance(datos_catalogo, list) else []
    catalogo_por_id = {
        f["id"]: f for f in fichas if isinstance(f, dict) and isinstance(f.get("id"), str)
    }

    temas: dict[str, Any] = {}
    try:
        archivos = sorted(p for p in lago.glob("*.json") if p.is_file())
    except Exception as exc:
        archivos = []
        resultados.append(Resultado("lago: legible", False, f"{type(exc).__name__}: {exc}"))
    resultados.append(_resultado(
        "lago: contiene JSON de Tema", [] if archivos else [f"sin archivos *.json en {lago}"]
    ))
    for archivo in archivos:
        datos, error = _leer_json(archivo)
        resultados.append(_resultado(f"{archivo.stem}: JSON legible", [error] if error else []))
        if error is None:
            temas[archivo.stem] = datos

    if error_catalogo is None:  # si es ilegible, "catalogo: legible" ya es FAIL
        resultados += _seguro("catalogo: comprobaciones", comprobar_catalogo, datos_catalogo, temas)
    for nombre, tema in temas.items():
        resultados += _seguro(f"{nombre}: contrato", comprobar_tema, nombre, tema, catalogo_por_id)
        resultados += _seguro(f"{nombre}: datos personales", comprobar_personales, tema, nombre)
    resultados += _seguro("dominio: comprobaciones", comprobar_dominio, temas)
    return resultados


def _n_fail(resultados: list[Resultado]) -> int:
    return sum(1 for r in resultados if not r.ok)


def codigo_salida(resultados: list[Resultado]) -> int:
    """1 si hay algún FAIL, si no 0. No depende de la impresión (8.11)."""
    return 1 if _n_fail(resultados) > 0 else 0


def imprimir(resultados: list[Resultado], salida: TextIO) -> None:
    """Una línea por comprobación ("PASS x" / "FAIL x: detalle") y un resumen."""
    for r in resultados:
        if r.ok:
            salida.write(f"PASS {r.nombre}\n")
        else:
            salida.write(f"FAIL {r.nombre}: {r.detalle}\n")
    n_fail = _n_fail(resultados)
    salida.write(
        f"Resumen: {len(resultados) - n_fail} de {len(resultados)} comprobaciones superadas, "
        f"{n_fail} fallidas.{' Lago NO publicable.' if n_fail else ''}\n"
    )


def _silenciar_stdout() -> None:
    """Redirige el descriptor de stdout a os.devnull para que el flush final del
    intérprete (p. ej. ante una tubería cerrada) no sustituya el código de salida."""
    try:
        nulo = os.open(os.devnull, os.O_WRONLY)
        os.dup2(nulo, sys.stdout.fileno())
        os.close(nulo)
    except Exception:
        pass


def _parsear(argv: list[str] | None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Verificador del lago (puerta de publicación).")
    p.add_argument("--lago", type=Path, default=LAGO_POR_DEFECTO,
                   help="directorio con los JSON de Tema (por defecto: lago/)")
    p.add_argument("--catalogo", type=Path, default=CATALOGO_POR_DEFECTO,
                   help="archivo del catálogo (por defecto: catalogo/fuentes.json)")
    return p.parse_args(argv)


def main(argv: list[str] | None = None, salida: TextIO | None = None) -> int:
    args = _parsear(argv)
    resultados = verificar(args.lago, args.catalogo)
    codigo = codigo_salida(resultados)  # calculado ANTES de imprimir (8.11)
    destino = salida if salida is not None else sys.stdout
    try:
        imprimir(resultados, destino)
        destino.flush()
    except Exception as exc:  # BrokenPipeError, UnicodeEncodeError, OSError…
        try:
            sys.stderr.write(
                f"verificar: no se pudo imprimir ({type(exc).__name__}); FAIL={_n_fail(resultados)}\n"
            )
        except Exception:
            pass
        # Solo se silencia el stdout real; un flujo inyectado no lo necesita.
        if destino is sys.stdout or destino is sys.__stdout__:
            _silenciar_stdout()
    return codigo  # 8.12, 8.13


if __name__ == "__main__":
    raise SystemExit(main())
