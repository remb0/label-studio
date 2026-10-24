import { useT } from "../lib/i18n.ts";
import { useEffect, useReducer } from "react";
import { AlertTriangle } from "lucide-react";
import { useEditorV2Store } from "../store/editor-store.ts";
import { getContentWarnings } from "../label/text-fit-layout.ts";

export function ContentWarnings() {
  const tx = useT();
  const elements = useEditorV2Store((s) => s.elements);
  const label = useEditorV2Store((s) => s.label);
  const selectOnly = useEditorV2Store((s) => s.selectOnly);
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    document.fonts.addEventListener("loadingdone", refresh);
    return () => document.fonts.removeEventListener("loadingdone", refresh);
  }, []);
  const warnings = getContentWarnings(elements, label);
  if (!warnings.length) return null;
  return (
    <aside
      role="status"
      aria-label={tx("Controle labelinhoud")}
      className="absolute top-3 left-3 z-10 max-w-[min(320px,calc(100%-24px))] rounded-lg border border-amber-400/40 bg-ink-850/95 p-3 shadow-panel text-ui-sm"
    >
      <p className="flex gap-2 font-semibold text-amber-300">
        <AlertTriangle size={15} /> {tx("Mogelijk afgesneden inhoud")}{" "}
      </p>
      <p className="mt-1 text-ink-300">
        {tx(
          "Controleer dit vóór het printen. Klik om het element te selecteren.",
        )}{" "}
      </p>
      <ul className="mt-2 max-h-32 overflow-y-auto space-y-1 text-ink-200">
        {warnings.map((warning) => (
          <li key={warning.id}>
            <button
              className="text-left hover:text-accent"
              onClick={() => selectOnly([warning.id])}
            >
              {tx(warning.localized)}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
