# Implementation Plan: official-district-data

## Overview

Plan incremental que sigue la ruta de la guía "Taller de datos": rastreo (catálogo) → permiso (licencias en las fichas) → lago (scripts Python de biblioteca estándar ejecutados contra las fuentes reales) → verificación (puerta de publicación) → vistas con procedencia (TypeScript/Next.js) → documentación (README y Diccionario_de_Datos). Python 3 (stdlib + `unittest`) para ingesta y verificación; TypeScript + Vitest + fast-check para la Aplicación. Las pruebas de Python y el Verificador se ejecutan en el host con `python3`; las de TypeScript, dentro del contenedor `web-dev`. En el mapa 3D cada punto y cada vértice de distrito se dibuja a la elevación del terreno en su propia coordenada (`src/lib/terrain.ts` + `useTerrainElevation`), por lo que esos módulos se implementan antes de `buildDeckLayers` y `MapContainer`.

## Tasks

- [x] 1. Rastreo y configuración del repositorio
  - [x] 1.1 Crear `catalogo/fuentes.json` con todas las fuentes rastreadas
    - Arreglo ordenado por `id` con las 17 Fichas_de_Fuente de 1.1: `alkis-bezirke`, `ua-einwohnerdichte-2024`, Einwohner LOR CSV (F05), `ua-flaechennutzung-2020`, Grünanlagenbestand, `verkehrsdetektion`, Luftgütemessnetz, Open-Meteo calidad del aire, Open-Meteo meteorología, VBB transport.rest, nextbike GBFS, OpenFreeMap, Terrarium, InfraNode, API de aire de la UBA, Wikidata y OpenAQ
    - Cada ficha con los 13 campos: `id, nombre, entidad, url, cobertura, vigencia, probado, estado, licencia, personas, proteccion, uso, nota`; licencia literal publicada o `no declara`; `probado` = fecha real en que respondió
    - Estados y errores exactos: F05 `caído` (página HTML SPA de 75 KB y S3 `403 AccessDenied`), UBA `caído` (HTTP 502), VBB `caído` (HTTP 503 el 2026-10-07), Wikidata `excluido` (consulta con 0 filas), OpenAQ `excluido` (no utilizada por la Aplicación), Grünanlagenbestand `candidato` (alternativa no integrada)
    - Regla `integrado` (1.10): cada ficha `integrado` cumple al menos una de dos condiciones, sin exigir ambas: (a) la descarga un Script_de_Ingesta (su id aparecerá en `fuentes` de un Tema; `uso` = Tema del lago) o (b) la Aplicación la consulta en tiempo de ejecución (`uso` empieza por `en vivo: <vista>`); `vigencia` estable (se copia a las cifras)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 6.6_

  - [x] 1.2 Ajustar configuración: `.gitignore`, `.dockerignore`, `tsconfig.json`, `vitest.config.ts` y `package.json`
    - `.gitignore`: añadir `/lago/raw/`
    - `.dockerignore`: añadir solo `lago/raw`; no excluir `lago/` ni `catalogo/`
    - `tsconfig.json`: alias `"@lago/*": ["./lago/*"]` y `"@catalogo/*": ["./catalogo/*"]` (Vitest los resuelve con `vite-tsconfig-paths`)
    - `vitest.config.ts`: añadir `esbuild: { jsx: "automatic" }` (el `tsconfig.json` de Next usa `"jsx": "preserve"`) para que las pruebas de render con `react-dom/server` puedan importar componentes `.tsx`; mantener `environment: "node"` e `include: ["src/**/*.test.ts"]` (las pruebas de render usan `createElement`, no JSX)
    - `package.json`: `fast-check` como devDependency con versión exacta (sin `^`), actualizar el lockfile
    - Comprobar `git check-ignore lago/raw/x`
    - _Requirements: 2.7, 2.8, 20.4, 20.5_

- [x] 2. Utilidades de ingesta y geometría (Python stdlib)
  - [x] 2.1 Implementar `ingesta/comun.py`
    - `USER_AGENT`, rutas `RAIZ/LAGO/RAW/CATALOGO`, `IngestaError`
    - `http_get`: toda respuesta no 2xx es error, sin excepción por código ni por fuente; 4xx (400, 403, 404, 429, …) → `IngestaError` inmediato sin reintento y sin intentar eludir el bloqueo; 5xx y errores de red (URLError, timeout, conexión reiniciada) → hasta `intentos` intentos con espera 2 s, 4 s, 8 s y después `IngestaError`; otro código no 2xx (p. ej. 3xx sin Location) → `IngestaError` inmediato; el mensaje incluye URL, código y los primeros 300 bytes del cuerpo; nunca devuelve un cuerpo de error como datos
    - `wfs_url` (WFS 2.0.0, `outputFormat=application/json`, `propertyName` sin geometría, `count`, `startIndex`, `srsName`, `resultType`), `paginas`, `wfs_total` (`resultType=hits` → `numberMatched`), `wfs_todas` (guarda cada página en `lago/raw/`; si el recuento difiere → `IngestaError("descargados X de Y")`)
    - `guardar_raw`, `ficha`, `fuente_de`, `redondear` (hab→0, %→1, km²→2, veh/h→1, °→5), `cifra`, `hoy` (admite `CEREBRO_FECHA`), `serializar` (`sort_keys`, `ensure_ascii=False`, `indent=2`, salto final), `escribir_tema` atómico (tmp + `os.replace`)
    - `main_seguro(fn)`: ante `IngestaError` imprime el error exacto en stderr y sale con `sys.exit(1)`; ante cualquier otra excepción imprime la traza y sale con 1; como `escribir_tema` solo se invoca al final de `fn()`, el Tema existente queda intacto
    - _Requirements: 1.11, 2.2, 2.3, 2.4, 3.2, 3.3, 3.4, 3.5, 3.8, 5.1, 5.7_

  - [ ]* 2.2 Escribir prueba de propiedad para `serializar` en `ingesta/test_comun.py`
    - **Property 18: Escritura JSON determinista**
    - **Validates: Requirements 3.5, 3.6**
    - `unittest` con 100 casos y `random.Random(semilla)` fija; comentario `Feature: official-district-data, Property 18: ...`

  - [ ]* 2.3 Escribir prueba de propiedad para `paginas` en `ingesta/test_comun.py`
    - **Property 20: Paginación WFS exacta**
    - **Validates: Requirements 5.1, 5.7**

  - [ ]* 2.4 Escribir pruebas unitarias de `http_get` e importaciones stdlib en `ingesta/test_comun.py`
    - `urllib.request.urlopen` parcheado con `HTTPError(403)` → `IngestaError` sin reintento y Tema existente intacto
    - Ejemplos fijos con `time.sleep` parcheado: 400, 404 y 429 → exactamente 1 intento; 500, 502 y 503 → exactamente 3 intentos; en todos, el mensaje contiene URL y código, y el `main` de un script bajo `main_seguro` termina con `SystemExit(1)` sin modificar los bytes del Tema existente
    - Todas las importaciones de `ingesta/*.py` y `verificacion/*.py` ∈ `sys.stdlib_module_names` o módulos locales
    - _Requirements: 3.2, 3.8, 8.10, 1.11_

  - [x] 2.5 Implementar `ingesta/geometria.py`
    - `area_anillo` (shoelace), `area_poligono`, `area_multipoligono`, `douglas_peucker` iterativo, `simplificar_anillo` (cierre y ≥ 4 vértices), `punto_en_poligono` (ray casting con huecos), `punto_interior` (parte de mayor área, recta horizontal en la latitud media con épsilon determinista, tramo interior más ancho), `redondear_coords`
    - _Requirements: 2.5, 4.2, 4.3, 4.4_

  - [ ]* 2.6 Escribir pruebas de propiedad de geometría en `ingesta/test_geometria.py`
    - **Property 19: Geometría planar**
    - **Validates: Requirements 4.2, 4.3, 4.4, 2.5**
    - Incluir polígonos cóncavos en estrella para `punto_interior`

  - [ ]* 2.7 Escribir prueba de propiedad de errores HTTP en `ingesta/test_comun.py`
    - **Property 25: Cualquier error HTTP en ingesta termina con error y no toca el Tema**
    - **Validates: Requirements 3.8, 1.11**
    - Código aleatorio en 400–599 y URL aleatoria de cualquier fuente con `urlopen` simulado y `time.sleep` parcheado: 1 intento si 4xx, `intentos` si 5xx; `main_seguro` → `SystemExit(1)` y bytes del Tema idénticos

- [ ] 3. Scripts de ingesta ejecutados contra las fuentes reales
  - [x] 3.1 Implementar y ejecutar `ingesta/pull_territorio.py`
    - Funciones puras `codigo_de` (`gem` `001`–`012` → `01`–`12`; fuera de rango → `IngestaError`), `construir_territorio`, `simplificar_hasta` (tolerancia inicial 0.00005°, se duplica hasta ≤ 200 KB con `separators=(",", ":")`; máximo 0.01°, si no alcanza → `IngestaError`)
    - Dos GetFeature de `alkis_bezirke:bezirksgrenzen`: con `srsName=EPSG:4326` (ALKIS lo admite) para geometría y por defecto EPSG:25833 para el área planar; guardar ambas en `lago/raw/`
    - Salida `lago/territorio.json`: `cifras` (`superficie_total`, `tolerancia_simplificacion`), `por_distrito` (`nombre` = `namgem`, `area_km2`, `punto`), `geometria` FeatureCollection MultiPolygon con `{codigo, nombre}`, features ordenadas por código, 5 decimales
    - `main()` envuelto en `main_seguro` (cualquier error HTTP → exit 1 sin tocar el Tema)
    - Ejecutar `python3 ingesta/pull_territorio.py` en el host contra el servicio real, revisar 12 distritos y Σ área ≈ 891,1 km², y confirmar `lago/territorio.json` en git
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 3.1, 3.3, 3.4, 3.5, 3.8, 4.1, 4.2, 4.3, 4.4_

  - [x] 3.2 Implementar y ejecutar `ingesta/pull_poblacion.py`
    - `GRUPOS_MENOR_18`, `GRUPOS_65_MAS`, `agregar_poblacion` (código = `ANTIGUO_A_ACTUAL[schluessel[:2]]`, distrito anterior a 2001 `01`–`23` → Código_de_Distrito actual; prefijo desconocido → `IngestaError`; bloque con algún grupo nulo suma a `poblacion` pero no a `pob_con_edad`), `porcentajes`
    - Descarga paginada sin geometría con `wfs_todas` (`propertyName=schluessel,ew2024,alter_*`, `count`, `startIndex`) y comprobación contra `numberMatched`
    - Salida `lago/poblacion.json`: `poblacion_total`, `bloques`, `bloques_sin_edad`; por distrito `poblacion`, `pct_menor_18`, `pct_65_mas`, `cobertura_edad`
    - `main()` envuelto en `main_seguro`
    - Ejecutar `python3 ingesta/pull_poblacion.py` contra el WFS real, comprobar total en 3,4–4,2 M y Σ distritos = total, y confirmar `lago/poblacion.json` en git
    - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.3, 3.4, 3.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 3.3 Implementar y ejecutar `ingesta/pull_suelo.py`
    - `NUTZ_VERDE = {100, 130, 150, 160, 172, 173}`, `normalizar_bez` (`1 | "1" | "01" | "001"` → `"01"`), `clasificar` (código no listado → `IngestaError("nutz no clasificado: <código> (<nutzung>)")`), `pct_verde`
    - Descarga paginada sin geometría (`propertyName=bez,flalle,nutz,nutzung`) y comprobación de recuento
    - Completar `CLASIFICACION` con TODOS los códigos `nutz` observados en la respuesta real (con su `nutzung`) y confirmar la unidad de `flalle` declarada por el servicio antes de convertir a km²
    - Salida `lago/verde.json`: `superficie_bloques_total`; por distrito `pct_verde`, `superficie_verde_km2`, `superficie_bloques_km2`; `clasificacion` `{ "<nutz>": {nutzung, verde} }`
    - `main()` envuelto en `main_seguro`
    - Ejecutar `python3 ingesta/pull_suelo.py` contra el WFS real y confirmar `lago/verde.json` en git
    - _Requirements: 2.1, 2.2, 3.1, 3.3, 3.4, 3.8, 6.1, 6.2, 6.3, 6.5_

  - [x] 3.4 Implementar y ejecutar `ingesta/pull_trafico.py`
    - `MES = "2025-06"`, `url_archivo`, `meses_disponibles` (solo informa por consola; no se escribe en el lago), `MIN_REGISTROS_POR_HORA = 3`, `registros_por_hora`, `medias_por_hora` (24 valores, descarta `NaN` y vacíos; hora con menos de 3 filas válidas del detector en el mes → `None`), `horas_descartadas`, `leer_archivo` (`tarfile` + `csv` con `delimiter=";"`, columnas "Stunde des Tages (Ortszeit)" y `qkfz`), `perfil_ciudad`, `unir_ubicaciones` por `teuID`
    - Descargar `teu_standorte.json` y `detektor_2025_06.tgz` del blob `mdhopendata` a `lago/raw/`; estructura o columnas inesperadas → `IngestaError`
    - Salida `lago/trafico.json`: `detectores_archivo`, `detectores_con_ubicacion`, `detectores_excluidos`, `min_registros_por_hora` (registros), `detector_horas_descartadas` (detector-horas); `series.perfil_ciudad` (24 valores veh/h) y `series.detectores` (`{id, punto, qkfz}` ordenados por `id`), vigencia `2025-06`
    - `main()` envuelto en `main_seguro`
    - Ejecutar `python3 ingesta/pull_trafico.py` contra las fuentes reales y confirmar `lago/trafico.json` en git
    - _Requirements: 2.1, 2.2, 3.1, 3.3, 3.4, 3.8, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 3.5 Escribir prueba de propiedad de agregación de población en `ingesta/test_agregados.py`
    - **Property 21: Agregación de población y edad**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6**

  - [ ]* 3.6 Escribir prueba de propiedad de superficie verde en `ingesta/test_agregados.py`
    - **Property 22: Superficie verde y clasificación**
    - **Validates: Requirements 6.2, 6.3, 6.5**

  - [ ]* 3.7 Escribir prueba de propiedad del perfil de tráfico en `ingesta/test_agregados.py`
    - **Property 23: Perfil de tráfico agregado**
    - **Validates: Requirements 7.2, 7.3, 7.4, 7.5, 7.6**

  - [ ]* 3.8 Escribir pruebas unitarias de territorio en `ingesta/test_agregados.py`
    - `codigo_de` con `001`–`012` y fuera de rango; `simplificar_hasta` determinista y ≤ 200 KB
    - _Requirements: 2.5, 2.6, 4.3_

  - [ ] 3.9 Crear `ingesta/reconstruir.sh`
    - `set -euo pipefail`; borra `lago/*.json`, ejecuta los 4 scripts y `verificacion/verificar.py`, muestra `git diff --stat -- lago/`; ejecutable (`chmod +x`)
    - Ejecutarlo dos veces el mismo día y comprobar `git diff --stat -- lago/` vacío
    - _Requirements: 3.6, 3.7, 3.9_

- [ ] 4. Verificador con puerta de publicación
  - [ ] 4.1 Implementar `verificacion/verificar.py`
    - `Resultado`, `comprobar_catalogo`, `comprobar_tema`, `recorrer_cifras`, `comprobar_personales`, `comprobar_dominio`, `verificar` (nunca lanza: JSON ilegible → FAIL), `codigo_salida(resultados)` (1 si hay algún FAIL, si no 0), `imprimir(resultados, salida)` (`PASS x` / `FAIL x: detalle`, sin detenerse en el primero)
    - `main(argv=None, salida=None)` con `--lago` y `--catalogo`: ejecuta todas las comprobaciones, calcula `codigo = codigo_salida(resultados)` ANTES de imprimir y lo devuelve pase lo que pase con la impresión; la impresión y el `flush` van en `try`; ante `BrokenPipeError`, `UnicodeEncodeError`, `OSError` u otra excepción, aviso breve en stderr si es posible (con el número de FAIL) y `_silenciar_stdout()` (`os.dup2` a `os.devnull`) para que el flush final del intérprete no cambie el código
    - Punto de entrada `if __name__ == "__main__": raise SystemExit(main())`
    - Reglas de cifra, tema, catálogo, datos personales (claves normalizadas, regex de email y teléfono, se omiten claves `url`) y dominio (12 códigos, población 3,4–4,2 M y Σ = total, área ±1 % de 891,1 km², rectángulo de Berlín en `coordinates` y `punto`, % en [0, 100], perfil de 24 valores ≥ 0, geometría ≤ 200 KB)
    - Regla `integrado` (1.10): `FAIL ⇔ estado == "integrado" ∧ ¬(a) ∧ ¬(b)`, con (a) id presente en `fuentes` de algún Tema del lago y (b) `uso` que empieza por `en vivo:`; cumplir ambas es PASS
    - Ejecutar `python3 verificacion/verificar.py` sobre el lago real: debe terminar con 0 FAIL
    - _Requirements: 1.2, 1.3, 1.4, 1.10, 2.1, 2.2, 2.3, 2.4, 2.5, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12, 8.13, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [ ] 4.2 Escribir la prueba de lago roto en `verificacion/test_verificar.py`
    - Copia `lago/` y `catalogo/` a `tempfile.TemporaryDirectory()`, ejecuta el Verificador con `subprocess.run([sys.executable, "verificacion/verificar.py", "--lago", ..., "--catalogo", ...])` → código 0
    - Elimina `unidad` de una Cifra de `poblacion.json` → código ≠ 0 y salida con "FAIL"
    - Casos adicionales: quitar un distrito, población fuera de rango, Σ distritos ≠ total, perfil de 23 valores
    - Ejecutar con `python3 -m unittest discover -s verificacion -p "test_*.py"`
    - _Requirements: 8.9, 9.1, 9.2, 9.3, 9.7, 9.8_

  - [ ]* 4.3 Escribir pruebas de ejemplo del catálogo en `verificacion/test_verificar.py`
    - Los 17 ids de 1.1; F05, UBA y VBB `caído` con nota; Wikidata y OpenAQ `excluido`; Grünanlagenbestand `candidato`
    - _Requirements: 1.1, 1.7, 1.8, 6.6_

  - [ ]* 4.4 Escribir prueba de propiedad de mutación en `verificacion/test_verificar.py`
    - **Property 14: El Verificador rechaza cualquier campo obligatorio eliminado**
    - **Validates: Requirements 1.2, 2.1, 2.2, 2.3, 8.2, 8.3, 8.5, 8.8, 8.9**

  - [ ]* 4.5 Escribir prueba de propiedad de enumeraciones y fechas en `verificacion/test_verificar.py`
    - **Property 15: El Verificador valida enumeraciones y fechas**
    - **Validates: Requirements 1.3, 1.4, 8.4, 8.8**

  - [ ]* 4.6 Escribir prueba de propiedad de datos personales en `verificacion/test_verificar.py`
    - **Property 16: El Verificador detecta datos personales**
    - **Validates: Requirements 8.6, 8.7**

  - [ ]* 4.7 Escribir prueba de propiedad de dominio en `verificacion/test_verificar.py`
    - **Property 17: Comprobaciones de dominio sobre coordenadas y porcentajes**
    - **Validates: Requirements 9.5, 9.6**

  - [ ]* 4.8 Escribir pruebas de ejemplo del código de salida en `verificacion/test_verificar.py`
    - `main(argv, salida=FlujoRoto())` con `FlujoRoto.write` que lanza `BrokenPipeError`, sobre un lago con una Cifra sin `unidad` → devuelve 1
    - `subprocess.run([...verificar.py, "--lago", tmp_roto, ...], env={**os.environ, "PYTHONIOENCODING": "ascii:strict"})` con un detalle de FAIL que contiene "Neukölln" → `returncode != 0`
    - `subprocess.Popen(..., stdout=PIPE)` cerrando la tubería antes de leer, con lago roto → `returncode == 1` (ni 120 ni 0)
    - Flujo roto con lago válido → 0
    - _Requirements: 8.9, 8.11, 8.12, 8.13_

  - [ ]* 4.9 Escribir prueba de propiedad del código de salida en `verificacion/test_verificar.py`
    - **Property 24: Código de salida del Verificador independiente de la impresión**
    - **Validates: Requirements 8.9, 8.11, 8.12, 8.13**
    - Listas de `Resultado` con `ok` aleatorio y flujos que fallan tras k escrituras (k aleatorio, incluido 0) con `BrokenPipeError`, `UnicodeEncodeError` u `OSError`

  - [ ]* 4.10 Escribir prueba de propiedad de la regla `integrado` en `verificacion/test_verificar.py`
    - **Property 29: Regla `integrado` del Verificador (una de dos condiciones)**
    - **Validates: Requirements 1.10**
    - Cubrir las cuatro combinaciones de (a) id en `fuentes` de un Tema y (b) `uso` con prefijo `en vivo:`

- [ ] 5. Checkpoint - Ingesta y verificación en el host
  - Ejecutar en el host `python3 -m unittest discover -s ingesta -p "test_*.py"`, `python3 -m unittest discover -s verificacion -p "test_*.py"` y `python3 verificacion/verificar.py` (0 FAIL sobre el lago real; la prueba de lago roto debe detectar el fallo). Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Núcleo TypeScript: tipos, EAQI, hora de Berlín y elevación del terreno
  - [x] 6.1 Actualizar `src/lib/types.ts`
    - `Origin`, `DistrictCode`, `District` (sin `medianAge`, `aqi`, `greenSpacePct`, `centroid`; con `pctUnder18`, `pct65Plus`, `ageCoveragePct`, `greenPct`, `point`), `DistrictFeature` con `Polygon | MultiPolygon`, `AirQualityPoint` con contaminantes nulos, `districtCode` y `origin: "live" | "mock"` por valor, `AirStation` (posición siempre finita, `origin` por valor), `TrafficDetector`, `HourlyPoint`, `TimeSeriesPoint` (sin `mobilityIndex`, `bikeUsage`, `energyDemand`), `Kpi` (sin `delta`/`trend`, con `origin`, `provenance`, `eaqi?` y `available?`), `SourceState`, `BlockId`, `SourceBlock<T>`, `CityDataset` ampliado, `LayerId` y `LayerCategory` con `example`
    - Tipos de mapa: `MapTargetKind`, `MapTarget`, `PinnedTarget` (`anchor`, `returnFocusTo`), `TooltipRow` (`eaqi?`, `origin?`, `example?`), `TooltipContent`; eliminar `HoverInfo`
    - _Requirements: 4.5, 5.8, 7.10, 10.11, 10.12, 11.6, 11.7, 11.12, 12.7, 13.3, 14.9_

  - [x] 6.2 Implementar `src/lib/eaqi.ts`
    - `EAQI_THRESHOLDS`, `subIndex` (extrapola con el último tramo), `eaqiRaw` (máximo de los disponibles, `null` si ninguno finito), `eaqi` (redondeo entero), `EAQI_BANDS` con paleta EEA y `eaqiBand` (sobre el entero mostrado)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 6.3 Escribir pruebas de ejemplo del EAQI en `src/lib/eaqi.test.ts`
    - PM2.5 19,5 + O3 104 → 44 (obligatoria)
    - Límites de banda 19/20, 39/40, 59/60, 79/80, 100/101; objeto vacío y todos `null` → `null`
    - _Requirements: 10.4, 10.5, 10.6, 20.4_

  - [ ]* 6.4 Escribir prueba de propiedad del subíndice en `src/lib/eaqi.test.ts`
    - **Property 1: Subíndice EAQI continuo y monótono**
    - **Validates: Requirements 10.1, 10.2**
    - fast-check con `numRuns: 100`; comentario `Feature: official-district-data, Property 1: ...`

  - [ ]* 6.5 Escribir prueba de propiedad del máximo en `src/lib/eaqi.test.ts`
    - **Property 2: EAQI es el máximo de los subíndices disponibles**
    - **Validates: Requirements 10.3, 10.6**

  - [x] 6.6 Actualizar `src/lib/format.ts`
    - `aqiTone(v: number | null)` delega en `eaqiBand` (su `.label` solo lo renderiza `EaqiBandLabel`); añadir `formatNullable` ("sin dato"/"sin datos", con comprobación `!= null` / `Number.isFinite`, de modo que 0 se formatea como "0"); eliminar los cortes US EPA; conservar `abbreviate` y `formatHour`
    - _Requirements: 10.7, 10.8, 10.15, 11.6, 14.8_

  - [ ]* 6.7 Escribir prueba de propiedad de bandas en `src/lib/eaqi.test.ts`
    - **Property 3: Bandas EAQI totales, ordenadas y únicas en la aplicación**
    - **Validates: Requirements 10.5, 10.7**

  - [x] 6.8 Implementar `src/lib/time.ts`
    - `berlinHour(date?)` con `Intl.DateTimeFormat` en `Europe/Berlin` (`hourCycle: "h23"`, respaldo `getUTCHours()`), `BERLIN_TZ_LABEL = "hora de Berlín"`
    - _Requirements: 16.1, 16.2, 16.3_

  - [ ]* 6.9 Escribir prueba de propiedad de la hora de Berlín en `src/lib/time.test.ts`
    - **Property 10: Hora de Berlín independiente de la zona del navegador**
    - **Validates: Requirements 16.1, 16.3**
    - Cambiar `process.env.TZ` entre "America/Bogota", "Etc/GMT+5", "Europe/Berlin" y "Asia/Tokyo"; incluir el ejemplo UTC−5

  - [x] 6.10 Implementar `src/lib/terrain.ts` (sin dependencias de React)
    - Antes de implementar, volver a comprobar dentro del contenedor la semántica de MapLibre 4.7 contra `node_modules` instalado (`docker compose --profile dev run --rm web-dev node -p "require('maplibre-gl/package.json').version"` y lectura de `queryTerrainElevation` y `getCameraTargetElevation` en `node_modules/maplibre-gl`): `queryTerrainElevation` devuelve `null` sin terreno y, con terreno, la diferencia respecto a `transform.elevation` (ya exagerada); si la versión instalada difiere, ajustar `absoluteElevation` y anotar la diferencia en `design.md`
    - `ElevationSampler`; `absoluteElevation(offset, cameraTarget)` = `queryTerrainElevation(p) + getCameraTargetElevation()`, `null` si `offset` es `null`, no finito o el resultado es ≤ 0 (tesela DEM vacía → no disponible)
    - `withElevation([lng, lat], sampler)` → `[lng, lat, sampler(lng, lat) ?? 0]` (respaldo 0 m); `elevateGeometry` aplica `withElevation` a todo vértice de Polygon/MultiPolygon
    - `createMapElevationSampler(map)` → `{ sample, refresh, clear }`: caché por coordenada redondeada a 5 decimales que solo guarda valores disponibles; `map.getTerrain() == null` → `null`; excepción de `queryTerrainElevation` → `null` sin cachear; `refresh(points)` devuelve `true` si algún valor cambia > 0,5 m o pasa de `null` a número
    - _Requirements: 4.8, 20.7, 20.8, 20.9_

  - [ ]* 6.11 Escribir prueba de propiedad de elevación en `src/lib/terrain.test.ts`
    - **Property 11: Elevación por punto según el sampler y detectores según la hora**
    - **Validates: Requirements 4.8, 20.7, 20.8, 20.9**
    - Parte del terreno: `absoluteElevation`, `withElevation`, `elevateGeometry` con samplers generados (`fc.func(fc.option(fc.double({ min: 1, max: 500 })))`); `createMapElevationSampler` con un mapa simulado `{ getTerrain, queryTerrainElevation, getCameraTargetElevation }` cuyas cotas pasan de 0/`null` a valores → `refresh` devuelve `true` y `sample` la nueva cota

  - [x] 6.12 Exportar `TERRAIN_SOURCE_ID` en `src/lib/mapStyle.ts`
    - Exportar la constante (hoy local) para que el sampler filtre eventos `sourcedata`; mantener `TERRAIN_EXAGGERATION`; la eliminación de `DATA_ELEVATION_M` se hace en 10.2 junto con su único consumidor
    - _Requirements: 20.9_

  - [ ] 6.13 Implementar `src/hooks/useTerrainElevation.ts`
    - `useTerrainElevation(mapRef, points)` crea el sampler con `createMapElevationSampler` y expone `{ sampler, elevationVersion }`
    - Suscripción a `load`, `idle`, `terrain` (llama antes a `clear()`) y `sourcedata` filtrado por `e.sourceId === TERRAIN_SOURCE_ID && e.isSourceLoaded`; en cada evento `refresh(points)` y, si devuelve `true`, incrementa `elevationVersion` agrupado con `requestAnimationFrame`; desuscripción y cancelación del frame al desmontar; sin terreno todo queda a 0 m
    - _Requirements: 4.8, 20.7, 20.8, 20.9_

- [ ] 7. Lago en la Aplicación y procedencia
  - [ ] 7.1 Crear `src/data/lake.ts`
    - Importar `@lago/territorio.json`, `@lago/poblacion.json`, `@lago/verde.json`, `@lago/trafico.json`; tipos del Contrato_del_Lago (`TerritorioTema`, `PoblacionTema`, `VerdeTema`, `TraficoTema`); exportar `trafficProfile`, `trafficDetectors` (`TrafficDetector[]`), `lakeProbado`
    - _Requirements: 2.1, 2.6, 7.4, 20.3_

  - [ ] 7.2 Reescribir `src/data/districts.ts` con `buildDistricts`
    - `buildDistricts(territorio, poblacion, verde)` ordenado por código, `density = Math.round(population / areaKm2)`, error si falta un distrito; exportar `BERLIN_DISTRICTS` y `DISTRICT_LIST`
    - Eliminar `halfW`/`halfH`, rectángulos, `medianAge`, AQI y % verde escritos a mano
    - _Requirements: 4.5, 4.6, 4.7, 5.8, 5.9, 11.7_

  - [ ]* 7.3 Escribir pruebas de distritos en `src/data/districts.test.ts`
    - **Property 4: Distritos construidos desde el lago**
    - **Validates: Requirements 4.6, 4.7, 5.9, 2.6**
    - Ejemplos con el lago real: 12 códigos `01`–`12`, Σ población = `poblacion_total`, área total a ±1 % de 891,1 km²

  - [ ] 7.4 Crear `src/lib/catalog.ts` y `src/lib/metrics.ts`
    - `catalog.ts`: importa `@catalogo/fuentes.json`, tipa `SourceCard` (con `estado: SourceState`), exporta `CATALOG` y `catalogById`
    - `metrics.ts`: `MetricId`, `MetricDef`, `METRICS` (label, unit, definition, sourceId); vigencias leídas del lago, sin literales en las vistas; definición de `greenPct` con las categorías `nutz` y el denominador "superficie de bloques sin calles"
    - _Requirements: 6.4, 17.4, 17.5_

  - [ ] 7.5 Crear `src/lib/provenance.ts`
    - `ProvenanceRef`, `ProvenanceCard`, `resolveProvenance` (`null` si el id no existe), `originLabel` (snapshot del lago · en vivo · simulado · datos de ejemplo (sin fuente)), `attributionsFor` por licencia (dl-de-by-2.0 → SenMVKU; CC BY 3.0 DE → Amt für Statistik Berlin-Brandenburg; Open-Meteo, CC BY 4.0; © OpenStreetMap contributors · OpenFreeMap; dl-de-zero-2.0 → "dl-de-zero-2.0 (sin atribución obligatoria)")
    - `originBadge(origin)` → `{ text, simulated }`, con `simulated === true` y texto "⚠ simulado" solo para `mock`
    - `footerSources(catalog)` → `{ integrated, notIntegrated }`: recorre TODO el catálogo ordenado por id; fichas `integrado` → `integrated` con `attributionsFor([id])[0]` no vacía; `candidato`, `caído`, `excluido`, `declarado` → `notIntegrated` con su estado; listas disjuntas cuya unión es el catálogo (OpenAQ solo como `excluido`)
    - _Requirements: 11.12, 17.1, 17.3, 18.1, 18.2, 18.3, 18.4, 18.6, 18.7, 18.8_

  - [ ]* 7.6 Escribir prueba de propiedad de procedencia en `src/lib/provenance.test.ts`
    - **Property 12: Procedencia resuelta contra el catálogo**
    - **Validates: Requirements 17.1, 17.5**

  - [ ]* 7.7 Escribir prueba de propiedad de atribuciones y pie en `src/lib/provenance.test.ts`
    - **Property 13: Atribuciones y pie de fuentes**
    - **Validates: Requirements 18.1, 18.2, 18.4, 18.6, 18.7, 18.8**
    - `attributionsFor` con subconjuntos de fuentes integradas y `footerSources` con catálogos generados de estados arbitrarios; ejemplo con el catálogo real: OpenAQ en `notIntegrated` con `excluido`, F05/UBA/VBB `caído`, Grünanlagenbestand `candidato`

  - [ ] 7.8 Crear `src/lib/gaps.ts`
    - `buildGaps(catalog, districts)`: edad mediana, demanda energética, uso horario de bicis, puntos críticos e infraestructura con motivo; cobertura parcial de edad (desde `ageCoveragePct`); VBB transport.rest y Einwohner LOR CSV no disponibles (nota del catálogo)
    - _Requirements: 19.1, 19.2, 19.3_

  - [ ]* 7.9 Escribir pruebas unitarias de `buildGaps` en `src/lib/gaps.test.ts`
    - Presencia de cada hueco y de las fuentes `caído`
    - _Requirements: 19.1, 19.2_

- [ ] 8. Mock y servicios en vivo
  - [ ] 8.1 Reescribir `src/data/mock.ts`
    - Mock posicionado en `point` del lago; `MOCK_AIR` y `MOCK_AIR_STATIONS` con `aqi = eaqi(...)` y `origin: "mock"` en cada elemento; `MOCK_HOURLY`
    - Eliminar `buildTimeSeries` sintético y toda serie fabricada (movilidad, AQI, bicis, energía, temperatura); no derivar mock de AQI/% verde de `districts.ts`
    - _Requirements: 7.10, 10.7, 11.5, 11.7, 11.9, 12.5, 13.3, 13.4_

  - [ ] 8.2 Reescribir `src/lib/services/airQuality.ts`
    - `buildAirQualityUrl(lat, lon)` con `current=european_aqi,pm2_5,pm10,nitrogen_dioxide,ozone`; una petición por distrito en `point` con `safeFetchJson` y `Promise.all`; asociar por `districtCode`; ausentes → `null`; `aqi = european_aqi ?? eaqi(...)`; distrito fallido → todo `null` con `origin: "live"` (no simulado); 12 fallidos → `MOCK_AIR` con origen de bloque `mock` y `origin: "mock"` en cada punto
    - Eliminar `pm25ToAqi`
    - _Requirements: 10.8, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.12, 20.1, 20.2_

  - [ ]* 8.3 Escribir prueba de propiedad de aire por distrito en `src/lib/services/airQuality.test.ts`
    - **Property 5: Calidad del aire por distrito asociada por código**
    - **Validates: Requirements 11.1, 11.2, 11.4, 11.6**
    - `vi.mock("@/lib/http")` con `mockImplementation` por URL

  - [ ] 8.4 Implementar `src/lib/services/luftguete.ts` con fixture real
    - Añadir `CONFIG.luftgueteApiBase` en `src/lib/config.ts` (por defecto `https://luftdaten.berlin.de`)
    - Capturar respuestas reales de `/api/stations` y `/api/components/pm2_1h/data?stationgroup=all&timespan=currentday` en `src/lib/services/__fixtures__/` (recortadas) y fijar contra ellas los nombres exactos de campos
    - `LUFTGUETE_COMPONENTS`, `parseStations` (`active === true`; coordenadas con `Number(texto.trim())`, sin `parseFloat`; si cualquiera de las dos no es finita — `""`, `"abc"`, `"NaN"`, `"Infinity"`, `"52.5abc"`, `null` — la estación se descarta y no llega a `data.airStations`), `latestByStation` (tolerante), `mergeStations` (EAQI con los disponibles, `origin: "live"`), `fetchAirStations` (sin estaciones o caída → `MOCK_AIR_STATIONS`, `mock`; componente caído → `null`)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 20.1, 20.2_

  - [ ]* 8.5 Escribir prueba de propiedad de estaciones en `src/lib/services/luftguete.test.ts`
    - **Property 6: Estaciones Luftgüte filtradas, numéricas y con último valor**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.6, 12.7**
    - Coordenadas generadas mezclando texto numérico válido y no convertible (`""`, `"abc"`, `"NaN"`, `"Infinity"`, `"52.5abc"`, `null`)

  - [ ]* 8.6 Escribir pruebas unitarias de Luftgüte con el fixture en `src/lib/services/luftguete.test.ts`
    - Parseo del fixture real, componente caído → contaminante `null`, Luftgüte caído → mock `mock`
    - _Requirements: 12.2, 12.4, 12.5_

  - [ ] 8.7 Implementar `src/lib/services/hourly.ts`
    - `buildHourlyUrls(points)` incluye siempre `hourly=european_aqi` (aire), `hourly=temperature_2m` (meteorología), `timezone=Europe/Berlin` y `forecast_days=1` con los 12 puntos en una sola petición por API; `fetchHourly` solo construye URLs con esa función (precondición de la petición)
    - `parseHourly` acepta arreglo u objeto único y toma la hora de los caracteres 11–13 de `time`; media de los puntos con dato; ambas caídas → `MOCK_HOURLY` (`mock`), una caída → serie `null`
    - Verificar la petición multipunto contra la API real de Open-Meteo (forma de la respuesta) y ajustar el parser
    - _Requirements: 13.1, 13.4, 20.1, 20.2_

  - [ ]* 8.8 Escribir pruebas unitarias de `hourly` en `src/lib/services/hourly.test.ts`
    - Precondición 13.1: `buildHourlyUrls` produce una URL de aire con `hourly=european_aqi` y una de meteorología con `hourly=temperature_2m`, ambas con `timezone=Europe/Berlin` y `forecast_days=1`; `fetchHourly` llama a `safeFetchJson` exactamente con esas URLs (aserción sobre los argumentos del mock)
    - `parseHourly` con arreglo y con objeto único; fallo total → mock
    - _Requirements: 13.1, 13.4_

  - [ ] 8.9 Implementar `src/lib/services/timeSeries.ts`
    - `buildTimeSeries(profile, hourly)` pura: `traffic = profile[h]`, `trafficIndex = round(profile[h] / max × 100)`, `aqi`/`temperature` del horario o `null`
    - _Requirements: 7.4, 13.2, 13.3_

  - [ ]* 8.10 Escribir prueba de propiedad de la serie 24 h en `src/lib/services/timeSeries.test.ts`
    - **Property 7: Serie de 24 horas a partir del perfil del lago**
    - **Validates: Requirements 13.2, 7.4**

  - [ ] 8.11 Actualizar `src/lib/services/openData.ts` y `src/lib/services/weather.ts`
    - `fetchDistricts` → `{ data, origin: "snapshot", vigencia, probado }` desde el lago
    - `weather.ts` consulta en el `point` del lago
    - _Requirements: 11.8, 20.3_

- [ ] 9. Composición de datos y analítica
  - [ ] 9.1 Actualizar `src/lib/services/cityData.ts`
    - `fetchCityData()` en paralelo: distritos, aire, estaciones, horario, clima, bicis, transporte; `timeSeries = buildTimeSeries(trafficProfile, hourly)`; `trafficDetectors` del lago; `source` por bloque (districts/traffic `snapshot`, hotspots/infrastructure `example`), `fetchedAt`, `lake.probado`; `origin` por punto de aire y estación conservado; ajustar `src/hooks/useCityData.ts` si cambia la forma
    - _Requirements: 7.4, 11.12, 15.3, 20.2, 20.3_

  - [ ] 9.2 Crear `src/lib/analytics.ts` y envolverlo en `src/hooks/useAnalytics.ts`
    - `buildAnalytics(data, hour)` pura con exactamente 5 KPIs: población (Σ lago, vigencia del lago), tráfico (`profile[hour]`, "perfil típico de junio de 2025", vigencia `2025-06`), EAQI medio, bicis (Σ `bikesAvailable`, momento de consulta), temperatura media (nota de viento)
    - KPI EAQI: `available` = nº de distritos con `aqi != null` (nunca filtro por veracidad: 0 es un EAQI válido); si `available ≥ 1`, `value` = media redondeada mostrada como número (incluido "0"); solo con `available = 0` `value` = "sin datos"; nota "`available` de 12 distritos con datos · modelo CAMS" en todos los casos; `eaqi: true` solo en este KPI
    - `districtAqiBars(data)` pura: 12 barras `{ code, name, aqi, band, origin, eaqi: true }` ordenadas por código, con `origin` del punto de aire de su `districtCode`
    - Sin "Demanda energética", "Puntos críticos", "+0.9%", tendencias ni "en tiempo real" en orígenes distintos de `live`; hotspots e infraestructura excluidos
    - _Requirements: 7.9, 7.10, 10.13, 10.14, 11.11, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 15.3, 17.4_

  - [ ]* 9.3 Escribir prueba de propiedad de KPIs en `src/lib/analytics.test.ts`
    - **Property 8: Cada KPI es el agregado de su fuente**
    - **Validates: Requirements 14.1, 14.2, 14.4, 14.5, 14.8, 14.9, 7.8**
    - Generadores que incluyen `aqi` 0 y bajos; ejemplos: los 5 ids previstos y la nota de tráfico

  - [ ]* 9.4 Escribir prueba de propiedad de cifras no fabricadas en `src/lib/analytics.test.ts`
    - **Property 9: Sin cifras fabricadas en los KPIs**
    - **Validates: Requirements 14.6, 14.7, 15.3, 17.3**

  - [ ]* 9.5 Escribir pruebas de ejemplo del KPI EAQI con valores 0 en `src/lib/analytics.test.ts`
    - 12 distritos con `aqi: 0` → valor "0", banda "Buena" y nota "12 de 12 distritos con datos"
    - 1 distrito con `aqi: 0` y 11 `null` → valor "0" y nota "1 de 12 distritos con datos"; 12 `null` → "sin datos" y "0 de 12 distritos con datos"
    - _Requirements: 14.5, 14.8, 14.9_

- [ ] 10. Vistas con procedencia
  - [ ] 10.1 Actualizar `src/lib/layers.ts`
    - Nuevas capas `traffic` y `airStations`; hotspots e infraestructura con `example: true` y `defaultVisible: false` como constantes del tipo de capa (la etiqueta "datos de ejemplo (sin fuente)" se deriva de `LAYER_CATALOG[id].example`, no del dato)
    - _Requirements: 15.1, 15.2, 19.4_

  - [ ] 10.2 Actualizar `src/components/map/buildDeckLayers.ts` y retirar la altitud fija de `src/lib/mapStyle.ts`
    - Parámetros `hour`, `sampler` y `elevationVersion` en lugar de `activity`; eliminar `onTerrain()` y la importación de `DATA_ELEVATION_M`; eliminar `DATA_ELEVATION_M` y `BERLIN_MEAN_ELEVATION_M` de `mapStyle.ts` (se mantienen `TERRAIN_EXAGGERATION` y `TERRAIN_SOURCE_ID`)
    - Toda capa de puntos (aire, estaciones, detectores, transporte, bicis, clima, ejemplo): `getPosition: (d) => withElevation(d.position, sampler)` con `updateTriggers.getPosition = elevationVersion`
    - Distritos: `GeoJsonLayer` con Polygon y MultiPolygon cuyos vértices se elevan con `elevateGeometry` y el mismo sampler (respaldo 0 m)
    - `air`: sustituir `HeatmapLayer` por `ScatterplotLayer` en cada Punto_de_Distrito coloreado con `eaqiBand(aqi).color` (gris si `null`)
    - Detectores: `ScatterplotLayer`, radio ∝ √qkfz[hour], gris y radio mínimo si `null`, `updateTriggers` `{ getRadius: hour, getFillColor: hour, getPosition: elevationVersion }`; estaciones: color por banda EAQI a partir de `data.airStations` (ya sin coordenadas no finitas); capas de ejemplo con radio por severidad sin modulación horaria
    - Hover y clic emiten `MapTarget` (`{ kind, id }`) en lugar de `HoverInfo` con texto; el contenido lo calcula `tooltipFor`
    - _Requirements: 4.5, 4.8, 7.8, 11.4, 12.3, 12.7, 15.1, 20.7, 20.8, 20.9_

  - [ ]* 10.3 Escribir prueba de propiedad de capas en `src/components/map/buildDeckLayers.test.ts`
    - **Property 11: Elevación por punto según el sampler y detectores según la hora**
    - **Validates: Requirements 4.8, 7.8, 20.7, 20.8, 20.9**
    - Parte de capas: invocar `getPosition`/`getRadius` y leer `updateTriggers` de cada capa con un sampler generado; todo vértice de distrito con `z === sampler(lng, lat) ?? 0`; radio de detector monótono en `qkfz[h]`

  - [ ] 10.4 Ampliar `src/store/useCityStore.ts`
    - Procedencia: `provenance: ProvenanceRef | null`, `openProvenance`, `closeProvenance`
    - Panel_EAQI: `eaqiPanel: { open, returnFocusTo }`, `openEaqiPanel(trigger)`, `closeEaqiPanel()` (devuelve el foco a `returnFocusTo`)
    - Tooltip fijado: `pinned: PinnedTarget | null`, `pin`, `unpin`
    - `initialVisibility` fuerza `false` para toda capa con `example: true` aunque `defaultVisible` diga otra cosa; solo `toggleLayer(id)`/`setLayer(id, true)` cambian esas claves y ninguna otra acción (carga, hora, reproducción, selección, fijado, 2D/3D) las toca
    - Exportar una fábrica `createCityStore()` y `useCityStore = createCityStore()` para poder probar con un store nuevo
    - _Requirements: 10.9, 10.11, 10.12, 10.16, 15.2, 17.1, 17.6, 19.4, 19.5_

  - [ ] 10.5 Crear los componentes de procedencia y EAQI y montarlos en `src/components/layout/AppShell.tsx`
    - `src/components/provenance/ProvenanceButton.tsx`: botón nativo con `aria-label="Procedencia de …"` que llama a `openProvenance(ref)`
    - `src/components/provenance/ProvenancePanel.tsx`: `role="dialog"`, `aria-modal`, `aria-labelledby`, foco al botón de cierre al abrir, `Escape` devuelve el foco al disparador; enlace con `rel="noopener noreferrer"`; métrica, definición, fuente, licencia, vigencia, Fecha_Probado o momento de consulta y origen con `OriginBadge`; para `aqiModel`/`aqiStation` no repite la definición: incluye un `EaqiInfoButton`
    - `src/components/provenance/OriginBadge.tsx`: usa `originBadge(origin)`; `mock` → "⚠ simulado" con fondo ámbar rayado y borde; resto con `originLabel` neutro; con `compact` solo se renderiza si `simulated`; siempre con texto, no solo color
    - `src/components/eaqi/EaqiLegend.tsx` (umbrales de `EAQI_THRESHOLDS`, fórmula del subíndice y las seis `EAQI_BANDS`), usado solo por `EaqiPanel.tsx`
    - `src/components/eaqi/EaqiPanel.tsx`: Panel_EAQI único, `role="dialog"`, `aria-modal="true"`, `aria-labelledby` al título "Índice europeo de calidad del aire (EAQI)", foco al botón de cierre, `Escape`/cerrar devuelven el foco a `returnFocusTo`; se apila sobre otros diálogos (z-index mayor) y `Escape` cierra solo el superior
    - `src/components/eaqi/EaqiInfoButton.tsx`: `<button type="button" aria-label="Definición del índice europeo de calidad del aire" aria-haspopup="dialog">ⓘ</button>` que llama a `openEaqiPanel(e.currentTarget)`, con `focus-visible:ring`; `variant="hint"` como `<span aria-hidden="true">` solo para el tooltip flotante
    - `src/components/eaqi/EaqiBandLabel.tsx`: único componente que muestra `aqiTone(v).label`, seguido de un `EaqiInfoButton`
    - `AppShell.tsx` monta una sola instancia de `EaqiPanel` y de `ProvenancePanel`
    - _Requirements: 10.9, 10.15, 10.16, 10.17, 11.12, 17.1, 17.3, 17.6_

  - [ ] 10.6 Actualizar `src/components/map/MapContainer.tsx` y `MapTooltip.tsx`
    - `MapContainer`: `useTerrainElevation(mapRef, puntos de las capas visibles y vértices de distritos)`; capas memoizadas por datos, hora, visibilidad y `elevationVersion`; pasa `hour`, `sampler` y `elevationVersion` a `buildDeckLayers`; eliminar la "actividad" gaussiana sintética; hover → `MapTarget`; clic → `pin({ kind, id, anchor })` y, en distritos, abre también el Popup_de_Distrito (sin solaparse); suprime el hover del objeto fijado; atribución © OpenStreetMap contributors · OpenFreeMap visible en el mapa
    - `MapTooltip`: ambos modos renderizan el mismo `tooltipFor(target, data, hour)`; `mode="hover"` no interactivo (`pointer-events-none`) con `EaqiInfoButton variant="hint"` junto a cada fila EAQI, `OriginBadge` compacto, etiqueta de ejemplo y pista "Clic para fijar"; `mode="pinned"` como tarjeta `role="dialog"` no modal con `aria-labelledby`, botón "Cerrar" y `EaqiInfoButton` real junto a cada EAQI; foco al título (`tabIndex={-1}`); `Escape`/"Cerrar" desfijan y devuelven el foco al disparador o al canvas; se reancla con `map.project(punto)` en `move` y se limita al viewport; si `tooltipFor` devuelve `null` se desfija
    - _Requirements: 4.8, 7.8, 10.11, 10.12, 10.16, 10.17, 11.4, 11.10, 15.1, 17.6, 18.3, 20.7, 20.8, 20.9_

  - [ ] 10.7 Actualizar `src/components/map/DistrictPopup.tsx`
    - Población, densidad, superficie, % < 18, % 65+ con cobertura de edad, % verde con definición corta, AQI "modelo CAMS (Open-Meteo)" por `districtCode` o "sin datos" (comprobación `!= null`); cada métrica con valor, vigencia, `OriginBadge` y `ProvenanceButton`; sin edad mediana
    - Junto al valor EAQI, `EaqiInfoButton` y la banda con `EaqiBandLabel`; si el punto de aire es `mock`, `OriginBadge` "⚠ simulado" junto al valor
    - _Requirements: 5.8, 5.9, 6.4, 10.10, 10.15, 11.3, 11.4, 11.9, 17.1, 17.2, 17.3, 17.4_

  - [ ] 10.8 Actualizar `src/components/panels/KpiCards.tsx` y `AnalyticsPanel.tsx`
    - KPIs desde `buildAnalytics` con vigencia, `OriginBadge` y `ProvenanceButton`; KPI EAQI con `EaqiInfoButton` junto al valor y banda con `EaqiBandLabel`; valores opcionales con `!= null`/`Number.isFinite` (prohibido `v ? … : "sin datos"`), de modo que 0 se muestra
    - Gráfico 24 h: `trafficIndex` (área), `aqi` horario y `temperature` (eje secundario), leyenda con `OriginBadge` y vigencia por serie, `ReferenceLine` en la hora
    - "AQI por distrito (EAQI)" desde `districtAqiBars`: título con `EaqiInfoButton`; barras con `eaqiBand(v).color` y "sin datos" para nulos; barras `mock` con relleno rayado (`<pattern id="eaqi-hatch-<banda>">`), marcador "sim." (`LabelList`), fila "⚠ simulado" en su tooltip, `OriginBadge` "simulado" junto al título y texto `sr-only` "Valores simulados"; barras `live` sólidas y sin marca
    - Reparto modal con `OriginBadge` del transporte; atribuciones de las fuentes usadas
    - _Requirements: 7.9, 10.7, 10.13, 10.14, 10.15, 11.4, 11.11, 11.12, 13.2, 14.1, 14.2, 14.3, 14.4, 14.5, 14.8, 14.9, 17.2, 17.3, 18.1, 18.2, 18.4_

  - [ ] 10.9 Actualizar `src/components/panels/TimelineControl.tsx` y `src/hooks/useTimelinePlayer.ts`
    - Hora inicial `berlinHour()` aplicada tras el montaje; etiqueta `{formatHour(h)} · hora de Berlín`
    - _Requirements: 16.1, 16.2, 16.3_

  - [ ] 10.10 Actualizar `src/components/panels/LayerController.tsx`
    - Etiqueta "datos de ejemplo (sin fuente)" derivada de `LAYER_CATALOG[id].example`; nuevas capas de detectores y estaciones; las capas de ejemplo solo se activan desde el evento del usuario (`toggleLayer`/`setLayer`) y un eventual "mostrar todas" las excluye
    - _Requirements: 15.1, 15.2, 19.4, 19.5_

  - [ ] 10.11 Crear `src/components/panels/GapsList.tsx`
    - Renderiza `buildGaps` con métrica y motivo
    - _Requirements: 19.1, 19.2_

  - [ ] 10.12 Actualizar `src/components/layout/Sidebar.tsx` y crear `src/components/layout/SourcesFooter.tsx`
    - Insignias por bloque con `OriginBadge`; `GapsList`; `MapObjectList`
    - `SourcesFooter` (componente sin store, renderizable con `react-dom/server`) generado con `footerSources(CATALOG)`: sección "Fuentes integradas" (nombre enlazado + atribución) y sección "Catalogadas, no integradas" atenuada (`text-slate-500`) con insignia de estado y prefijo textual "no integrada ·"; sin texto fijo que mencione OpenAQ
    - Ajustar consumidores restantes (p. ej. `src/app/page.tsx`) hasta que no queden referencias a campos eliminados ni a `HoverInfo`
    - _Requirements: 10.11, 10.12, 17.3, 18.1, 18.2, 18.4, 18.6, 18.7, 18.8, 19.1, 19.3, 20.6_

  - [ ] 10.13 Crear `src/lib/tooltips.ts`
    - `tooltipFor(target, data, hour): TooltipContent | null` pura para todo `MapTargetKind`, compartida por el tooltip flotante y la tarjeta fijada; objeto inexistente → `null`
    - Distrito: nombre, población, densidad y fila EAQI (valor o "sin datos") con `eaqi: true` y `origin` del punto de aire de su `districtCode`
    - Estación: PM2.5/PM10/NO₂/O₃ en µg/m³ o "sin dato", hora de medición, grupo y fila EAQI con `eaqi: true` y `origin` de la estación
    - Detector: `qkfz[hour]` o "sin dato" con "perfil típico de junio de 2025"; hotspots e infraestructura: todas las filas con `example: true` derivado de `LAYER_CATALOG`, sin mirar el dato; solo las filas EAQI llevan `eaqi: true`; comprobaciones `!= null`
    - _Requirements: 10.11, 10.12, 11.4, 11.10, 12.3, 12.4, 15.1_

  - [ ] 10.14 Crear `src/components/panels/MapObjectList.tsx`
    - Sección "Explorar el mapa" con 12 botones nativos de distrito (orden por código) y botones de estación solo para `data.airStations` (activas y con coordenadas finitas), cada uno con nombre accesible
    - Enter/Espacio hace lo mismo que el clic: `pin({ kind, id, anchor, returnFocusTo: botón })` con `anchor = map.project(punto)` vía `useMap()` de react-map-gl (añadir `MapProvider` en `AppShell` si hace falta) y, para distritos, abre el Popup_de_Distrito; sin instancia de mapa o con el punto fuera del viewport la tarjeta se acopla abajo a la izquierda
    - _Requirements: 10.11, 10.12, 10.17, 12.7, 17.6_

  - [ ]* 10.15 Escribir prueba de propiedad de la insignia "simulado" en `src/lib/provenance.test.ts` y `src/lib/tooltips.test.ts`
    - **Property 26: La insignia "simulado" aparece exactamente en los valores simulados**
    - **Validates: Requirements 11.9, 11.10, 11.11, 11.12**
    - `originBadge` para todo origen; puntos de aire y estaciones con `origin` aleatorio → filas EAQI de `tooltipFor` y barras de `districtAqiBars` con `origin: "mock"` exactamente cuando su punto es `mock`

  - [ ]* 10.16 Escribir prueba de propiedad del Control_de_Definición_EAQI en `src/lib/tooltips.test.ts` y `src/lib/analytics.test.ts`
    - **Property 27: Todo valor de EAQI lleva su Control_de_Definición_EAQI**
    - **Validates: Requirements 10.10, 10.11, 10.12, 10.13, 10.14**
    - Filas de `tooltipFor` para distritos y estaciones, KPI de aire de `buildAnalytics` (único con `eaqi: true`) y barras de `districtAqiBars`

  - [ ]* 10.17 Escribir prueba de propiedad de capas de ejemplo en `src/lib/tooltips.test.ts` y `src/store/useCityStore.test.ts`
    - **Property 28: Capas de ejemplo etiquetadas por tipo y visibles solo por decisión del usuario**
    - **Validates: Requirements 15.1, 15.2, 19.4, 19.5**
    - Secuencias aleatorias de acciones sobre `createCityStore()` (cargar, hora, reproducir, seleccionar, fijar, 2D/3D, alternar capas que no son de ejemplo) → `hotspots` e `infrastructure` siguen en `false`; solo `toggleLayer`/`setLayer(id, true)` explícito las activa

  - [ ]* 10.18 Escribir pruebas de render y de escaneo de código en `src/components/eaqi/eaqiUi.test.ts` y `src/components/layout/SourcesFooter.test.ts`
    - Escaneo (`fs` + regex sobre `src/**/*.tsx`): `aqiTone(...).label` solo se lee dentro de `EaqiBandLabel`; `EaqiLegend` solo se importa en `EaqiPanel`; `AppShell` monta un único `EaqiPanel`
    - `renderToStaticMarkup` con `createElement`: `EaqiInfoButton` es un `<button type="button">` con `aria-label="Definición del índice europeo de calidad del aire"`; `OriginBadge` contiene "simulado" solo con `mock`; `SourcesFooter` con el catálogo real no contiene "OpenAQ" en la sección de integradas y marca las no integradas con "no integrada ·"
    - _Requirements: 10.9, 10.15, 10.17, 11.12, 18.6, 18.7, 18.8_

  - [ ]* 10.19 Escribir pruebas unitarias de `tooltipFor` en `src/lib/tooltips.test.ts`
    - Distrito sin AQI → fila EAQI "sin datos" con `eaqi: true`; estación con contaminante ausente → "sin dato"; objeto inexistente → `null`; detector con `qkfz[hour]` nulo → "sin dato"
    - _Requirements: 11.4, 12.3, 12.4_

- [ ] 11. Actualizar pruebas existentes afectadas
  - [ ] 11.1 Actualizar `src/lib/format.test.ts`
    - Expectativas de `aqiTone` con las bandas EAQI; eliminar las de cortes US EPA; `formatNullable(0)` → "0"
    - _Requirements: 10.5, 10.7, 10.8, 14.8_

  - [ ] 11.2 Actualizar `src/lib/services/cityData.test.ts`
    - Nueva forma de `CityDataset`, `source` por bloque, `snapshot` para distritos/tráfico, `origin` por punto de aire y estación, sin series sintéticas
    - _Requirements: 11.12, 13.3, 20.2, 20.3_

  - [ ] 11.3 Actualizar `src/components/map/buildDeckLayers.test.ts`
    - Eliminar la importación de `DATA_ELEVATION_M`; pasar `hour`, `sampler` y `elevationVersion` en lugar de `activity`; la prueba "apoya los puntos sobre la cota del terreno" usa un sampler fijo (p. ej. `() => 57` → z 57) y uno que devuelve `null` (→ z 0) y comprueba `updateTriggers.getPosition`
    - Ids esperados con la capa `air` como `ScatterplotLayer` (sin `air-heat`); feature MultiPolygon en `districts` con vértices elevados; hover/clic emiten `MapTarget`; capas de ejemplo con `defaultVisible: false` y `example: true`; `updateTriggers` por hora; conservar la prueba de la Property 11 si existe
    - _Requirements: 4.5, 4.8, 15.1, 15.2, 20.7, 20.8_

  - [ ] 11.4 Actualizar `src/lib/services/airQuality.test.ts`
    - Eliminar expectativas de `pm25ToAqi`; URL con los 5 parámetros `current`; fallo total → `MOCK_AIR`, bloque `mock` y `origin: "mock"` en cada punto; fallo parcial → puntos fallidos con `origin: "live"` y `aqi: null`; contaminante ausente → `null`; conservar la prueba de la Property 5 si existe
    - _Requirements: 10.8, 11.1, 11.5, 11.6, 11.12, 20.4_

  - [ ] 11.5 Actualizar `src/lib/services/weather.test.ts`
    - Consultas en el `point` del lago; eliminar expectativas obsoletas
    - _Requirements: 11.8_

  - [ ] 11.6 Actualizar `src/lib/mapStyle.test.ts`
    - Importar `TERRAIN_SOURCE_ID` y comprobar que `style.terrain.source === TERRAIN_SOURCE_ID`; comprobar que el módulo ya no exporta `DATA_ELEVATION_M`; mantener las pruebas de terreno, cielo y relieve
    - _Requirements: 20.7, 20.9_

- [ ] 12. Checkpoint - Typecheck y pruebas en Docker
  - Ejecutar `docker compose --profile dev build web-dev` (necesario por `fast-check`), luego `docker compose --profile dev run --rm web-dev npm run typecheck`, `docker compose --profile dev run --rm web-dev npm run test`, y `npm run lint` y `npm run build` por la misma vía. Si Docker Desktop no está iniciado, pedir al usuario que lo arranque; si Docker no está disponible, decirlo explícitamente en lugar de dar el paso por superado. Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Documentación del repositorio
  - [ ] 13.1 Reescribir las secciones de `README.md` según la guía
    - Recuento y listas de fuentes catalogadas, integradas, caídas y descartadas (coherentes con el catálogo y con la regla `integrado`: descargada por un script o consultada en vivo); huecos (coherentes con `buildGaps`); tabla "¿Se puede usar?" (fuente, licencia, atribución, condición de uso, estado); Open-Meteo gratuito solo no comercial
    - Comandos: borrar el lago, `ingesta/reconstruir.sh`, `python3 verificacion/verificar.py`, pruebas Python y Docker; restaurar con `git checkout -- lago/`; un solo FAIL impide publicar (el código de salida es 1 aunque falle la impresión) y cualquier error HTTP de una fuente detiene la ingesta sin tocar el Tema
    - Anatomía `ingesta/`, `catalogo/`, `lago/` (con `lago/raw`), `verificacion/`; bitácora de uso de IA; decisión registrada lago verificado frente a ruta API en vivo, con el motivo
    - _Requirements: 9.9, 18.5, 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7_

  - [ ] 13.2 Actualizar `.env.example`
    - Variable opcional para `CONFIG.luftgueteApiBase` (por defecto `https://luftdaten.berlin.de`) con comentario de fuente y licencia
    - _Requirements: 20.1_

- [ ] 14. Actualizar el Diccionario_de_Datos
  - [ ] 14.1 Editar `~/Downloads/Diccionario_de_datos_TallerDatos.xlsx` con `zipfile` y XML de la biblioteca estándar
    - No instalar nada (openpyxl no está disponible); cerrar Excel antes (existe el bloqueo `~$Diccionario_de_datos_TallerDatos.xlsx`); no tocar `Diccionario_de_datos_TallerDatos.original.xlsx`
    - Leer primero las listas de validación de datos y las filas actuales; editar el XML de las hojas a nivel de texto para no perder espacios de nombres, estilos ni validaciones; copiar el resto del zip sin cambios; ampliar `dimension` y rangos de validación si hace falta; escribir en un temporal y reemplazar
    - Hoja Fuentes: añadir Einwohnerdichte 2024, Flächennutzung 2020, Grünanlagenbestand, archivo blob VIZ (Verkehrsdetektion), Luftgütemessnetz, UBA caída y Open-Meteo horario si es fuente distinta; F05 → "No responde" con el error exacto; F12 y F13 → integradas; valores solo de las listas de Tipo de publicador, Formato, Cómo se obtiene, ¿Trae datos de personas?, Frecuencia y Estado
    - Hoja Diccionario: cada campo del lago (nombre, tipo, unidad, definición, fuente, vigencia) con Tipo/Clasificación de sus listas; eliminar edad mediana y los campos retirados
    - Hoja Bitácora IA: decisiones de esta especificación (incluidos el ajuste respecto a la ruta API en vivo, la elevación por punto sobre el terreno, el Panel_EAQI único con tooltips fijables y la insignia "simulado") y este flujo de revisión de la guía con sus correcciones, con Resultado de su lista
    - Usar un script temporal fuera del repositorio y borrarlo al terminar
    - _Requirements: 22.1, 22.2, 22.3_

  - [ ] 14.2 Comprobar el Diccionario_de_Datos actualizado
    - Releer las hojas Fuentes, Diccionario y Bitácora IA con `zipfile`; confirmar las filas esperadas, valores dentro de las listas desplegables, ausencia de "edad mediana" y validaciones conservadas
    - Confirmar con hash que `Diccionario_de_datos_TallerDatos.original.xlsx` no cambió
    - _Requirements: 22.1, 22.2, 22.3_

## Notes

- Las tareas marcadas con `*` son opcionales; son obligatorias la prueba de lago roto (4.2), la prueba de ejemplo del EAQI con 44 (6.3), las actualizaciones de pruebas existentes (11.1–11.6), los checkpoints, la documentación (13.x) y el Diccionario_de_Datos (14.x).
- Los scripts de ingesta y el Verificador se ejecutan en el host con `python3`; las pruebas TypeScript, en el contenedor `web-dev`.
- Cada tarea referencia requisitos concretos; las pruebas de propiedad citan su número de propiedad del diseño. La Property 11 se reparte entre `terrain.test.ts` (6.11) y `buildDeckLayers.test.ts` (10.3).
- Las pruebas de propiedad Python usan bucles de 100 casos con semilla fija; las TypeScript, fast-check con `numRuns: 100`.
- `terrain.ts`, `TERRAIN_SOURCE_ID` y `useTerrainElevation` (6.10–6.13) preceden a `buildDeckLayers` (10.2) y `MapContainer` (10.6); la semántica de `queryTerrainElevation` se vuelve a comprobar contra `node_modules/maplibre-gl` dentro del contenedor en 6.10.
- La revisión de accesibilidad del Panel_de_Procedencia, del Panel_EAQI y del recorrido por teclado (`MapObjectList` → tarjeta fijada → `EaqiInfoButton`) con teclado y lector de pantalla es manual; la validación WCAG completa requiere pruebas con tecnologías de asistencia.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1", "2.5", "6.1", "6.2", "6.8", "6.12"] },
    { "id": 1, "tasks": ["3.1", "3.2", "3.3", "3.4", "6.3", "6.6", "6.10"] },
    { "id": 2, "tasks": ["4.1", "6.13", "7.1", "11.1"] },
    { "id": 3, "tasks": ["3.9", "4.2", "7.2", "7.4"] },
    { "id": 4, "tasks": ["7.5", "7.8", "8.1", "8.9", "10.1"] },
    { "id": 5, "tasks": ["8.2", "8.4", "8.7", "8.11", "10.4"] },
    { "id": 6, "tasks": ["9.1", "10.5", "10.9", "10.10", "10.11", "11.5"] },
    { "id": 7, "tasks": ["9.2", "10.2", "10.7", "10.13", "10.14", "11.2", "11.4"] },
    { "id": 8, "tasks": ["10.6", "10.8", "10.12", "11.6"] },
    { "id": 9, "tasks": ["11.3"] },
    { "id": 10, "tasks": ["13.1", "13.2"] },
    { "id": 11, "tasks": ["14.1"] },
    { "id": 12, "tasks": ["14.2"] },
    { "id": 13, "tasks": ["2.2", "2.6", "3.5", "4.3", "6.4", "6.9", "6.11", "7.3", "7.6", "7.9", "8.3", "8.5", "8.8", "8.10", "9.3", "10.3", "10.18"] },
    { "id": 14, "tasks": ["2.3", "3.6", "4.4", "6.5", "7.7", "8.6", "9.4"] },
    { "id": 15, "tasks": ["2.4", "3.7", "4.5", "6.7", "9.5", "10.15"] },
    { "id": 16, "tasks": ["2.7", "3.8", "4.6", "10.16"] },
    { "id": 17, "tasks": ["4.7", "10.17"] },
    { "id": 18, "tasks": ["4.8", "10.19"] },
    { "id": 19, "tasks": ["4.9"] },
    { "id": 20, "tasks": ["4.10"] }
  ]
}
```
