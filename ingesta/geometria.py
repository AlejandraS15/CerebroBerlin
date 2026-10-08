"""Geometría planar pura para la ingesta (solo biblioteca estándar, sin E/S).

Convenciones (GeoJSON):
- Punto: secuencia ``(x, y)`` (lon/lat en EPSG:4326, este/norte en EPSG:25833).
- Anillo: lista de puntos; puede venir cerrado (primero == último) o abierto.
- Polígono: lista de anillos; el primero es el exterior y el resto huecos.
- MultiPolígono: lista de polígonos.

Las funciones aceptan tuplas o listas indistintamente (los JSON cargados traen
listas) y no modifican sus argumentos.
"""

from __future__ import annotations

import math
from typing import Any, Sequence

Punto = Sequence[float]
Anillo = Sequence[Punto]
Poligono = Sequence[Anillo]
MultiPoligono = Sequence[Poligono]


# --------------------------------------------------------------------------
# Áreas
# --------------------------------------------------------------------------

def _area_con_signo(anillo: Anillo) -> float:
    """Fórmula del cordón (shoelace). Positiva si el anillo es antihorario.

    Funciona con anillos abiertos o cerrados: el tramo de cierre duplicado
    aporta 0.
    """
    n = len(anillo)
    if n < 3:
        return 0.0
    suma = 0.0
    for i in range(n):
        x1, y1 = anillo[i][0], anillo[i][1]
        x2, y2 = anillo[(i + 1) % n][0], anillo[(i + 1) % n][1]
        suma += x1 * y2 - x2 * y1
    return suma / 2.0


def area_anillo(anillo: Anillo) -> float:
    """Área planar del anillo (valor absoluto del shoelace)."""
    return abs(_area_con_signo(anillo))


def area_poligono(poligono: Poligono) -> float:
    """Área del exterior menos la de los huecos."""
    if not poligono:
        return 0.0
    exterior = area_anillo(poligono[0])
    huecos = sum(area_anillo(h) for h in poligono[1:])
    return exterior - huecos


def area_multipoligono(mp: MultiPoligono) -> float:
    """Suma de las áreas de todas las partes."""
    return sum(area_poligono(p) for p in mp)


# --------------------------------------------------------------------------
# Simplificación
# --------------------------------------------------------------------------

def _distancia_a_tramo(p: Punto, a: Punto, b: Punto) -> float:
    """Distancia euclídea de ``p`` al segmento ``a``–``b`` (no a la recta)."""
    px, py = p[0], p[1]
    ax, ay = a[0], a[1]
    bx, by = b[0], b[1]
    dx, dy = bx - ax, by - ay
    largo2 = dx * dx + dy * dy
    if largo2 == 0.0:
        return math.hypot(px - ax, py - ay)
    t = ((px - ax) * dx + (py - ay) * dy) / largo2
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def douglas_peucker(linea: Sequence[Punto], tolerancia: float) -> list:
    """Douglas–Peucker iterativo (pila explícita, sin recursión).

    Devuelve una subsecuencia de ``linea`` que conserva el primer y el último
    punto; cada punto eliminado queda a distancia ≤ ``tolerancia`` del tramo
    simplificado que lo cubre. Determinista: ante empates de distancia se
    elige el índice más bajo.
    """
    n = len(linea)
    if n <= 2:
        return list(linea)
    conservar = [False] * n
    conservar[0] = True
    conservar[n - 1] = True
    pila = [(0, n - 1)]
    while pila:
        inicio, fin = pila.pop()
        if fin - inicio < 2:
            continue
        a, b = linea[inicio], linea[fin]
        max_d = -1.0
        indice = -1
        for i in range(inicio + 1, fin):
            d = _distancia_a_tramo(linea[i], a, b)
            if d > max_d:
                max_d = d
                indice = i
        if max_d > tolerancia:
            conservar[indice] = True
            pila.append((indice, fin))
            pila.append((inicio, indice))
    return [p for p, k in zip(linea, conservar) if k]


def _mismo_punto(a: Punto, b: Punto) -> bool:
    return a[0] == b[0] and a[1] == b[1]


def simplificar_anillo(anillo: Anillo, tolerancia: float) -> list:
    """Simplifica un anillo manteniéndolo cerrado y con ≥ 4 vértices.

    Si Douglas–Peucker lo reduce a menos de 4 vértices (triángulo cerrado),
    se usa un triángulo determinista sobre los vértices originales: el primero,
    el más lejano a él y el más lejano al segmento entre ambos.
    """
    puntos = list(anillo)
    if not puntos:
        return []
    if not _mismo_punto(puntos[0], puntos[-1]):
        puntos.append(puntos[0])
    if len(puntos) <= 4:
        return puntos

    simplificado = douglas_peucker(puntos, tolerancia)
    if len(simplificado) >= 4:
        return simplificado

    # Respaldo: triángulo sobre vértices originales (sin el cierre duplicado).
    abiertos = puntos[:-1]
    p0 = abiertos[0]
    i_lejano = max(
        range(1, len(abiertos)),
        key=lambda i: (math.hypot(abiertos[i][0] - p0[0], abiertos[i][1] - p0[1]), -i),
    )
    p1 = abiertos[i_lejano]
    candidatos = [i for i in range(1, len(abiertos)) if i != i_lejano]
    i_tercero = max(
        candidatos,
        key=lambda i: (_distancia_a_tramo(abiertos[i], p0, p1), -i),
    )
    indices = sorted({0, i_lejano, i_tercero})
    return [abiertos[i] for i in indices] + [p0]


# --------------------------------------------------------------------------
# Pertenencia y punto interior
# --------------------------------------------------------------------------

def _dentro_de_anillo(p: Punto, anillo: Anillo) -> bool:
    """Ray casting (regla par-impar) con rayo horizontal hacia +x."""
    x, y = p[0], p[1]
    dentro = False
    n = len(anillo)
    if n < 3:
        return False
    j = n - 1
    for i in range(n):
        xi, yi = anillo[i][0], anillo[i][1]
        xj, yj = anillo[j][0], anillo[j][1]
        if (yi > y) != (yj > y):
            x_corte = xi + (y - yi) * (xj - xi) / (yj - yi)
            if x < x_corte:
                dentro = not dentro
        j = i
    return dentro


def punto_en_poligono(p: Punto, poligono: Poligono) -> bool:
    """Verdadero si ``p`` está dentro del exterior y fuera de todos los huecos."""
    if not poligono or not _dentro_de_anillo(p, poligono[0]):
        return False
    return not any(_dentro_de_anillo(p, h) for h in poligono[1:])


def punto_interior(mp: MultiPoligono) -> tuple[float, float]:
    """Punto garantizado dentro de la parte de mayor área del MultiPolígono.

    Se traza la recta horizontal en la latitud media del bbox del exterior;
    si pasa exactamente por algún vértice se desplaza un épsilon determinista.
    Se ordenan las intersecciones con todos los anillos (exterior y huecos) y
    se devuelve el punto medio del tramo interior más ancho (regla par-impar).
    """
    if not mp:
        raise ValueError("MultiPolígono vacío")
    # Parte de mayor área; ante empate, la primera.
    parte = mp[0]
    mayor = area_poligono(parte)
    for p in mp[1:]:
        a = area_poligono(p)
        if a > mayor:
            parte, mayor = p, a
    if not parte or len(parte[0]) < 3:
        raise ValueError("polígono degenerado")

    ys_exterior = [pt[1] for pt in parte[0]]
    min_y, max_y = min(ys_exterior), max(ys_exterior)
    if max_y <= min_y:
        raise ValueError("polígono sin altura")

    ys_vertices = {pt[1] for anillo in parte for pt in anillo}
    alto = max_y - min_y
    y = (min_y + max_y) / 2.0
    epsilon = alto * 1e-6
    k = 1
    while y in ys_vertices:
        # Secuencia determinista: +ε, −ε, +2ε, −2ε, ... alrededor del centro.
        desplazamiento = epsilon * ((k + 1) // 2)
        y = (min_y + max_y) / 2.0 + (desplazamiento if k % 2 else -desplazamiento)
        k += 1
        if k > 10_000:
            raise ValueError("no se encontró una recta libre de vértices")

    cortes: list[float] = []
    for anillo in parte:
        n = len(anillo)
        for i in range(n):
            x1, y1 = anillo[i][0], anillo[i][1]
            x2, y2 = anillo[(i + 1) % n][0], anillo[(i + 1) % n][1]
            if (y1 > y) != (y2 > y):
                cortes.append(x1 + (y - y1) * (x2 - x1) / (y2 - y1))
    cortes.sort()
    if len(cortes) < 2:
        raise ValueError("la recta no corta el polígono")

    mejor_ancho = -1.0
    mejor_x = cortes[0]
    for i in range(0, len(cortes) - 1, 2):
        ancho = cortes[i + 1] - cortes[i]
        if ancho > mejor_ancho:
            mejor_ancho = ancho
            mejor_x = (cortes[i] + cortes[i + 1]) / 2.0
    return (mejor_x, y)


# --------------------------------------------------------------------------
# Redondeo
# --------------------------------------------------------------------------

def _redondear(valor: Any, decimales: int) -> Any:
    if isinstance(valor, bool):
        return valor
    if isinstance(valor, (int, float)):
        r = round(float(valor), decimales)
        return 0.0 if r == 0 else r  # evita "-0.0" en la salida
    if isinstance(valor, (list, tuple)):
        return [_redondear(v, decimales) for v in valor]
    return valor


def redondear_coords(geom: Any, decimales: int = 5) -> Any:
    """Redondea coordenadas a ``decimales``.

    Acepta una geometría GeoJSON (dict con ``coordinates`` o ``geometries``),
    un Feature/FeatureCollection, o directamente coordenadas anidadas.
    Devuelve una copia con listas; el resto de claves se conserva tal cual.
    """
    if isinstance(geom, dict):
        copia = dict(geom)
        if "coordinates" in copia:
            copia["coordinates"] = _redondear(copia["coordinates"], decimales)
        if "geometries" in copia:
            copia["geometries"] = [redondear_coords(g, decimales) for g in copia["geometries"]]
        if isinstance(copia.get("geometry"), dict):
            copia["geometry"] = redondear_coords(copia["geometry"], decimales)
        if "features" in copia:
            copia["features"] = [redondear_coords(f, decimales) for f in copia["features"]]
        return copia
    return _redondear(geom, decimales)
