"""Utilidades compartidas por los Scripts_de_Ingesta (solo biblioteca estándar).

HTTP con reintentos acotados, consultas WFS paginadas, lectura del catálogo,
redondeo fijo por unidad, JSON determinista y escritura atómica de Temas.
Las rutas y dependencias externas (`urllib.request.urlopen`, `time.sleep`) se
resuelven en tiempo de llamada para que las pruebas puedan parchearlas.
"""

from __future__ import annotations

import http.client
import json
import math
import os
import re
import sys
import tempfile
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

USER_AGENT = "CerebroBerlin-ingesta/1.0 (taller de datos; contacto en README)"
RAIZ = Path(__file__).resolve().parent.parent
LAGO, RAW, CATALOGO = RAIZ / "lago", RAIZ / "lago" / "raw", RAIZ / "catalogo" / "fuentes.json"

# Bytes del cuerpo de error que se incluyen en el mensaje.
_FRAGMENTO = 300


class IngestaError(Exception):
    """Error esperado de ingesta: HTTP no 2xx, red o contenido no esperado."""


# --------------------------------------------------------------------------- HTTP


def _fragmento(cuerpo: bytes | None) -> str:
    if not cuerpo:
        return ""
    return cuerpo[:_FRAGMENTO].decode("utf-8", errors="replace")


def _cuerpo_de_error(err: urllib.error.HTTPError) -> bytes:
    try:
        return err.read() or b""
    except Exception:  # el cuerpo de un error puede no ser legible
        return b""


def _mensaje(url: str, codigo, cuerpo: bytes | None, intentos: int) -> str:
    texto = f"GET {url} → HTTP {codigo} (intento(s): {intentos})"
    frag = _fragmento(cuerpo)
    return f"{texto}; cuerpo: {frag!r}" if frag else texto


def http_get(url: str, intentos: int = 3, timeout: int = 60) -> bytes:
    """GET con User-Agent. Toda respuesta que no sea 2xx es un error (3.8),
    sin excepción por código ni por fuente:
      - 4xx (400, 403, 404, 429, …): IngestaError inmediato, sin reintento;
        no se intenta eludir bloqueos (1.11).
      - 5xx y errores de red (URLError, timeout, conexión reiniciada):
        hasta `intentos` intentos con espera 2 s, 4 s, 8 s; si el último
        falla, IngestaError.
      - cualquier otro código no 2xx que urllib no resuelva (p. ej. 3xx sin
        Location): IngestaError inmediato.
    El mensaje incluye URL, código de estado y los primeros 300 bytes del
    cuerpo (el error exacto). Nunca devuelve un cuerpo de error como datos."""
    if intentos < 1:
        raise ValueError("intentos debe ser ≥ 1")
    ultimo = ""
    for intento in range(1, intentos + 1):
        if intento > 1:
            time.sleep(2 ** (intento - 1))  # 2 s, 4 s, 8 s, …
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            resp = urllib.request.urlopen(req, timeout=timeout)
            try:
                codigo = getattr(resp, "status", None)
                if codigo is None:
                    codigo = resp.getcode()
                cuerpo = resp.read()
            finally:
                cerrar = getattr(resp, "close", None)
                if callable(cerrar):
                    cerrar()
        except urllib.error.HTTPError as err:
            codigo, cuerpo = err.code, _cuerpo_de_error(err)
        except (OSError, http.client.HTTPException) as err:
            # URLError (no HTTP), timeout, conexión reiniciada, lectura incompleta…
            ultimo = f"GET {url} → error de red sin código HTTP: {err!r}"
            continue

        if codigo is not None and 200 <= int(codigo) < 300:
            return cuerpo
        if codigo is not None and 500 <= int(codigo) < 600:
            ultimo = _mensaje(url, codigo, cuerpo, intento)
            continue
        # 4xx, 3xx sin resolver o cualquier otro código no 2xx: sin reintento.
        raise IngestaError(_mensaje(url, codigo, cuerpo, intento))
    raise IngestaError(f"{ultimo} — agotados {intentos} intento(s)")


# --------------------------------------------------------------------------- WFS


def wfs_url(base: str, type_name: str, *, property_names: list[str] | None = None,
            count: int | None = None, start_index: int | None = None,
            srs_name: str | None = None, result_type: str | None = None) -> str:
    """GetFeature WFS 2.0.0, outputFormat=application/json. Con property_names
    no se pide la geometría."""
    params: list[tuple[str, str]] = [
        ("service", "WFS"),
        ("version", "2.0.0"),
        ("request", "GetFeature"),
        ("typeNames", type_name),
        ("outputFormat", "application/json"),
    ]
    if property_names:
        params.append(("propertyName", ",".join(property_names)))
    if count is not None:
        params.append(("count", str(int(count))))
    if start_index is not None:
        params.append(("startIndex", str(int(start_index))))
    if srs_name is not None:
        params.append(("srsName", srs_name))
    if result_type is not None:
        params.append(("resultType", result_type))
    consulta = urllib.parse.urlencode(params, safe=":,/")
    separador = "&" if "?" in base else "?"
    if base.endswith(("?", "&")):
        separador = ""
    return f"{base}{separador}{consulta}"


def paginas(total: int, count: int) -> list[int]:
    """startIndex de cada página: [0, count, 2·count, …] < total."""
    if count < 1:
        raise ValueError("count debe ser ≥ 1")
    if total < 0:
        raise ValueError("total debe ser ≥ 0")
    return list(range(0, total, count))


def _slug(type_name: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", type_name)


def _json(cuerpo: bytes, origen: str):
    try:
        return json.loads(cuerpo.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as err:
        raise IngestaError(
            f"contenido no esperado de {origen}: no es JSON ({err}); "
            f"cuerpo: {_fragmento(cuerpo)!r}") from None


def wfs_total(base: str, type_name: str) -> int:
    """resultType=hits → numberMatched."""
    url = wfs_url(base, type_name, result_type="hits")
    cuerpo = http_get(url)
    guardar_raw(f"{_slug(type_name)}_hits.txt", cuerpo)
    total = None
    try:
        datos = json.loads(cuerpo.decode("utf-8"))
        if isinstance(datos, dict):
            total = datos.get("numberMatched", datos.get("totalFeatures"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        # GeoServer suele responder a resultType=hits con XML.
        m = re.search(rb'numberMatched="([^"]*)"', cuerpo)
        if m:
            total = m.group(1).decode("ascii", errors="replace")
    if isinstance(total, str) and total.isdigit():
        total = int(total)
    if not isinstance(total, int) or isinstance(total, bool) or total < 0:
        raise IngestaError(
            f"contenido no esperado de {url}: numberMatched no es un entero "
            f"({total!r}); cuerpo: {_fragmento(cuerpo)!r}")
    return total


def wfs_todas(base, type_name, property_names, count=5000) -> list[dict]:
    """Descarga todas las páginas, guarda cada una en lago/raw/ y devuelve
    las properties. Si len(resultado) != wfs_total → IngestaError (5.7)."""
    total = wfs_total(base, type_name)
    resultado: list[dict] = []
    for inicio in paginas(total, count):
        url = wfs_url(base, type_name, property_names=property_names,
                      count=count, start_index=inicio)
        cuerpo = http_get(url)
        guardar_raw(f"{_slug(type_name)}_{inicio:08d}.json", cuerpo)
        datos = _json(cuerpo, url)
        features = datos.get("features") if isinstance(datos, dict) else None
        if not isinstance(features, list):
            raise IngestaError(f"contenido no esperado de {url}: falta 'features'")
        for f in features:
            props = f.get("properties") if isinstance(f, dict) else None
            if not isinstance(props, dict):
                raise IngestaError(f"contenido no esperado de {url}: feature sin 'properties'")
            resultado.append(props)
    if len(resultado) != total:
        raise IngestaError(f"descargados {len(resultado)} de {total} ({type_name})")
    return resultado


def guardar_raw(nombre: str, contenido: bytes) -> Path:
    """Guarda la descarga original en lago/raw/<nombre> (3.3)."""
    if not nombre or Path(nombre).name != nombre or nombre in (".", ".."):
        raise ValueError(f"nombre de archivo raw no válido: {nombre!r}")
    RAW.mkdir(parents=True, exist_ok=True)
    ruta = RAW / nombre
    ruta.write_bytes(contenido)
    return ruta


# --------------------------------------------------------------------------- Catálogo


def _fichas() -> list[dict]:
    # Lectura perezosa en cada llamada: el catálogo es documentación editable.
    try:
        datos = json.loads(Path(CATALOGO).read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise IngestaError(f"no existe el catálogo {CATALOGO}") from None
    except json.JSONDecodeError as err:
        raise IngestaError(f"catálogo {CATALOGO} no es JSON válido: {err}") from None
    if isinstance(datos, dict) and isinstance(datos.get("fuentes"), list):
        datos = datos["fuentes"]
    if not isinstance(datos, list):
        raise IngestaError(f"catálogo {CATALOGO}: se esperaba un arreglo de fichas")
    return datos


def ficha(id_fuente: str) -> dict:
    """Ficha del catálogo; IngestaError si no existe."""
    for f in _fichas():
        if isinstance(f, dict) and f.get("id") == id_fuente:
            return f
    raise IngestaError(f"la fuente {id_fuente!r} no existe en el catálogo {CATALOGO}")


def fuente_de(id_fuente: str) -> dict:
    """{id, nombre, url, estado, licencia} copiados de la ficha."""
    f = ficha(id_fuente)
    campos = ("id", "nombre", "url", "estado", "licencia")
    faltan = [c for c in campos if c not in f]
    if faltan:
        raise IngestaError(f"ficha {id_fuente!r} sin campos: {', '.join(faltan)}")
    return {c: f[c] for c in campos}


# --------------------------------------------------------------------------- Cifras

_DECIMALES = {"hab": 0, "%": 1, "km²": 2, "veh/h": 1, "°": 5}


def _decimales(unidad: str) -> int | None:
    if unidad in _DECIMALES:
        return _DECIMALES[unidad]
    if unidad.startswith("°"):  # p. ej. "° WGS84" (coordenadas)
        return 5
    return None


def redondear(valor: float, unidad: str) -> float | int:
    """Redondeo fijo por unidad: hab→0, %→1, km²→2, veh/h→1, °→5 decimales.

    Las unidades que empiezan por "°" (p. ej. "° WGS84") usan 5 decimales.
    Listas y tuplas (p. ej. un punto [lng, lat]) se redondean elemento a
    elemento. Texto y booleanos se devuelven sin cambios. Un entero en una
    unidad sin regla (conteos como "bloques") se conserva; un número no entero
    en una unidad sin regla, o un valor no finito, es IngestaError."""
    if isinstance(valor, (list, tuple)):
        return [redondear(v, unidad) for v in valor]
    if isinstance(valor, (str, bool)) or valor is None:
        return valor
    if not isinstance(valor, (int, float)):
        raise IngestaError(f"valor no numérico para la unidad {unidad!r}: {valor!r}")
    if isinstance(valor, float) and not math.isfinite(valor):
        raise IngestaError(f"valor no finito para la unidad {unidad!r}: {valor!r}")
    dec = _decimales(unidad)
    if dec is None:
        if isinstance(valor, int) or float(valor).is_integer():
            return int(valor)
        raise IngestaError(f"unidad sin redondeo fijo: {unidad!r} (valor {valor!r})")
    if dec == 0:
        return int(round(valor))
    r = round(float(valor), dec)
    return 0.0 if r == 0 else r  # evita "-0.0" en la salida


def cifra(valor, unidad: str, vigencia: str, fuente: str) -> dict:
    """{"valor", "unidad", "vigencia", "fuente"} con valor redondeado según la unidad."""
    return {
        "valor": redondear(valor, unidad),
        "unidad": unidad,
        "vigencia": vigencia,
        "fuente": fuente,
    }


def hoy() -> str:
    """Fecha ISO del día; admite CEREBRO_FECHA para pruebas."""
    fijada = os.environ.get("CEREBRO_FECHA")
    if fijada:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", fijada):
            raise IngestaError(f"CEREBRO_FECHA no es YYYY-MM-DD: {fijada!r}")
        try:
            return date.fromisoformat(fijada).isoformat()
        except ValueError:
            raise IngestaError(f"CEREBRO_FECHA no es una fecha válida: {fijada!r}") from None
    return date.today().isoformat()


# --------------------------------------------------------------------------- Escritura


def serializar(obj) -> str:
    """json.dumps(sort_keys=True, ensure_ascii=False, indent=2) + "\\n"."""
    try:
        return json.dumps(obj, sort_keys=True, ensure_ascii=False, indent=2,
                          allow_nan=False) + "\n"
    except ValueError as err:  # NaN/Infinity no son JSON válido
        raise IngestaError(f"no se puede serializar: {err}") from None


def escribir_tema(nombre: str, tema: dict) -> Path:
    """Escritura atómica: tmp en el mismo directorio + os.replace."""
    archivo = nombre if nombre.endswith(".json") else f"{nombre}.json"
    if Path(archivo).name != archivo:
        raise ValueError(f"nombre de Tema no válido: {nombre!r}")
    texto = serializar(tema)  # si falla, no se toca nada
    LAGO.mkdir(parents=True, exist_ok=True)
    destino = LAGO / archivo
    fd, tmp = tempfile.mkstemp(dir=LAGO, prefix=f".{archivo}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as fh:
            fh.write(texto)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, destino)
    except BaseException:
        try:
            os.unlink(tmp)
        except FileNotFoundError:
            pass
        raise
    return destino


def main_seguro(fn) -> None:
    """Ejecuta fn(). Ante IngestaError (cualquier error HTTP de 4xx inmediato
    o de 5xx tras reintentos, o contenido no esperado) imprime el error
    exacto en stderr y llama a sys.exit(1). Cualquier otra excepción imprime
    la traza y también sale con 1. Como escribir_tema solo se invoca al final
    de fn(), el Tema existente queda intacto en todos estos casos (3.8)."""
    try:
        fn()
    except IngestaError as err:
        print(f"ERROR de ingesta: {err}", file=sys.stderr)
        sys.exit(1)
    except Exception:
        traceback.print_exc()
        sys.exit(1)
