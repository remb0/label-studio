import { formatDate, useLanguage, useT } from "../../lib/i18n.ts";
import { useEffect, useState, useSyncExternalStore } from "react";
import { DraftAutosaver } from "../../lib/drafts.ts";
import { useEditorV2Store } from "../../store/editor-store.ts";

export function DraftRecovery() {
  const tx = useT();
  const language = useLanguage((s) => s.language);
  const [autosaver] = useState(() => {
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      /* Report on first write. */
    }
    return new DraftAutosaver(useEditorV2Store, storage);
  });
  const status = useSyncExternalStore(
    autosaver.subscribe,
    autosaver.getSnapshot,
  );
  useEffect(() => {
    const stop = autosaver.start();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") autosaver.flush();
    };
    window.addEventListener("pagehide", autosaver.flush);
    window.addEventListener("beforeunload", autosaver.flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      window.removeEventListener("pagehide", autosaver.flush);
      window.removeEventListener("beforeunload", autosaver.flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [autosaver]);

  if (status.pending)
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="draft-title"
          onKeyDown={(event) => {
            // Keep editor shortcuts and keyboard navigation behind recovery disabled.
            event.stopPropagation();
            if (event.key !== "Tab") return;
            const buttons = event.currentTarget.querySelectorAll("button");
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }}
          className="max-w-md rounded-2xl border border-ink-600 bg-ink-900 p-6 shadow-2xl"
        >
          <h2 id="draft-title" className="text-lg font-semibold text-ink-50">
            {tx("Niet-opgeslagen concept gevonden")}{" "}
          </h2>
          <p className="mt-3 text-sm text-ink-200">
            {tx("draftRecoveryBody", {
              name: status.pending.document.name,
              date: formatDate(language, status.pending.savedAt),
            })}
          </p>
          <p className="mt-2 text-xs text-ink-400">
            {tx(
              "Herstellen opent een bewerkbare kopie. Opgeslagen sjablonen blijven ongewijzigd; er wordt niets geprint of verbonden.",
            )}{" "}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              autoFocus
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-ink-950"
              onClick={() => {
                autosaver.restore();
                useEditorV2Store.temporal.getState().clear();
              }}
            >
              {tx("Concept herstellen")}{" "}
            </button>
            <button
              className="rounded-lg border border-ink-600 px-4 py-2 text-sm text-ink-100"
              onClick={autosaver.discard}
            >
              {tx("Concept verwijderen")}{" "}
            </button>
          </div>
        </section>
      </div>
    );
  if (status.error)
    return (
      <p
        role="alert"
        className="fixed bottom-12 right-3 z-30 max-w-sm rounded-lg border border-amber-600 bg-ink-900 p-3 text-xs text-amber-200"
      >
        {tx(status.error)}
      </p>
    );
  if (status.savedAt)
    return (
      <p
        role="status"
        className="pointer-events-none fixed bottom-12 right-3 z-20 rounded-lg border border-ink-700 bg-ink-900/95 px-3 py-2 text-xs text-ink-300"
      >
        {tx("Concept automatisch bewaard · alleen in deze browser")}{" "}
      </p>
    );
  return null;
}
