# Requirements Document

## Introduction

CerebroBerlin (Next.js 14 + TypeScript + MapLibre 4 + deck.gl 9) muestra métricas por distrito de Berlín que hoy están escritas a mano en `src/data/districts.ts` (población, superficie, edad mediana, AQI y % de zona verde) sin haber sido contrastadas con ninguna fuente. El AQI por distrito es inventado y alimenta el popup de distrito y el gráfico "AQI por distrito"; además, la aplicación clasifica el índice europeo de calidad del aire (EAQI) con los cortes de la escala US EPA. Varias cifras del panel (movilidad, bicis activas, demanda energética, curva de AQI 24 h, puntos críticos) son sintéticas y no se etiquetan como tales.

Esta especificación corrige esos defectos siguiendo el flujo del laboratorio de la guía "Taller de datos" (https://topicos-si.vercel.app/Tallerdatos) desde el rastreo en adelante: rastreo y catálogo de fuentes, verificación de permisos (¿se puede usar?), lago de datos reproducible construido por scripts, verificación automática con puerta de publicación y vistas que muestran procedencia y vigencia. Las reglas de la guía son vinculantes.

Decisión registrada: los datos oficiales de cambio lento (límites, población, estructura de edad, % verde, perfil de tráfico) se sirven desde un lago versionado, reconstruible por scripts y validado por `verificacion/verificar.py`; la aplicación lee los JSON del lago confirmados en el repositorio (modo "snapshot"). Esto ajusta la respuesta anterior ("ruta API de Next.js que refresca en vivo"), porque la guía exige reconstrucción desde scripts con puerta de verificación; una ruta en vivo serviría datos no verificados y duplicaría la ingesta. Refrescar significa volver a ejecutar los scripts.

Convención de redacción: los requisitos usan los patrones EARS en español: CUANDO (evento), MIENTRAS (estado), SI … ENTONCES (evento no deseado), DONDE (opción), y EL/LA <Sistema> DEBERÁ (respuesta). En patrones complejos el orden es DONDE → MIENTRAS → CUANDO/SI → EL/LA → DEBERÁ.

## Glossary

- **Aplicación**: la aplicación web CerebroBerlin (código en `src/`).
- **Catálogo**: el archivo `catalogo/fuentes.json` que contiene una Ficha_de_Fuente por cada fuente rastreada.
- **Ficha_de_Fuente**: registro del Catálogo con los campos id, nombre, entidad, url, cobertura, vigencia, probado, estado, licencia, personas, protección, uso y nota.
- **Estado_de_Fuente**: valor del campo estado de una Ficha_de_Fuente; uno de `integrado`, `candidato`, `caído`, `declarado`, `excluido`.
- **Fecha_Probado**: fecha en formato YYYY-MM-DD del día en que una fuente respondió efectivamente a una descarga o consulta.
- **Vigencia**: periodo o fecha de referencia que la fuente declara para un dato (por ejemplo `2024`, `2020`, `2025-06`).
- **Lago**: el directorio `lago/` con un archivo JSON por Tema y los GeoJSON derivados, confirmado en el repositorio.
- **Lago_Raw**: el directorio `lago/raw/` con las descargas originales sin procesar, excluido del control de versiones.
- **Tema**: unidad temática del Lago (por ejemplo territorio, población, verde, tráfico) representada por un único JSON.
- **Contrato_del_Lago**: la estructura obligatoria de cada JSON de Tema: `{"tema","probado":"YYYY-MM-DD","fuentes":[{id,nombre,url,estado,licencia}],"cifras":{clave:{"valor","unidad","vigencia","fuente"}},"series":{…}}`.
- **Cifra**: entrada del objeto `cifras` de un Tema con los campos valor, unidad, vigencia y fuente.
- **Script_de_Ingesta**: script Python del directorio `ingesta/` que usa solo la biblioteca estándar, no requiere claves, descarga una única fuente a Lago_Raw y escribe su Tema normalizado en el Lago.
- **Verificador**: el script `verificacion/verificar.py`.
- **Código_de_Distrito**: código oficial de Bezirk de dos dígitos `01`–`12` (equivalente a `gem` `001`–`012` de ALKIS; los dos primeros caracteres de `schluessel` del Umweltatlas son el número de distrito anterior a 2001, `01`–`23`, y se traducen al Código_de_Distrito con una tabla fija).
- **Límites_ALKIS**: el servicio WFS "ALKIS Bezirksgrenzen" de gdi.berlin.de (licencia dl-de-zero-2.0).
- **Fuente_Población**: el servicio WFS "Einwohnerdichte 2024 (Umweltatlas)" del Amt für Statistik Berlin-Brandenburg (licencia "Creative Commons Namensnennung 3.0 Deutschland").
- **Fuente_Uso_Suelo**: el servicio WFS "Flächennutzung 2020 (Umweltatlas)" (`ua_flaechennutzung_2020:c_ua_realnutz_2020`, licencia dl-de-zero-2.0).
- **Fuente_Tráfico**: la Verkehrsdetektion de SenMVKU (ubicaciones `teu_standorte.json` y archivo horario en el blob `mdhopendata`, licencia dl-de-by-2.0).
- **Fuente_Luftgüte**: la API del Berliner Luftgütemessnetz `https://luftdaten.berlin.de/api` (SenMVKU, licencia dl-de-by-2.0).
- **Open_Meteo**: las APIs de Open-Meteo de calidad del aire (modelo CAMS) y meteorología (licencia CC BY 4.0, nivel gratuito no comercial).
- **EAQI**: el índice europeo de calidad del aire calculado según la definición de Open-Meteo (`EuropeanAirQuality` en `AirQuality.swift`).
- **Módulo_EAQI**: el único módulo TypeScript de la Aplicación que define los umbrales, el cálculo y las bandas del EAQI.
- **Panel_EAQI**: el único panel compartido de la Aplicación que muestra la definición del EAQI y sus Bandas_EAQI.
- **Control_de_Definición_EAQI**: icono o enlace visible junto a un valor de EAQI que abre el Panel_EAQI.
- **Banda_EAQI**: categoría cualitativa del EAQI: Buena, Razonable, Moderada, Mala, Muy mala, Extremadamente mala.
- **Punto_de_Distrito**: punto representativo situado dentro del polígono oficial de cada distrito, calculado por un Script_de_Ingesta y almacenado en el Lago.
- **Popup_de_Distrito**: el componente `DistrictPopup` que muestra los datos de un distrito seleccionado.
- **Panel_de_Analítica**: el componente `AnalyticsPanel` con KPIs y gráficos.
- **KPI**: tarjeta numérica del Panel_de_Analítica (`KpiCards`).
- **Capa_de_Distritos**: la capa `GeoJsonLayer` de deck.gl que dibuja los distritos.
- **Capa_de_Detectores**: la capa de mapa que muestra los detectores de tráfico con su media horaria.
- **Capa_de_Estaciones**: la capa de mapa que muestra las estaciones de medición de la Fuente_Luftgüte.
- **Línea_de_Tiempo**: el control `TimelineControl` y el hook `useTimelinePlayer` que seleccionan una hora del día.
- **Panel_de_Procedencia**: elemento de interfaz que, a un clic de una cifra, muestra fuente (nombre y url), Vigencia y Fecha_Probado o momento de consulta.
- **Origen_de_Dato**: etiqueta de procedencia de un valor mostrado: `snapshot` (Lago), `en vivo` (consulta en tiempo de ejecución), `simulado` (respaldo mock) o `datos de ejemplo (sin fuente)`.
- **Datos_de_Ejemplo**: las capas de puntos críticos (hotspots) e infraestructura, generadas sin fuente.
- **Lista_de_Huecos**: la sección de la Aplicación que enumera las métricas sin fuente o con cobertura parcial.
- **safeFetchJson**: la función de `src/lib/http.ts` que ejecuta peticiones HTTP con manejo de errores.
- **README**: el archivo `README.md` del repositorio.
- **Diccionario_de_Datos**: el libro `~/Downloads/Diccionario_de_datos_TallerDatos.xlsx` con las hojas Fuentes, Diccionario y Bitácora IA.

## Requirements

### Requirement 1: Catálogo de fuentes (rastreo)

**User Story:** Como evaluador del taller, quiero un catálogo con todas las fuentes rastreadas, incluidas las caídas y descartadas, para auditar qué se probó y por qué cada fuente entró o quedó fuera.

#### Acceptance Criteria

1. EL Catálogo DEBERÁ contener una Ficha_de_Fuente por cada fuente rastreada, incluidas Límites_ALKIS, Fuente_Población, Einwohner LOR CSV (F05), Fuente_Uso_Suelo, Grünanlagenbestand, Fuente_Tráfico, Fuente_Luftgüte, Open_Meteo calidad del aire, Open_Meteo meteorología, VBB transport.rest, nextbike GBFS, OpenFreeMap, teselas de relieve Terrarium, InfraNode, API de aire de la UBA, consulta Wikidata y OpenAQ.
2. EL Catálogo DEBERÁ incluir en cada Ficha_de_Fuente los campos id, nombre, entidad, url, cobertura, vigencia, probado, estado, licencia, personas, protección, uso y nota.
3. EL Catálogo DEBERÁ restringir el campo estado a uno de los valores `integrado`, `candidato`, `caído`, `declarado` o `excluido`.
4. EL Catálogo DEBERÁ restringir el campo personas a uno de los valores `no`, `conteos agregados por zona`, `personas identificables` o `texto libre`.
5. EL Catálogo DEBERÁ registrar en el campo licencia el texto literal de la licencia publicada por la fuente o el valor `no declara`.
6. EL Catálogo DEBERÁ registrar en el campo probado la Fecha_Probado real de la fuente.
7. SI una fuente respondió con error durante el rastreo, ENTONCES EL Catálogo DEBERÁ registrar estado `caído` y el error exacto observado en el campo nota (por ejemplo, F05: página HTML SPA de 75 KB y S3 `403 AccessDenied`; UBA: HTTP 502; VBB transport.rest: HTTP 503 el 2026-10-07).
8. SI una fuente fue descartada, ENTONCES EL Catálogo DEBERÁ registrar estado `excluido` y el motivo en el campo nota (por ejemplo, Wikidata: consulta con 0 filas; OpenAQ: no utilizada por la Aplicación).
9. EL Catálogo DEBERÁ registrar en el campo uso la vista o Tema que alimenta cada fuente integrada.
10. EL Catálogo DEBERÁ registrar estado `integrado` únicamente para fuentes que cumplan al menos una de estas dos condiciones, sin requerir ambas: (a) la fuente es descargada por un Script_de_Ingesta; (b) la fuente es consultada en tiempo de ejecución por la Aplicación.
11. SI una fuente bloquea el acceso, ENTONCES EL Catálogo DEBERÁ registrar el bloqueo como `caído` sin que ningún Script_de_Ingesta intente eludirlo.

### Requirement 2: Contrato del lago

**User Story:** Como desarrollador, quiero que cada tema del lago tenga la misma estructura, para que la Aplicación y el Verificador lo lean sin casos especiales.

#### Acceptance Criteria

1. EL Lago DEBERÁ contener exactamente un JSON por Tema que cumpla el Contrato_del_Lago.
2. EL Lago DEBERÁ registrar en cada Cifra los campos valor, unidad, vigencia y fuente, donde fuente es el id de una entrada del arreglo `fuentes` del mismo Tema.
3. EL Lago DEBERÁ registrar en cada entrada de `fuentes` los campos id, nombre, url, estado y licencia coincidentes con la Ficha_de_Fuente del mismo id en el Catálogo.
4. EL Lago DEBERÁ almacenar los valores numéricos ya normalizados (tipo número JSON, unidades declaradas, sin separadores de miles ni comas decimales).
5. EL Lago DEBERÁ almacenar las geometrías como GeoJSON en WGS84 (EPSG:4326) simplificado, con un tamaño total de geometría de distritos de 200 KB o menos.
6. EL Lago DEBERÁ identificar cada distrito por su Código_de_Distrito.
7. EL repositorio DEBERÁ excluir Lago_Raw del control de versiones mediante `.gitignore`.
8. EL repositorio DEBERÁ incluir los JSON y GeoJSON del Lago en el control de versiones y en el contexto de construcción de la imagen Docker.

### Requirement 3: Scripts de ingesta reproducibles

**User Story:** Como evaluador, quiero borrar el lago y reconstruirlo con los scripts, para comprobar que ningún dato se escribió a mano.

#### Acceptance Criteria

1. EL repositorio DEBERÁ contener un Script_de_Ingesta por cada fuente integrada en el Lago.
2. EL Script_de_Ingesta DEBERÁ usar exclusivamente la biblioteca estándar de Python 3 y DEBERÁ funcionar sin claves de API.
3. CUANDO se ejecuta un Script_de_Ingesta, EL Script_de_Ingesta DEBERÁ guardar la descarga original en Lago_Raw antes de escribir el Tema normalizado.
4. CUANDO se ejecuta un Script_de_Ingesta, EL Script_de_Ingesta DEBERÁ escribir como `probado` la fecha del día en que la fuente respondió.
5. EL Script_de_Ingesta DEBERÁ producir salidas deterministas (orden estable de claves y elementos, redondeo fijo por unidad).
6. CUANDO se borra el Lago completo y se ejecutan de nuevo todos los Scripts_de_Ingesta el mismo día, EL Lago DEBERÁ quedar idéntico byte a byte al Lago anterior.
7. CUANDO se borra el Lago completo y se ejecutan de nuevo todos los Scripts_de_Ingesta otro día con las fuentes sin cambios, EL Lago DEBERÁ diferir del anterior únicamente en los campos `probado`.
8. SI una fuente devuelve cualquier error HTTP (sin excepción por código de estado ni por fuente) o un contenido no esperado, ENTONCES EL Script_de_Ingesta DEBERÁ terminar con código distinto de cero, mostrar el error exacto y conservar el Tema existente sin modificarlo.
9. EL repositorio DEBERÁ ofrecer un único comando que ejecute todos los Scripts_de_Ingesta y a continuación el Verificador, y que termine con código distinto de cero si cualquiera de ellos falla.

### Requirement 4: Límites oficiales de distrito

**User Story:** Como usuario del mapa, quiero ver los límites reales de los 12 distritos, para que la vista territorial no dependa de rectángulos aproximados.

#### Acceptance Criteria

1. EL Script_de_Ingesta de Límites_ALKIS DEBERÁ descargar los 12 distritos de `alkis_bezirke:bezirksgrenzen` en EPSG:4326 y en EPSG:25833.
2. EL Script_de_Ingesta de Límites_ALKIS DEBERÁ calcular la superficie de cada distrito en km² a partir de la geometría planar en EPSG:25833.
3. EL Script_de_Ingesta de Límites_ALKIS DEBERÁ simplificar la geometría WGS84 y escribirla en el Lago como MultiPolygon con las propiedades Código_de_Distrito y nombre oficial (`namgem`).
4. EL Script_de_Ingesta de Límites_ALKIS DEBERÁ calcular un Punto_de_Distrito contenido dentro del polígono oficial de cada distrito.
5. LA Capa_de_Distritos DEBERÁ dibujar geometrías de tipo Polygon y MultiPolygon.
6. LA Aplicación DEBERÁ dibujar los distritos con la geometría del Lago en lugar de los rectángulos calculados con `halfW`/`halfH`.
7. LA Aplicación DEBERÁ calcular la densidad de cada distrito como población del Lago dividida por la superficie del Lago.
8. MIENTRAS el mapa 3D con relieve está activo, LA Capa_de_Distritos DEBERÁ permanecer visible y alineada con el terreno.

### Requirement 5: Población y estructura de edad

**User Story:** Como analista, quiero población y estructura de edad oficiales por distrito, para reemplazar las cifras escritas a mano y la edad mediana sin fuente.

#### Acceptance Criteria

1. EL Script_de_Ingesta de Fuente_Población DEBERÁ descargar los bloques de `ua_einwohnerdichte_2024:ua_einwohnerdichte_2024` por páginas sin geometría usando `propertyName`, `count` y `startIndex`.
2. EL Script_de_Ingesta de Fuente_Población DEBERÁ agregar `ew2024` por Código_de_Distrito traduciendo los dos primeros caracteres de `schluessel` (número de distrito anterior a la reforma de 2001, `01`–`23`) al Código_de_Distrito actual mediante la tabla fija `ANTIGUO_A_ACTUAL`. SI los dos primeros caracteres de un `schluessel` no figuran en `ANTIGUO_A_ACTUAL`, ENTONCES EL Script_de_Ingesta de Fuente_Población DEBERÁ terminar con código distinto de cero e indicar el `schluessel` no reconocido.
3. EL Script_de_Ingesta de Fuente_Población DEBERÁ calcular el % de población menor de 18 años como (`alter_u6` + `alter_6_u10` + `alter_10_u18`) dividido por la población total de los bloques con datos de edad, multiplicado por 100.
4. EL Script_de_Ingesta de Fuente_Población DEBERÁ calcular el % de población de 65 años o más como (`alter_65_u70` + `alter_70_u75` + `alter75_u80` + `alter_80plus`) dividido por la población total de los bloques con datos de edad, multiplicado por 100.
5. EL Script_de_Ingesta de Fuente_Población DEBERÁ registrar por distrito la cobertura de edad como el % de población que pertenece a bloques con datos de edad.
6. SI un bloque tiene valores nulos en grupos de edad, ENTONCES EL Script_de_Ingesta de Fuente_Población DEBERÁ excluir ese bloque del cálculo de porcentajes de edad y DEBERÁ contarlo en la población total.
7. SI el número de bloques descargados difiere del total declarado por el servicio, ENTONCES EL Script_de_Ingesta de Fuente_Población DEBERÁ terminar con código distinto de cero.
8. LA Aplicación DEBERÁ eliminar el campo edad mediana de los tipos, datos y vistas.
9. EL Popup_de_Distrito DEBERÁ mostrar población, % menor de 18 años, % de 65 años o más y la cobertura de edad del distrito tomados del Lago.

### Requirement 6: Superficie verde

**User Story:** Como analista, quiero un % de superficie verde calculado con una definición explícita, para que la cifra sea comparable y auditable.

#### Acceptance Criteria

1. EL Script_de_Ingesta de Fuente_Uso_Suelo DEBERÁ descargar los bloques de `ua_flaechennutzung_2020:c_ua_realnutz_2020` con las propiedades `bez`, `flalle`, `nutz` y `nutzung`.
2. EL Script_de_Ingesta de Fuente_Uso_Suelo DEBERÁ normalizar `bez` al Código_de_Distrito de dos dígitos.
3. EL Script_de_Ingesta de Fuente_Uso_Suelo DEBERÁ calcular el % verde de cada distrito como la suma de `flalle` de los bloques con códigos `nutz` de vegetación (100 Wald, 130 Park/Grünfläche, 150 Friedhof, 160 Kleingarten, 172 y 173 Brache con vegetación) dividida por la suma de `flalle` de todos los bloques del distrito, multiplicada por 100.
4. LA Aplicación DEBERÁ mostrar junto al % verde la definición que indica las categorías incluidas y que el denominador es la superficie de bloques sin calles.
5. SI aparece un código `nutz` no listado en la tabla de clasificación del Script_de_Ingesta, ENTONCES EL Script_de_Ingesta de Fuente_Uso_Suelo DEBERÁ terminar con código distinto de cero e indicar el código no clasificado.
6. EL Catálogo DEBERÁ registrar Grünanlagenbestand como `candidato` con la nota de que es una alternativa no integrada.

### Requirement 7: Perfil de tráfico real

**User Story:** Como usuario, quiero un perfil de tráfico basado en detectores reales, para reemplazar el índice de movilidad sintético.

#### Acceptance Criteria

1. EL Script_de_Ingesta de Fuente_Tráfico DEBERÁ descargar `teu_standorte.json` y el archivo `detektor_2025_06.tgz` del contenedor `mdhopendata`.
2. EL Script_de_Ingesta de Fuente_Tráfico DEBERÁ leer cada CSV del archivo con separador `;`, columnas "Stunde des Tages (Ortszeit)" y `qkfz`, y DEBERÁ descartar los valores `NaN`.
3. EL Script_de_Ingesta de Fuente_Tráfico DEBERÁ calcular por cada hora del día 0–23 la media de `qkfz` (vehículos/hora) de cada detector únicamente cuando ese detector tenga al menos 3 filas válidas (`qkfz` distinto de `NaN` y no vacío) para esa hora del día en el mes, y DEBERÁ registrar como nula la media de esa hora de ese detector cuando tenga menos de 3 filas válidas, de modo que quede excluida del perfil de ciudad y se muestre como nula en la Capa_de_Detectores.
4. EL Script_de_Ingesta de Fuente_Tráfico DEBERÁ calcular el perfil de ciudad de 24 horas como la media por hora de las medias no nulas de los detectores en esa hora, y DEBERÁ registrar en el Tema el umbral de 3 filas válidas (Cifra `min_registros_por_hora`, unidad `registros`) y el número de horas-detector con al menos 1 fila válida descartadas por el umbral (Cifra `detector_horas_descartadas`, unidad `detector-horas`).
5. EL Script_de_Ingesta de Fuente_Tráfico DEBERÁ unir las medias por detector con las ubicaciones mediante `teuID`.
6. SI un detector del archivo carece de ubicación en `teu_standorte.json`, ENTONCES EL Script_de_Ingesta de Fuente_Tráfico DEBERÁ excluir ese detector de la capa y DEBERÁ registrar el número de detectores excluidos en el Tema.
7. EL Script_de_Ingesta de Fuente_Tráfico DEBERÁ registrar Vigencia `2025-06` en las Cifras y series de tráfico.
8. CUANDO la Línea_de_Tiempo selecciona una hora, LA Capa_de_Detectores DEBERÁ mostrar la media de `qkfz` de cada detector para esa hora.
9. LA Aplicación DEBERÁ etiquetar el perfil de tráfico como "perfil típico de junio de 2025", distinto de un valor en tiempo real.
10. LA Aplicación DEBERÁ eliminar el índice de movilidad sintético de KPIs, gráficos y datos mock.

### Requirement 8: Verificador genérico

**User Story:** Como evaluador, quiero un verificador que rechace el lago ante cualquier dato sin procedencia, para que nada sin respaldo se publique.

#### Acceptance Criteria

1. CUANDO se ejecuta, EL Verificador DEBERÁ recorrer todos los JSON de Tema del Lago e imprimir un resultado PASS o FAIL por comprobación.
2. SI alguna Cifra carece de valor, unidad, vigencia o fuente, ENTONCES EL Verificador DEBERÁ informar FAIL.
3. SI el campo fuente de una Cifra no corresponde a un id de `fuentes` del Tema y del Catálogo, ENTONCES EL Verificador DEBERÁ informar FAIL.
4. SI el campo `probado` de un Tema no es una fecha válida YYYY-MM-DD, ENTONCES EL Verificador DEBERÁ informar FAIL.
5. SI una entrada de `fuentes` carece de url o licencia, ENTONCES EL Verificador DEBERÁ informar FAIL.
6. SI un nombre de campo del Lago coincide con la lista de nombres personales del Verificador (por ejemplo nombre de persona, apellido, email, teléfono, dirección, fecha de nacimiento), ENTONCES EL Verificador DEBERÁ informar FAIL.
7. SI un texto del Lago contiene una dirección de correo electrónico o un número de teléfono, ENTONCES EL Verificador DEBERÁ informar FAIL.
8. SI una Ficha_de_Fuente del Catálogo carece de alguno de sus campos obligatorios o tiene un estado o valor de personas fuera de los valores permitidos, ENTONCES EL Verificador DEBERÁ informar FAIL.
9. SI al menos una comprobación informa FAIL, ENTONCES EL Verificador DEBERÁ terminar con código distinto de cero como paso final obligatorio.
10. EL Verificador DEBERÁ usar exclusivamente la biblioteca estándar de Python 3.
11. EL Verificador DEBERÁ calcular el código de salida después de ejecutar todas las comprobaciones, a partir del número de comprobaciones con FAIL y de forma independiente de la impresión de resultados.
12. EL Verificador DEBERÁ devolver el código de salida calculado como estado de salida del proceso.
13. SI la impresión de resultados falla y al menos una comprobación informa FAIL, ENTONCES EL Verificador DEBERÁ terminar con código distinto de cero.

### Requirement 9: Comprobaciones de dominio de ciudad

**User Story:** Como evaluador, quiero comprobaciones propias de Berlín, para detectar datos plausibles en forma pero incorrectos en contenido.

#### Acceptance Criteria

1. SI el Lago no contiene exactamente 12 distritos con Códigos_de_Distrito `01` a `12`, ENTONCES EL Verificador DEBERÁ informar FAIL.
2. SI la población total de Berlín en el Lago queda fuera del rango 3.400.000–4.200.000 habitantes, ENTONCES EL Verificador DEBERÁ informar FAIL.
3. SI la suma de la población de los 12 distritos difiere de la población total de la ciudad en el Lago, ENTONCES EL Verificador DEBERÁ informar FAIL.
4. SI la suma de las superficies de los 12 distritos difiere en más de 1 % de 891,1 km², ENTONCES EL Verificador DEBERÁ informar FAIL.
5. SI alguna coordenada del Lago queda fuera del rectángulo de Berlín (longitud 13,08–13,77; latitud 52,33–52,68), ENTONCES EL Verificador DEBERÁ informar FAIL.
6. SI algún porcentaje del Lago queda fuera del intervalo 0–100, ENTONCES EL Verificador DEBERÁ informar FAIL.
7. SI el perfil de tráfico no tiene exactamente 24 valores horarios no negativos, ENTONCES EL Verificador DEBERÁ informar FAIL.
8. EL repositorio DEBERÁ incluir una prueba que copie el Lago a un directorio temporal, altere deliberadamente una Cifra, ejecute el Verificador sobre la copia y confirme que termina con código distinto de cero.
9. EL README DEBERÁ documentar que un solo FAIL del Verificador impide publicar el Lago.

### Requirement 10: Definición única del EAQI

**User Story:** Como usuario, quiero que el índice europeo de calidad del aire se clasifique con sus propias bandas, para no confundirlo con la escala US EPA.

#### Acceptance Criteria

1. EL Módulo_EAQI DEBERÁ definir los umbrales horarios PM2.5 [0, 5, 15, 50, 90, 140], PM10 [0, 15, 45, 120, 195, 270], NO2 [0, 10, 25, 60, 100, 150] y O3 [0, 60, 100, 120, 160, 180] en µg/m³.
2. EL Módulo_EAQI DEBERÁ calcular el subíndice de un contaminante como (índice del tramo + posición lineal dentro del tramo) × 20, extrapolando linealmente con el último tramo por encima del último umbral.
3. EL Módulo_EAQI DEBERÁ calcular el EAQI global como el máximo de los subíndices de los contaminantes disponibles.
4. CUANDO se calcula el EAQI con PM2.5 = 19,5 µg/m³ y O3 = 104 µg/m³, EL Módulo_EAQI DEBERÁ devolver 44 tras redondear al entero.
5. EL Módulo_EAQI DEBERÁ asignar las Bandas_EAQI: menor que 20 Buena; de 20 a menos de 40 Razonable; de 40 a menos de 60 Moderada; de 60 a menos de 80 Mala; de 80 a 100 Muy mala; mayor que 100 Extremadamente mala.
6. SI ningún contaminante tiene valor, ENTONCES EL Módulo_EAQI DEBERÁ devolver la ausencia de valor en lugar de un número.
7. LA Aplicación DEBERÁ usar el Módulo_EAQI en el respaldo de calidad del aire, en la Capa_de_Estaciones, en los datos simulados, en `aqiTone` y en los colores del gráfico "AQI por distrito".
8. LA Aplicación DEBERÁ eliminar la función `pm25ToAqi` y los cortes US EPA.
9. LA Aplicación DEBERÁ mostrar la definición del EAQI y sus bandas en un único Panel_EAQI accesible desde cada valor de EAQI.
10. EL Popup_de_Distrito DEBERÁ mostrar junto a cada valor de EAQI un Control_de_Definición_EAQI propio.
11. EL tooltip de la Capa_de_Distritos DEBERÁ mostrar junto a cada valor de EAQI un Control_de_Definición_EAQI propio.
12. EL tooltip de la Capa_de_Estaciones DEBERÁ mostrar junto a cada valor de EAQI un Control_de_Definición_EAQI propio.
13. EL gráfico "AQI por distrito" DEBERÁ mostrar un Control_de_Definición_EAQI propio junto a los valores de EAQI.
14. EL KPI de calidad del aire DEBERÁ mostrar junto a su valor de EAQI un Control_de_Definición_EAQI propio.
15. LA Aplicación DEBERÁ mostrar un Control_de_Definición_EAQI propio junto a cada etiqueta de Banda_EAQI generada con `aqiTone`.
16. CUANDO el usuario activa un Control_de_Definición_EAQI con ratón o teclado, LA Aplicación DEBERÁ abrir el Panel_EAQI.
17. LA Aplicación DEBERÁ hacer accesible por teclado cada Control_de_Definición_EAQI y DEBERÁ dotarlo de un nombre accesible.

### Requirement 11: AQI por distrito desde Open-Meteo

**User Story:** Como usuario, quiero que el AQI de cada distrito provenga de un modelo identificado, para dejar de ver un valor inventado.

#### Acceptance Criteria

1. CUANDO la Aplicación carga la calidad del aire, LA Aplicación DEBERÁ consultar Open_Meteo con `european_aqi`, `pm2_5`, `pm10`, `nitrogen_dioxide` y `ozone` en el Punto_de_Distrito de cada distrito mediante safeFetchJson.
2. LA Aplicación DEBERÁ asociar cada respuesta de Open_Meteo al distrito por Código_de_Distrito.
3. LA Aplicación DEBERÁ etiquetar el AQI por distrito como "modelo CAMS (Open-Meteo)" con el momento de consulta.
4. SI la consulta de un distrito falla, ENTONCES LA Aplicación DEBERÁ mostrar "sin datos" para ese distrito en el Popup_de_Distrito, en el tooltip de la Capa_de_Distritos y en el gráfico "AQI por distrito".
5. SI fallan las consultas de los 12 distritos, ENTONCES LA Aplicación DEBERÁ usar valores mock calculados con el Módulo_EAQI y etiquetados con Origen_de_Dato `simulado`.
6. SI la respuesta carece de un contaminante, ENTONCES LA Aplicación DEBERÁ almacenar la ausencia de valor y mostrar "sin dato" en lugar de 0.
7. LA Aplicación DEBERÁ eliminar el campo AQI y el % verde escritos a mano de `src/data/districts.ts` y DEBERÁ dejar de derivar datos mock de esos campos.
8. LA Aplicación DEBERÁ usar el Punto_de_Distrito del Lago para las consultas meteorológicas por distrito.
9. MIENTRAS el AQI por distrito usa valores mock con Origen_de_Dato `simulado`, EL Popup_de_Distrito DEBERÁ mostrar junto a cada valor simulado un indicador visible (etiqueta o icono) "simulado".
10. MIENTRAS el AQI por distrito usa valores mock con Origen_de_Dato `simulado`, EL tooltip de la Capa_de_Distritos DEBERÁ mostrar junto a cada valor simulado un indicador visible (etiqueta o icono) "simulado".
11. MIENTRAS el AQI por distrito usa valores mock con Origen_de_Dato `simulado`, EL gráfico "AQI por distrito" DEBERÁ mostrar un indicador visible (etiqueta o icono) "simulado" junto a los valores simulados.
12. LA Aplicación DEBERÁ mostrar el indicador "simulado" únicamente en valores con Origen_de_Dato `simulado`, de modo que los valores reales de Open_Meteo se distingan visualmente de los simulados.

### Requirement 12: Estaciones de calidad del aire medidas

**User Story:** Como usuario, quiero ver las mediciones reales de las estaciones de Berlín, para contrastar el modelo con datos observados.

#### Acceptance Criteria

1. CUANDO la Aplicación carga la Capa_de_Estaciones, LA Aplicación DEBERÁ consultar `/api/stations` de la Fuente_Luftgüte mediante safeFetchJson y conservar solo las estaciones con `active` verdadero.
2. CUANDO la Aplicación carga la Capa_de_Estaciones, LA Aplicación DEBERÁ consultar `/api/components/{pm2_1h|pm10_1h|no2_1h|o3_1h}/data?stationgroup=all&timespan=currentday` y asociar cada medición a su estación por código de estación.
3. LA Capa_de_Estaciones DEBERÁ mostrar por estación el último valor horario de PM2.5, PM10, NO2 y O3 en µg/m³, la hora de medición, el grupo de estación y el EAQI calculado con el Módulo_EAQI.
4. SI una estación carece de medición de un contaminante, ENTONCES LA Capa_de_Estaciones DEBERÁ mostrar "sin dato" para ese contaminante y DEBERÁ calcular el EAQI con los contaminantes disponibles.
5. SI la Fuente_Luftgüte no responde, ENTONCES LA Aplicación DEBERÁ mostrar la Capa_de_Estaciones con datos mock etiquetados con Origen_de_Dato `simulado`.
6. LA Aplicación DEBERÁ convertir las coordenadas de estación recibidas como texto a números antes de dibujarlas.
7. SI el texto de una coordenada de estación no se puede convertir en un número finito, ENTONCES LA Aplicación DEBERÁ excluir esa estación de la Capa_de_Estaciones, sin dibujarla ni listarla.

### Requirement 13: Curvas de 24 horas reales

**User Story:** Como usuario, quiero que el gráfico de 24 horas muestre series reales, para no confundir datos sintéticos con observaciones.

#### Acceptance Criteria

1. CUANDO la Aplicación solicita a Open_Meteo la curva de EAQI de 24 horas y la curva de temperatura de 24 horas, LA Aplicación DEBERÁ incluir en la petición los parámetros `hourly=european_aqi`, `hourly=temperature_2m`, `timezone=Europe/Berlin` y `forecast_days=1`.
2. LA Aplicación DEBERÁ mostrar en el gráfico de 24 horas el perfil de tráfico del Lago con su Vigencia.
3. LA Aplicación DEBERÁ eliminar de `buildTimeSeries` las series sintéticas de movilidad, AQI, uso de bicis, demanda energética y temperatura.
4. SI la consulta horaria de Open_Meteo falla, ENTONCES LA Aplicación DEBERÁ mostrar curvas mock etiquetadas con Origen_de_Dato `simulado`.

### Requirement 14: KPIs sin cifras fabricadas

**User Story:** Como usuario, quiero que cada KPI provenga de una fuente o del lago, para confiar en las cifras del panel.

#### Acceptance Criteria

1. EL KPI de población DEBERÁ mostrar la población total calculada a partir del Lago con su Vigencia y DEBERÁ omitir la variación "+0.9%".
2. EL KPI de bicis DEBERÁ mostrar la suma de bicis disponibles del feed nextbike GBFS con el momento de consulta.
3. SI el feed nextbike GBFS no responde, ENTONCES EL KPI de bicis DEBERÁ mostrar el valor mock etiquetado con Origen_de_Dato `simulado`.
4. EL KPI de tráfico DEBERÁ mostrar el valor del perfil de tráfico del Lago para la hora seleccionada en la Línea_de_Tiempo, con Vigencia `2025-06`.
5. EL KPI de calidad del aire DEBERÁ calcularse a partir de los valores de EAQI por distrito obtenidos de Open_Meteo y DEBERÁ indicar el número de distritos con datos.
6. LA Aplicación DEBERÁ eliminar el KPI "Demanda energética" y el KPI "Puntos críticos".
7. LA Aplicación DEBERÁ eliminar el texto "en tiempo real" de todo KPI cuyo Origen_de_Dato sea distinto de `en vivo`.
8. CUANDO el EAQI calculado para el KPI de calidad del aire es 0 o un valor bajo, EL KPI de calidad del aire DEBERÁ mostrar ese valor como un EAQI válido.
9. EL KPI de calidad del aire DEBERÁ comunicar la disponibilidad de datos mediante el número de distritos con datos, de forma independiente del valor del EAQI.

### Requirement 15: Datos de ejemplo etiquetados

**User Story:** Como usuario, quiero distinguir las capas sin fuente, para no interpretarlas como datos reales.

#### Acceptance Criteria

1. LA Aplicación DEBERÁ etiquetar las capas de puntos críticos e infraestructura como "datos de ejemplo (sin fuente)" en el controlador de capas y en sus tooltips, por tipo de capa y sin condición adicional, porque en este sistema ambas capas son siempre Datos_de_Ejemplo.
2. LA Aplicación DEBERÁ mantener ocultas por defecto las capas de Datos_de_Ejemplo.
3. LA Aplicación DEBERÁ excluir los Datos_de_Ejemplo del cálculo de todo KPI.

### Requirement 16: Hora de Berlín en la línea de tiempo

**User Story:** Como usuario fuera de Alemania, quiero que la línea de tiempo use la hora de Berlín, para que las series horarias coincidan con la ciudad.

#### Acceptance Criteria

1. LA Línea_de_Tiempo DEBERÁ calcular la hora actual en la zona horaria `Europe/Berlin` con independencia de la zona horaria del navegador.
2. LA Línea_de_Tiempo DEBERÁ mostrar junto a la hora la indicación de zona horaria de Berlín.
3. CUANDO el navegador está en la zona UTC−5, LA Línea_de_Tiempo DEBERÁ seleccionar la misma hora que un navegador en la zona `Europe/Berlin` en el mismo instante.

### Requirement 17: Procedencia a un clic

**User Story:** Como evaluador, quiero ver fuente, vigencia y fecha de prueba de cualquier cifra con un clic, para cumplir el piso técnico de la guía.

#### Acceptance Criteria

1. CUANDO el usuario activa el control de procedencia de una cifra del Popup_de_Distrito o de un KPI, LA Aplicación DEBERÁ abrir el Panel_de_Procedencia con nombre y url de la fuente, Vigencia, licencia y Fecha_Probado o momento de consulta.
2. LA Aplicación DEBERÁ mostrar la Vigencia junto a cada cifra del Popup_de_Distrito y de los KPIs.
3. LA Aplicación DEBERÁ mostrar el Origen_de_Dato de cada cifra.
4. LA Aplicación DEBERÁ tomar del Lago y de las respuestas de las fuentes toda cifra mostrada en textos y KPIs, sin cifras escritas en el código de las vistas.
5. LA Aplicación DEBERÁ definir cada métrica (nombre, unidad, fórmula o definición, fuente) en un único módulo de definiciones usado por todas las vistas.
6. LA Aplicación DEBERÁ hacer accesibles por teclado los controles de procedencia y DEBERÁ dotarlos de un nombre accesible.

### Requirement 18: Licencias y atribución

**User Story:** Como responsable del proyecto, quiero cumplir las licencias de cada fuente, para poder publicar la aplicación legalmente.

#### Acceptance Criteria

1. LA Aplicación DEBERÁ mostrar la atribución dl-de-by-2.0 a SenMVKU en las vistas que usan Fuente_Tráfico o Fuente_Luftgüte.
2. LA Aplicación DEBERÁ mostrar la atribución "Amt für Statistik Berlin-Brandenburg, CC BY 3.0 DE" en las vistas que usan Fuente_Población.
3. LA Aplicación DEBERÁ mostrar la atribución de OpenStreetMap y OpenFreeMap en el mapa.
4. LA Aplicación DEBERÁ mostrar la atribución "Open-Meteo, CC BY 4.0" en las vistas que usan Open_Meteo.
5. EL README DEBERÁ indicar que el nivel gratuito de Open_Meteo es de uso no comercial.
6. EL pie de la barra lateral DEBERÁ listar las fuentes con estado `integrado` con su atribución y DEBERÁ eliminar la mención a OpenAQ como fuente integrada.
7. EL pie de la barra lateral DEBERÁ mostrar las fuentes del Catálogo con estado `candidato`, `caído`, `excluido` o `declarado` junto con su Estado_de_Fuente.
8. EL pie de la barra lateral DEBERÁ marcar visualmente las fuentes no integradas como no integradas o pendientes, de forma distinguible de las fuentes con estado `integrado`.

### Requirement 19: Huecos declarados en la aplicación

**User Story:** Como usuario, quiero saber qué métricas no tienen fuente, para entender los límites del tablero.

#### Acceptance Criteria

1. LA Aplicación DEBERÁ mostrar una Lista_de_Huecos con cada métrica retirada o sin fuente (edad mediana, demanda energética, uso horario de bicis, puntos críticos, infraestructura) y el motivo.
2. LA Lista_de_Huecos DEBERÁ indicar la cobertura parcial de los datos de edad y la indisponibilidad de VBB transport.rest y de Einwohner LOR CSV.
3. LA Aplicación DEBERÁ excluir de las vistas toda métrica sin fuente verificable, salvo las capas de Datos_de_Ejemplo etiquetadas.
4. LA Aplicación DEBERÁ mostrar las capas de Datos_de_Ejemplo únicamente cuando el usuario las activa explícitamente en el controlador de capas.
5. CUANDO la Aplicación muestra métricas verificables, LA Aplicación DEBERÁ mantener ocultas las capas de Datos_de_Ejemplo que el usuario no ha activado.

### Requirement 20: Fuentes en vivo, respaldo y pruebas

**User Story:** Como desarrollador, quiero que las fuentes en vivo degraden a datos simulados etiquetados y que el comportamiento esté probado, para mantener la aplicación estable.

#### Acceptance Criteria

1. LA Aplicación DEBERÁ realizar todas las peticiones HTTP en tiempo de ejecución mediante safeFetchJson y sin claves de API.
2. SI una fuente en vivo (Open_Meteo, Fuente_Luftgüte, VBB transport.rest, nextbike GBFS) no responde, ENTONCES LA Aplicación DEBERÁ usar datos mock etiquetados con Origen_de_Dato `simulado`.
3. LA función `fetchDistricts` DEBERÁ devolver los datos del Lago con Origen_de_Dato `snapshot`, Vigencia y Fecha_Probado.
4. EL repositorio DEBERÁ incluir pruebas Vitest con safeFetchJson simulado para el Módulo_EAQI (incluido el caso de valor 44 y los límites de banda), la asociación por Código_de_Distrito, el fallo parcial y total de Open_Meteo, los contaminantes ausentes, la Capa_de_Estaciones, la hora de Berlín y los KPIs.
5. CUANDO se ejecuta `docker compose --profile dev run --rm web-dev npm run test`, EL conjunto de pruebas DEBERÁ terminar sin fallos.
6. CUANDO se ejecuta la construcción de producción, LA Aplicación DEBERÁ compilar sin errores de TypeScript ni de ESLint.
7. MIENTRAS el mapa 3D con relieve Terrarium está activo, LA Aplicación DEBERÁ dibujar cada punto de las capas de datos a la elevación del terreno en la coordenada de ese punto, en lugar de a una altitud fija común.
8. MIENTRAS el mapa 3D con relieve Terrarium está activo, SI la elevación del terreno en la coordenada de un punto aún no está disponible (por ejemplo, porque las teselas no se han cargado), LA Aplicación DEBERÁ dibujar ese punto a nivel del suelo (elevación 0 m) como altura de respaldo.
9. MIENTRAS el mapa 3D con relieve Terrarium está activo, CUANDO la elevación del terreno en la coordenada de un punto pasa a estar disponible, LA Aplicación DEBERÁ actualizar la altura de ese punto a la elevación del terreno.

### Requirement 21: README según la guía

**User Story:** Como evaluador, quiero un README con las secciones de la guía, para revisar fuentes, huecos, permisos y reproducibilidad en un solo lugar.

#### Acceptance Criteria

1. EL README DEBERÁ incluir el recuento y la lista de fuentes catalogadas, integradas, caídas y descartadas, coherente con el Catálogo.
2. EL README DEBERÁ incluir una sección de huecos coherente con la Lista_de_Huecos.
3. EL README DEBERÁ incluir una tabla "¿Se puede usar?" con fuente, licencia, atribución requerida, condición de uso y Estado_de_Fuente.
4. EL README DEBERÁ incluir los comandos para borrar el Lago, reconstruirlo con los Scripts_de_Ingesta y ejecutar el Verificador.
5. EL README DEBERÁ incluir una bitácora de uso de IA.
6. EL README DEBERÁ registrar la decisión de servir el Lago verificado en lugar de una ruta API en vivo, con el motivo.
7. EL README DEBERÁ describir la anatomía del repositorio: `ingesta/`, `catalogo/`, `lago/` (con `lago/raw`) y `verificacion/`.

### Requirement 22: Actualización del diccionario de datos

**User Story:** Como estudiante del taller, quiero el diccionario de datos actualizado, para entregar documentación coherente con el código.

#### Acceptance Criteria

1. CUANDO las demás tareas estén completas, EL Diccionario_de_Datos DEBERÁ actualizarse en la hoja Fuentes con las fuentes del Catálogo y su Estado_de_Fuente.
2. CUANDO las demás tareas estén completas, EL Diccionario_de_Datos DEBERÁ actualizarse en la hoja Diccionario con cada campo del Lago (nombre, tipo, unidad, definición, fuente, Vigencia) y sin el campo edad mediana.
3. CUANDO las demás tareas estén completas, EL Diccionario_de_Datos DEBERÁ registrar en la hoja Bitácora IA las decisiones de esta especificación, incluido el ajuste respecto a la ruta API en vivo.
