# 🧠 Gemelo Digital de Berlín

Plataforma web interactiva —inspirada en el patrón de *Cerebro Lima*— que
recopila, procesa y despliega **datos públicos y de fuentes abiertas** sobre la
ciudad de **Berlín**: movilidad, calidad del aire, demografía, infraestructura y
puntos críticos, todo sobre un mapa geoespacial 2D/3D con dashboard analítico.

Interfaz moderna, responsiva y en **modo oscuro por defecto**.

![stack](https://img.shields.io/badge/Next.js-14-black) ![ts](https://img.shields.io/badge/TypeScript-5-blue) ![map](https://img.shields.io/badge/MapLibre%20%2B%20Deck.gl-9-22d3ee)

---

## ✨ Características

- **Mapa central interactivo** (MapLibre GL + Deck.gl): terreno 3D con relieve, edificios extruidos con su altura real (OSM), cielo con niebla de horizonte, *heatmaps* y marcadores.
- **Sidebar / Panel lateral**:
  - **Layer Control**: Movilidad, Calidad del Aire, Demografía, Infraestructura, Puntos Críticos.
  - **Dashboard analítico**: KPIs en tiempo real y gráficos dinámicos (Recharts).
- **Línea de tiempo (24h)**: slider + reproducción automática que anima la actividad urbana y sincroniza los charts.
- **Popups / Tooltips**: al pasar el cursor por estaciones/sensores y al hacer clic en distritos (Mitte, Kreuzberg, Pankow…).
- **Datos en tiempo real con fallback**: cada servicio intenta la API pública y, si falla o no hay red, usa datos *mock* coherentes. La app **funciona sin ninguna API key**.

---

## 🧱 Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Framework | **Next.js 14** (App Router) + **TypeScript** |
| Estilos | **Tailwind CSS** (dark mode por defecto) |
| Mapa / Geoespacial | **MapLibre GL** (open source, sin token) + **Deck.gl 9** |
| Visualización de datos | **Recharts** |
| Estado / Data fetching | **TanStack Query** (React Query) + **Zustand** |

> Se eligió **MapLibre** en lugar de Mapbox para no requerir tokens y alinearse
> con la filosofía de *open data*. Puedes usar un estilo propio vía
> `NEXT_PUBLIC_MAP_STYLE_URL`.

---

## 📂 Estructura del proyecto

```
berlin-digital-twin/
├── src/
│   ├── app/
│   │   ├── globals.css          # Estilos globales + dark mode
│   │   ├── layout.tsx           # Layout raíz (metadata, Providers)
│   │   ├── page.tsx             # Punto de entrada → AppShell
│   │   └── providers.tsx        # QueryClientProvider (TanStack Query)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx      # Composición general de la app
│   │   │   ├── Header.tsx        # Barra superior + toggle 3D/2D
│   │   │   └── Sidebar.tsx       # Panel lateral (capas + analítica)
│   │   ├── map/
│   │   │   ├── MapContainer.tsx  # Mapa MapLibre + overlay Deck.gl
│   │   │   ├── DeckGLOverlay.tsx # Integración Deck.gl ↔ MapLibre
│   │   │   ├── buildDeckLayers.ts# Construcción de todas las capas
│   │   │   ├── MapTooltip.tsx    # Tooltip flotante (hover)
│   │   │   └── DistrictPopup.tsx # Detalle de distrito (click)
│   │   └── panels/
│   │       ├── LayerController.tsx # Selector de capas
│   │       ├── AnalyticsPanel.tsx  # Dashboard (KPIs + charts)
│   │       ├── KpiCards.tsx        # Tarjetas KPI
│   │       └── TimelineControl.tsx # Línea de tiempo 24h
│   ├── data/
│   │   ├── districts.ts         # 12 Bezirke (GeoJSON + métricas)
│   │   └── mock.ts              # Datos de demostración / fallback
│   ├── hooks/
│   │   ├── useCityData.ts       # Query principal (fetchCityData)
│   │   ├── useAnalytics.ts      # Derivación de KPIs y series
│   │   ├── useMapStyle.ts       # Carga (una vez) el estilo 3D del mapa
│   │   └── useTimelinePlayer.ts # Autoplay del timeline
│   ├── lib/
│   │   ├── config.ts            # Config desde env + BBOX Berlín
│   │   ├── http.ts              # safeFetchJson (timeout + fallback)
│   │   ├── format.ts            # Formatos y clasificación (AQI…)
│   │   ├── layers.ts            # Catálogo de capas + vistas 2D/3D
│   │   ├── mapStyle.ts          # Estilo 3D: terreno, relieve, edificios, cielo
│   │   ├── types.ts             # Tipos centrales
│   │   └── services/
│   │       ├── airQuality.ts    # OpenAQ
│   │       ├── transit.ts       # VBB / BVG (transport.rest)
│   │       ├── bikeshare.ts     # GBFS (micromovilidad)
│   │       ├── openData.ts      # daten.berlin.de (CKAN)
│   │       └── cityData.ts      # Agregador de todos los servicios
│   └── store/
│       └── useCityStore.ts      # Estado global (Zustand)
├── .env.example
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.mjs
```

---

## 🌐 Fuentes de datos abiertos

| Dominio | Fuente | Servicio |
|---------|--------|----------|
| Transporte público (U/S-Bahn, bus) + salidas en tiempo real | **VBB / BVG** vía [`v6.vbb.transport.rest`](https://v6.vbb.transport.rest) | `services/transit.ts` |
| Calidad del aire (PM2.5, NO2, O3, AQI europeo) | **Open-Meteo Air Quality** | `services/airQuality.ts` |
| Clima (temperatura, humedad, viento) | **Open-Meteo Forecast** | `services/weather.ts` |
| Micromovilidad (bicis/scooters) | **GBFS** (Nextbike/TIER…) | `services/bikeshare.ts` |
| Catastro, demografía, uso de suelo | **Datenportal Berlin** (`daten.berlin.de` / CKAN) | `services/openData.ts` |
| Cartografía base + edificios 3D | **OpenFreeMap** (OpenMapTiles / OpenStreetMap) | `lib/mapStyle.ts` |
| Terreno (modelo de elevación) | **Mapzen / AWS Terrarium** | `lib/mapStyle.ts` |

> Los límites de distritos usan geometrías simplificadas empaquetadas para
> funcionar *offline*. Para producción, sustitúyelas por los límites oficiales
> (RBS/ALKIS) publicados en `daten.berlin.de`.

---

## 🚀 Instalación y ejecución

**Requisitos:** Node.js ≥ 18 (recomendado 20/22) y npm.

```bash
# 1. Instalar dependencias
npm install

# 2. (Opcional) Configurar variables de entorno
cp .env.example .env.local
#   La app funciona sin editar nada: usará datos mock cuando no haya red/keys.

# 3. Levantar en desarrollo
npm run dev
#   → http://localhost:3000
```

### Otros scripts

```bash
npm run build      # Build de producción
npm run start      # Servir el build
npm run lint       # ESLint (next/core-web-vitals)
npm run typecheck  # Comprobación de tipos (tsc --noEmit)
npm run test       # Tests unitarios (Vitest, ejecución única)
npm run test:watch # Tests en modo watch
```

### Tests

Los tests unitarios (Vitest) cubren la capa de datos: utilidades de formato,
mapeo y fallback de los servicios (aire, clima, transporte) y la construcción
de capas del mapa. No hacen llamadas de red reales — `safeFetchJson` se
mockea, así que corren sin conexión.

```bash
# Con Docker (sin instalar nada en tu máquina):
docker compose --profile dev run --rm web-dev npm run test

# O en local si tienes node_modules:
npm run test
```

---

## 🐳 Ejecución con Docker (sin instalar dependencias en tu máquina)

Con Docker no necesitas Node.js ni `npm install` en tu equipo: todo vive dentro
del contenedor. Solo requieres **Docker Desktop** (o Docker Engine + el plugin
`docker compose`) en ejecución.

Archivos incluidos:

| Archivo | Propósito |
|---------|-----------|
| `Dockerfile` | Imagen de **producción** optimizada (multi-stage + Next.js `standalone`) |
| `Dockerfile.dev` | Imagen de **desarrollo** con hot-reload (`next dev`) |
| `docker-compose.yml` | Orquesta ambos servicios mediante *profiles* |
| `.dockerignore` | Excluye `node_modules`, `.next`, etc. del contexto de build |

### Desarrollo (hot-reload)

```bash
docker compose --profile dev up --build
#   → http://localhost:3000
```

El código local se monta como volumen, así que los cambios se reflejan en vivo.
`node_modules` y `.next` quedan dentro del contenedor y no tocan tu máquina.

### Producción

```bash
docker compose --profile prod up --build
#   → http://localhost:3000
```

### (Opcional) Variables de entorno

Si quieres configurar APIs, copia el ejemplo; Docker lo cargará automáticamente
si el archivo existe:

```bash
cp .env.example .env.local
```

### Comandos útiles

```bash
docker compose --profile dev down      # detener y limpiar contenedores (dev)
docker compose --profile prod down     # detener y limpiar (prod)

# Construir solo la imagen de producción (sin compose)
docker build -t berlin-digital-twin .
docker run -p 3000:3000 berlin-digital-twin
```

> Nota: la app usa el output `standalone` de Next.js (configurado en
> `next.config.mjs`) para producir una imagen de producción ligera.

---

## ⚙️ Configuración (`.env.local`)

Todas las variables son **opcionales**:

| Variable | Descripción | Por defecto |
|----------|-------------|-------------|
| `NEXT_PUBLIC_MAP_STYLE_URL` | Estilo base MapLibre (esquema OpenMapTiles) | OpenFreeMap dark |
| `NEXT_PUBLIC_TERRAIN_TILES_URL` | Teselas DEM Terrarium para el terreno 3D | Mapzen/AWS Terrarium |
| `NEXT_PUBLIC_VBB_API_BASE` | Base de la API de VBB | `v6.vbb.transport.rest` |
| `NEXT_PUBLIC_AIR_QUALITY_API_BASE` | Base de Open-Meteo (aire) | `air-quality-api.open-meteo.com/v1` |
| `NEXT_PUBLIC_WEATHER_API_BASE` | Base de Open-Meteo (clima) | `api.open-meteo.com/v1` |
| `NEXT_PUBLIC_BERLIN_OPENDATA_BASE` | CKAN de Berlín | `datenregister.berlin.de/api/3` |
| `NEXT_PUBLIC_GBFS_URL` | Feed GBFS de micromovilidad | Nextbike |
| `NEXT_PUBLIC_USE_MOCK_DATA` | Forzar datos mock (`true`/`false`) | `false` |

Para trabajar **100% offline**, pon `NEXT_PUBLIC_USE_MOCK_DATA=true`.

---

## 🧩 Cómo añadir una nueva capa

1. Añade su definición en `src/lib/layers.ts` (`LAYER_CATALOG`) y su `LayerId` en `src/lib/types.ts`.
2. Crea/extiende un servicio en `src/lib/services/` y agrégalo a `cityData.ts`.
3. Añade la capa Deck.gl correspondiente en `src/components/map/buildDeckLayers.ts`.

El `LayerController` y el store la recogerán automáticamente.

---

## 📝 Notas de arquitectura

- **Resiliencia:** `safeFetchJson` aplica *timeout* y nunca lanza; cada servicio
  degrada a *mock* de forma transparente, marcando la fuente (`live`/`mock`),
  visible en los *badges* del sidebar.
- **Rendimiento:** el mapa se carga con `next/dynamic` (`ssr: false`) porque
  depende de WebGL; TanStack Query cachea y refresca en segundo plano.
- **Estado:** Zustand gestiona visibilidad de capas, hora del timeline, distrito
  seleccionado y modo 3D; separado del *server state* (TanStack Query).

---

## 📜 Licencia y atribución

Proyecto de demostración. Respeta las licencias de las fuentes de datos:
**© OpenStreetMap contributors**, VBB, OpenAQ y el Datenportal Berlin.
