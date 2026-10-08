"use client";

import { useRef } from "react";
import { useMap } from "react-map-gl/maplibre";
import { useCityStore } from "@/store/useCityStore";
import { useCityData } from "@/hooks/useCityData";
import type { District, MapTargetKind, PinnedTarget } from "@/lib/types";

/**
 * "Explorar el mapa" (Req. 10.11, 10.12, 10.17, 12.7, 17.6): acceso por teclado
 * a los tooltips fijados sin usar el puntero. Lista 12 botones de distrito y un
 * botón por estación de aire dibujada (ya filtradas a coordenadas finitas en
 * `data.airStations`).
 *
 * Activar un botón hace lo mismo que un clic en el mapa: `pin` del objetivo con
 * `anchor = map.project(punto)` y, para distritos, abre también el
 * Popup_de_Distrito. Sin instancia de mapa o con el punto fuera del viewport la
 * tarjeta se acopla abajo a la izquierda.
 */
export function MapObjectList() {
  const { data } = useCityData();
  const map = useMap().current;
  const pin = useCityStore((s) => s.pin);
  const setSelectedDistrict = useCityStore((s) => s.setSelectedDistrict);
  const buttonsRef = useRef<Map<string, HTMLButtonElement | null>>(new Map());

  if (!data) return null;

  const districts: District[] = data.districts.features
    .map((f) => f.properties)
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));

  /** Ancla en píxeles de un punto; respaldo abajo a la izquierda. */
  function anchorFor(point: [number, number]): PinnedTarget["anchor"] {
    const m = map?.getMap();
    if (!m) return fallbackAnchor();
    const p = m.project(point);
    const { clientWidth: w, clientHeight: h } = m.getContainer();
    if (p.x < 0 || p.y < 0 || p.x > w || p.y > h) return fallbackAnchor();
    return { x: p.x, y: p.y };
  }

  function activate(kind: MapTargetKind, id: string, point: [number, number], key: string) {
    const trigger = buttonsRef.current.get(key) ?? null;
    pin({ kind, id, anchor: anchorFor(point), returnFocusTo: trigger });
    if (kind === "district") {
      const d = districts.find((x) => x.id === id);
      if (d) setSelectedDistrict(d);
    }
  }

  return (
    <section aria-labelledby="map-object-list-title" className="text-sm">
      <h3 id="map-object-list-title" className="mb-2 font-semibold text-slate-200">
        Explorar el mapa
      </h3>

      <div className="mb-3">
        <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">Distritos</p>
        <ul className="grid grid-cols-2 gap-1">
          {districts.map((d) => {
            const key = `district-${d.id}`;
            return (
              <li key={key}>
                <button
                  type="button"
                  ref={(el) => void buttonsRef.current.set(key, el)}
                  onClick={() => activate("district", d.id, d.point, key)}
                  className="w-full rounded bg-base-700/60 px-2 py-1 text-left text-slate-200 hover:bg-base-600 focus-visible:ring focus-visible:ring-accent"
                >
                  {d.name}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {data.airStations.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">
            Estaciones de aire
          </p>
          <ul className="flex flex-col gap-1">
            {data.airStations.map((s) => {
              const key = `station-${s.code}`;
              return (
                <li key={key}>
                  <button
                    type="button"
                    ref={(el) => void buttonsRef.current.set(key, el)}
                    onClick={() => activate("airStation", s.code, s.position, key)}
                    className="w-full rounded bg-base-700/60 px-2 py-1 text-left text-slate-200 hover:bg-base-600 focus-visible:ring focus-visible:ring-accent"
                  >
                    {s.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Punto fuera del viewport o sin mapa: la tarjeta se acopla abajo a la izquierda. */
function fallbackAnchor(): PinnedTarget["anchor"] {
  return { x: 16, y: typeof window !== "undefined" ? window.innerHeight - 180 : 400 };
}
