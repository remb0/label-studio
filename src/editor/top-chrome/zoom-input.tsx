import { useT } from "../../lib/i18n.ts";
import { useRef, useState } from "react";
import { useEditorV2Store } from "../../store/editor-store.ts";

/** Editable zoom percentage; commit on Enter/blur and restore on Escape. */
export function ZoomInput({ compact = false }: { compact?: boolean }) {
  const tx = useT();
  const zoom = useEditorV2Store((s) => s.zoom);
  const setZoom = useEditorV2Store((s) => s.setZoom);
  const [draft, setDraft] = useState(String(Math.round(zoom * 100)));
  const [editing, setEditing] = useState(false);
  const cancelBlur = useRef(false);

  function commit() {
    if (cancelBlur.current) {
      cancelBlur.current = false;
      setEditing(false);
      return;
    }
    const parsed = Number(draft.trim().replace("%", "").replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0) setZoom(parsed / 100);
    setEditing(false);
    setDraft(String(Math.round(useEditorV2Store.getState().zoom * 100)));
  }

  return (
    <div
      className={compact ? "flex items-center px-1" : "flex items-center px-1"}
    >
      <input
        aria-label={tx("Zoompercentage")}
        title={tx("Typ een zoompercentage en druk op Enter")}
        type="text"
        inputMode="decimal"
        value={editing ? draft : String(Math.round(zoom * 100))}
        onFocus={(event) => {
          setDraft(String(Math.round(zoom * 100)));
          setEditing(true);
          event.currentTarget.select();
        }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            cancelBlur.current = true;
            setDraft(String(Math.round(zoom * 100)));
            setEditing(false);
            event.currentTarget.blur();
          }
        }}
        className={`bg-transparent outline-none rounded text-center font-mono text-ink-200 tabular-nums focus:ring-1 focus:ring-accent ${compact ? "w-9 text-ui-2xs" : "w-11 text-ui-sm"}`}
      />
      <span
        className={
          compact ? "text-ui-2xs text-ink-400" : "text-ui-sm text-ink-400"
        }
      >
        %
      </span>
    </div>
  );
}
