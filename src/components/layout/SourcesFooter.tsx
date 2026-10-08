import { footerSources } from "@/lib/provenance";
import { CATALOG } from "@/lib/catalog";
import type { SourceCard } from "@/lib/catalog";
import type { SourceState } from "@/lib/types";

/**
 * Pie de fuentes de la barra lateral generado con `footerSources(CATALOG)`:
 * una sección "Fuentes integradas" (nombre enlazado + atribución) y otra
 * "Catalogadas, no integradas" atenuada, con insignia de estado y el prefijo
 * textual "no integrada ·" (18.6–18.8). No usa el store ni hooks de React,
 * así que puede renderizarse con `react-dom/server` para las pruebas.
 */

const ESTADO_LABEL: Record<Exclude<SourceState, "integrado">, string> = {
  candidato: "candidata",
  caído: "caída",
  declarado: "declarada",
  excluido: "excluida",
};

export function SourcesFooter({
  catalog = CATALOG,
}: {
  catalog?: readonly SourceCard[];
}) {
  const { integrated, notIntegrated } = footerSources(catalog);

  return (
    <div className="space-y-2 text-[10px] leading-tight text-slate-500">
      <div>
        <div className="mb-1 font-semibold uppercase tracking-wide text-slate-400">
          Fuentes integradas
        </div>
        <ul className="space-y-0.5">
          {integrated.map((s) => (
            <li key={s.id}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 underline decoration-dotted underline-offset-2 hover:text-slate-200"
              >
                {s.nombre}
              </a>
              <span className="text-slate-500"> — {s.attribution}</span>
            </li>
          ))}
        </ul>
      </div>

      {notIntegrated.length > 0 && (
        <div className="text-slate-500">
          <div className="mb-1 font-semibold uppercase tracking-wide text-slate-500">
            Catalogadas, no integradas
          </div>
          <ul className="space-y-0.5">
            {notIntegrated.map((s) => (
              <li key={s.id}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-dotted underline-offset-2 hover:text-slate-300"
                >
                  {s.nombre}
                </a>
                <span> — no integrada · {ESTADO_LABEL[s.estado]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
