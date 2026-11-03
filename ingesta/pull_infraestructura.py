#!/usr/bin/env python3
"""Construye el snapshot de equipamientos OSM de Berlín.

La fuente es el ZIP de shapefiles de Geofabrik publicado por el portal de
datos de Berlín. Se leen únicamente las capas POI puntuales y poligonales; el
resultado no contiene geometrías completas, solo el punto representativo de
cada equipamiento.
"""
from __future__ import annotations

import argparse
import io
import json
import struct
import sys
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "lago" / "infraestructura.json"
URL = "https://download.geofabrik.de/europe/germany/berlin-latest-free.shp.zip"
FUENTE = "openstreetmap-daten-f-r-berlin"
BBOX = (13.088, 52.338, 13.761, 52.675)

# Categorías deliberadamente enfocadas en equipamientos de interés ciudadano.
CATEGORIAS = {
    "hospital": "hospital",
    "clinic": "salud",
    "doctors": "salud",
    "school": "escuela",
    "kindergarten": "educacion",
    "college": "educacion",
    "university": "universidad",
    "library": "biblioteca",
    "museum": "museo",
    "theatre": "cultura",
    "arts_centre": "cultura",
    "cinema": "cultura",
    "community_centre": "comunidad",
    "sports_centre": "deporte",
    "sports_hall": "deporte",
    "swimming_pool": "deporte",
    "fire_station": "emergencias",
    "police": "seguridad",
    "courthouse": "justicia",
    "town_hall": "administracion",
    "water_works": "agua",
}


def dbf_rows(raw: bytes) -> list[dict[str, str]]:
    count = struct.unpack_from("<I", raw, 4)[0]
    header_len = struct.unpack_from("<H", raw, 8)[0]
    row_len = struct.unpack_from("<H", raw, 10)[0]
    fields: list[tuple[str, int]] = []
    offset = 32
    while raw[offset] != 0x0D:
        name = raw[offset : offset + 11].split(b"\0", 1)[0].decode("ascii")
        fields.append((name, raw[offset + 16]))
        offset += 32
    rows = []
    for i in range(count):
        row = raw[header_len + i * row_len : header_len + (i + 1) * row_len]
        cursor = 1
        values: dict[str, str] = {}
        for name, length in fields:
            values[name] = row[cursor : cursor + length].decode("utf-8", "replace").strip()
            cursor += length
        rows.append(values)
    return rows


def shape_points(raw: bytes) -> list[tuple[float, float] | None]:
    """Devuelve un punto por registro Point o Polygon."""
    shape_type = struct.unpack_from("<i", raw, 32)[0]
    points: list[tuple[float, float] | None] = []
    cursor = 100
    while cursor + 8 <= len(raw):
        _record_number, content_words = struct.unpack_from(">ii", raw, cursor)
        cursor += 8
        content_len = content_words * 2
        content = raw[cursor : cursor + content_len]
        cursor += content_len
        if len(content) < 4:
            points.append(None)
            continue
        record_type = struct.unpack_from("<i", content, 0)[0]
        if record_type == 1:
            points.append(struct.unpack_from("<dd", content, 4))
        elif record_type == 5:
            num_parts, num_points = struct.unpack_from("<ii", content, 36)
            point_offset = 44 + num_parts * 4
            coords = [
                struct.unpack_from("<dd", content, point_offset + i * 16)
                for i in range(num_points)
            ]
            if coords:
                points.append(
                    (
                        sum(x for x, _ in coords) / len(coords),
                        sum(y for _, y in coords) / len(coords),
                    )
                )
            else:
                points.append(None)
        else:
            points.append(None)
    return points


def read_layer(archive: zipfile.ZipFile, stem: str) -> list[dict[str, str | float]]:
    dbf = dbf_rows(archive.read(f"{stem}.dbf"))
    points = shape_points(archive.read(f"{stem}.shp"))
    if len(dbf) != len(points):
        raise ValueError(f"{stem}: {len(dbf)} registros DBF y {len(points)} geometrías")
    return [
        {**row, "lon": point[0], "lat": point[1]}
        for row, point in zip(dbf, points)
        if point is not None
    ]


def download(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "CerebroBerlin-ingesta/1.0"})
    with urllib.request.urlopen(request, timeout=600) as response:
        return response.read()


def build_snapshot(raw_zip: bytes, probado: str) -> dict:
    selected: dict[tuple[str, str, int, int], dict] = {}
    with zipfile.ZipFile(io.BytesIO(raw_zip)) as archive:
        stems = ("gis_osm_pois_free_1", "gis_osm_pois_a_free_1")
        for stem in stems:
            for row in read_layer(archive, stem):
                category = CATEGORIAS.get(str(row["fclass"]))
                name = str(row["name"]).strip()
                if not category or not name:
                    continue
                lon, lat = float(row["lon"]), float(row["lat"])
                if not (BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]):
                    continue
                key = (category, name.casefold(), round(lon, 5), round(lat, 5))
                selected[key] = {
                    "id": f"osm-{row['osm_id']}",
                    "category": category,
                    "name": name,
                    "position": [round(lon, 6), round(lat, 6)],
                    "osmId": str(row["osm_id"]),
                }
    points = sorted(selected.values(), key=lambda p: (p["category"], p["name"].casefold(), p["id"]))
    return {
        "tema": "infraestructura",
        "probado": probado,
        "fuentes": [{
            "id": FUENTE,
            "nombre": "OpenStreetMap Daten für Berlin",
            "url": "https://daten.berlin.de/datensaetze/openstreetmap-daten-f-r-berlin",
            "estado": "integrado",
            "licencia": "Open Data Commons Open Database License (ODbL)",
        }],
        "cifras": {
            "equipamientos": {
                "valor": len(points),
                "unidad": "puntos de interés",
                "vigencia": "snapshot 2026-11-02",
                "fuente": FUENTE,
            }
        },
        "series": {},
        "puntos": points,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, help="ZIP local; si se omite se descarga")
    parser.add_argument("--probado", required=True, help="Fecha YYYY-MM-DD de la descarga")
    args = parser.parse_args()
    try:
        raw_zip = args.input.read_bytes() if args.input else download(URL)
        snapshot = build_snapshot(raw_zip, args.probado)
        SALIDA.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"PASS infraestructura: {len(snapshot['puntos'])} equipamientos → {SALIDA}")
    except (OSError, ValueError, urllib.error.URLError, zipfile.BadZipFile) as exc:
        print(f"FAIL infraestructura: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
