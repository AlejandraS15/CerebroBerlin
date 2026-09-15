import { create } from "zustand";
import type { District, LayerId } from "@/lib/types";
import { LAYER_CATALOG } from "@/lib/layers";

interface CityState {
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
}

const initialVisibility = LAYER_CATALOG.reduce(
  (acc, l) => ({ ...acc, [l.id]: l.defaultVisible }),
  {} as Record<LayerId, boolean>,
);

export const useCityStore = create<CityState>((set) => ({
  layerVisibility: initialVisibility,
  toggleLayer: (id) =>
    set((s) => ({
      layerVisibility: { ...s.layerVisibility, [id]: !s.layerVisibility[id] },
    })),
  setLayer: (id, visible) =>
    set((s) => ({ layerVisibility: { ...s.layerVisibility, [id]: visible } })),

  selectedHour: new Date().getHours(),
  setSelectedHour: (h) => set({ selectedHour: h }),

  isPlaying: false,
  togglePlaying: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setPlaying: (v) => set({ isPlaying: v }),

  selectedDistrict: null,
  setSelectedDistrict: (d) => set({ selectedDistrict: d }),

  is3D: true,
  toggle3D: () => set((s) => ({ is3D: !s.is3D })),
}));
