# 🧠 Gemelo Digital de Berlín

Plataforma web interactiva —inspirada en el patrón de *Cerebro Lima*— que
recopila, procesa y despliega **datos públicos y de fuentes abiertas** sobre la
ciudad de **Berlín**: movilidad, calidad del aire, demografía, infraestructura y
puntos críticos, todo sobre un mapa geoespacial 2D/3D con dashboard analítico.

Interfaz moderna, responsiva y en **modo oscuro por defecto**.

![stack](https://img.shields.io/badge/Next.js-14-black) ![ts](https://img.shields.io/badge/TypeScript-5-blue) ![map](https://img.shields.io/badge/MapLibre%20%2B%20Deck.gl-9-22d3ee)

---

## ✨ Características

- **Mapa central interactivo** (MapLibre GL + Deck.gl): zoom, rotación, vista 3D, *heatmaps* y marcadores.
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
│   │   └── useTimelinePlayer.ts # Autoplay del timeline
│   ├── lib/
│   │   ├── config.ts            # Config desde env + BBOX Berlín
│   │   ├── http.ts              # safeFetchJson (timeout + fallback)
│   │   ├── format.ts            # Formatos y clasificación (AQI…)
│   │   ├── layers.ts            # Catálogo de capas + vista inicial
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
| Transporte público (U/S-Bahn, bus) | **VBB / BVG** vía [`v6.vbb.transport.rest`](https://v6.vbb.transport.rest) | `services/transit.ts` |
| Calidad del aire (PM2.5, NO2, AQI) | **OpenAQ v3** | `services/airQuality.ts` |
| Micromovilidad (bicis/scooters) | **GBFS** (Nextbike/TIER…) | `services/bikeshare.ts` |
| Catastro, demografía, uso de suelo | **Datenportal Berlin** (`daten.berlin.de` / CKAN) | `services/openData.ts` |
| Cartografía base | **OpenStreetMap** vía MapLibre | `lib/config.ts` |

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
```

---

## ⚙️ Configuración (`.env.local`)

Todas las variables son **opcionales**:

| Variable | Descripción | Por defecto |
|----------|-------------|-------------|
| `NEXT_PUBLIC_MAP_STYLE_URL` | Estilo de mapa MapLibre | demotiles (OSM) |
| `NEXT_PUBLIC_VBB_API_BASE` | Base de la API de VBB | `v6.vbb.transport.rest` |
| `NEXT_PUBLIC_OPENAQ_API_BASE` | Base de OpenAQ | `api.openaq.org/v3` |
| `OPENAQ_API_KEY` | API key de OpenAQ (si aplica) | — |
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
