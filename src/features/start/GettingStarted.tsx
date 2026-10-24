import { useT } from "../../lib/i18n.ts";
import { useState } from "react";
import { LayoutTemplate, Ruler, X } from "lucide-react";
import { useEditorV2Store } from "../../store/editor-store.ts";

export function GettingStarted() {
  const tx = useT();
  const empty = useEditorV2Store(
    (state) => state.elements.length === 0 && state.currentLabelId === null,
  );
  const [dismissed, setDismissed] = useState(false);
  if (!empty || dismissed) return null;
  return (
    <aside className="studio-get-started" aria-label={tx("Start je label")}>
      <div>
        <strong>{tx("Wat wil je maken?")}</strong>
        <p>
          {tx(
            "Kies eerst een formaat of begin met een sjabloon. Je kunt alles later aanpassen.",
          )}{" "}
        </p>
      </div>
      <div className="studio-get-started-actions">
        <button
          onClick={() =>
            window.dispatchEvent(new Event("label-studio:open-formats"))
          }
        >
          <Ruler size={16} />
          {tx("Kies een formaat")}{" "}
        </button>
        <button
          onClick={() =>
            window.dispatchEvent(new Event("label-studio:open-templates"))
          }
        >
          <LayoutTemplate size={16} />
          {tx("Kies een sjabloon")}{" "}
        </button>
      </div>
      <button
        className="studio-get-started-close"
        aria-label={tx("Starthulp verbergen")}
        onClick={() => setDismissed(true)}
      >
        <X size={14} />
      </button>
    </aside>
  );
}
