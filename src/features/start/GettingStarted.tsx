import { useState } from "react";
import { LayoutTemplate, Ruler, X } from "lucide-react";
import { useEditorV2Store } from "../../store/editor-store.ts";

export function GettingStarted() {
  const empty = useEditorV2Store(
    (state) => state.elements.length === 0 && state.currentLabelId === null,
  );
  const [dismissed, setDismissed] = useState(false);
  if (!empty || dismissed) return null;
  return (
    <aside className="studio-get-started" aria-label="Start je label">
      <div>
        <strong>Wat wil je maken?</strong>
        <p>
          Kies eerst een formaat of begin met een sjabloon. Je kunt alles later
          aanpassen.
        </p>
      </div>
      <div className="studio-get-started-actions">
        <button
          onClick={() =>
            window.dispatchEvent(new Event("label-studio:open-formats"))
          }
        >
          <Ruler size={16} />
          Kies een formaat
        </button>
        <button
          onClick={() =>
            window.dispatchEvent(new Event("label-studio:open-templates"))
          }
        >
          <LayoutTemplate size={16} />
          Kies een sjabloon
        </button>
      </div>
      <button
        className="studio-get-started-close"
        aria-label="Starthulp verbergen"
        onClick={() => setDismissed(true)}
      >
        <X size={14} />
      </button>
    </aside>
  );
}
