import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { District, LayerId, PinnedTarget, ProvenanceRef } from "@/lib/types";
import { LAYER_CATALOG } from "@/lib/layers";

/** Estado del Panel_EAQI (único, montado en AppShell). */
interface EaqiPanelState {
  open: boolean;
  /** Elemento al que vuelve el foco al cerrar. */
  returnFocusTo: HTMLElement | null;
}

export interface CityState {
  /** Visibilidad de cada capa. */
  layerVisibility: Record<LayerId, boolean>;
  toggleLayer: (id: LayerId) => void;
  setLayer: (id: LayerId, visible: boolean) => void;

  /** Hora seleccionada en el timeline (0-23). */
  selectedHour: number;
  setSelectedHour: (h: number) => void;

  /** Reproducción automática del timeline. */
  isPlaying: boolean;
  togglePlaying: () => void;
  setPlaying: (v: boolean) => void;

  /** Distrito seleccionado (para el popup/detalle). */
  selectedDistrict: District | null;
  setSelectedDistrict: (d: District | null) => void;

  /** Vista 3D activada. */
  is3D: boolean;
  toggle3D: () => void;

  /** Objeto del mapa fijado como tarjeta interactiva (clic o teclado). */
  pinned: PinnedTarget | null;
  pin: (t: PinnedTarget) => void;
  unpin: () => void;

  /** Panel_EAQI: definición y bandas del índice. */
  eaqiPanel: EaqiPanelState;
  /** Abre el Panel_EAQI; `trigger` es el elemento que recupera el foco al cerrar. */
  openEaqiPanel: (trigger?: HTMLElement | null) => void;
  closeEaqiPanel: () => void;

  /** Panel_de_Procedencia: referencia de la cifra consultada. */
  provenance: ProvenanceRef | null;
  openProvenance: (ref: ProvenanceRef) => void;
  closeProvenance: () => void;
}

/**
 * Visibilidad inicial de capas. Las capas de ejemplo (`example === true`) se
 * fuerzan a `false` aunque `defaultVisible` dijera otra cosa (19.4); solo las
 * activa `toggleLayer`/`setLayer(id, true)` desde un evento del usuario.
 */
function initialVisibility(): Record<LayerId, boolean> {
  return LAYER_CATALOG.reduce(
    (acc, l) => ({ ...acc, [l.id]: l.example ? false : l.defaultVisible }),
    {} as Record<LayerId, boolean>,
  );
}

/**
 * Fábrica del store de la ciudad. Devuelve un hook de zustand nuevo e
 * independiente; `createCityStore()` permite a las pruebas trabajar con un
 * store limpio sin compartir estado con la instancia de la aplicación.
 */
export function createCityStore(): UseBoundStore<StoreApi<CityState>> {
  return create<CityState>((set) => ({
    layerVisibility: initialVisibility(),
    toggleLayer: (id) =>
      set((s) => ({
        layerVisibility: { ...s.layerVisibility, [id]: !s.layerVisibility[id] },
      })),
    setLayer: (id, visible) =>
      set((s) => ({ layerVisibility: { ...s.layerVisibility, [id]: visible } })),

    // Valor determinista para evitar desajustes de hidratación (server vs client).
    // La hora real de Berlín se aplica tras el montaje (ver useTimelinePlayer).
    selectedHour: 12,
    setSelectedHour: (h) => set({ selectedHour: h }),

    isPlaying: false,
    togglePlaying: () => set((s) => ({ isPlaying: !s.isPlaying })),
    setPlaying: (v) => set({ isPlaying: v }),

    selectedDistrict: null,
    setSelectedDistrict: (d) => set({ selectedDistrict: d }),

    is3D: true,
    toggle3D: () => set((s) => ({ is3D: !s.is3D })),

    pinned: null,
    pin: (t) => set({ pinned: t }),
    unpin: () => set({ pinned: null }),

    eaqiPanel: { open: false, returnFocusTo: null },
    openEaqiPanel: (trigger = null) =>
      set({ eaqiPanel: { open: true, returnFocusTo: trigger } }),
    closeEaqiPanel: () =>
      set((s) => ({ eaqiPanel: { open: false, returnFocusTo: s.eaqiPanel.returnFocusTo } })),

    provenance: null,
    openProvenance: (ref) => set({ provenance: ref }),
    closeProvenance: () => set({ provenance: null }),
  }));
}

/** Instancia compartida por la aplicación. */
export const useCityStore = createCityStore();
