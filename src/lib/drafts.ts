import type { EditorState } from "../store/editor-store.ts";
import { validateSavedLabel, type SavedLabel } from "./library.ts";

export const DRAFT_KEY = "label-studio.draft.v1";
export const DRAFT_DELAY_MS = 600;
const MAX_DRAFT_BYTES = 8 * 1024 * 1024;

export interface Draft {
  version: 1;
  savedAt: number;
  document: Omit<SavedLabel, "id">;
}

type DocumentState = Pick<
  EditorState,
  | "label"
  | "elements"
  | "paperType"
  | "rollDirection"
  | "printSettings"
  | "currentLabelName"
>;

export function draftDocument(state: DocumentState): Draft["document"] {
  return {
    name: state.currentLabelName,
    label: state.label,
    elements: state.elements,
    settings: {
      paperType: state.paperType,
      rollDirection: state.rollDirection,
      printSettings: state.printSettings,
    },
    createdAt: 0,
    updatedAt: 0,
  };
}

export function parseDraft(raw: string): Draft {
  if (raw.length > MAX_DRAFT_BYTES) throw new Error("Concept is te groot.");
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== "object") throw new Error("Ongeldig concept.");
  const draft = data as Draft;
  if (
    draft.version !== 1 ||
    !Number.isFinite(draft.savedAt) ||
    draft.savedAt <= 0 ||
    !draft.document?.settings
  )
    throw new Error("Ongeldig concept.");
  const document = validateSavedLabel(draft.document);
  const settings = document.settings!;
  document.settings = {
    paperType: settings.paperType,
    rollDirection: settings.rollDirection,
    printSettings: {
      density: settings.printSettings.density,
      ditherMode: settings.printSettings.ditherMode,
      threshold: settings.printSettings.threshold,
    },
  };
  // Only accept document fields. Bluetooth, active jobs and selection never recover.
  return { version: 1, savedAt: draft.savedAt, document };
}

type Store = {
  getState: () => EditorState;
  setState: (state: Partial<EditorState>) => void;
  subscribe: (
    listener: (state: EditorState, previous: EditorState) => void,
  ) => () => void;
};
export interface DraftStatus {
  pending: Draft | null;
  savedAt: number | null;
  error: string | null;
}

/** One local recovery slot, separate from the named template library. */
export class DraftAutosaver {
  private status: DraftStatus = { pending: null, savedAt: null, error: null };
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribe: (() => void) | null = null;
  private needsSave = false;
  private baseline: string;

  constructor(
    private store: Store,
    private storage: Storage | null,
  ) {
    this.baseline = JSON.stringify(draftDocument(store.getState()));
    try {
      const raw = storage?.getItem(DRAFT_KEY);
      if (raw) this.status.pending = parseDraft(raw);
    } catch {
      this.status.error =
        "Een eerder concept kon niet worden gelezen. Sla belangrijke ontwerpen ook op als sjabloon of JSON.";
    }
  }

  getSnapshot = () => this.status;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(patch: Partial<DraftStatus>) {
    this.status = { ...this.status, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  start() {
    this.unsubscribe = this.store.subscribe((state, previous) => {
      if (this.status.pending) return;
      const documentChanged =
        state.label !== previous.label ||
        state.elements !== previous.elements ||
        state.paperType !== previous.paperType ||
        state.rollDirection !== previous.rollDirection ||
        state.printSettings !== previous.printSettings ||
        state.currentLabelName !== previous.currentLabelName;
      // Explicit save/open/new/delete transitions invalidate the old recovery slot immediately.
      const cleanTransition =
        !state.currentLabelDirty &&
        (previous.currentLabelDirty ||
          state.currentLabelId !== previous.currentLabelId ||
          (state.currentLabelId !== null &&
            state.library.labels.find(
              (item) => item.id === state.currentLabelId,
            ) !==
              previous.library.labels.find(
                (item) => item.id === previous.currentLabelId,
              )) ||
          (state.elements !== previous.elements &&
            state.elements.length === 0 &&
            state.currentLabelId === null) ||
          (documentChanged && state.library !== previous.library));
      if (cleanTransition) {
        this.clear();
        this.baseline = JSON.stringify(draftDocument(state));
      } else if (documentChanged) {
        this.needsSave = true;
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => this.flush(), DRAFT_DELAY_MS);
      }
    });
    return () => {
      this.flush();
      this.unsubscribe?.();
      this.unsubscribe = null;
    };
  }
  flush = () => {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.needsSave || this.status.pending) return;
    this.needsSave = false;
    try {
      if (!this.storage) throw new Error("Opslag is niet beschikbaar.");
      const document = draftDocument(this.store.getState());
      if (JSON.stringify(document) === this.baseline) {
        this.clear();
        return;
      }
      const draft: Draft = { version: 1, savedAt: Date.now(), document };
      const raw = JSON.stringify(draft);
      parseDraft(raw);
      this.storage.setItem(DRAFT_KEY, raw);
      this.publish({ savedAt: draft.savedAt, error: null });
    } catch {
      this.publish({
        error:
          "Automatisch opslaan is niet gelukt (browseropslag vol of geblokkeerd). Bewaar je ontwerp handmatig als JSON.",
        savedAt: null,
      });
    }
  };
  private clear() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.needsSave = false;
    try {
      this.storage?.removeItem(DRAFT_KEY);
      this.publish({ pending: null, savedAt: null, error: null });
    } catch {
      this.publish({
        pending: null,
        savedAt: null,
        error:
          "Het oude concept kon niet worden verwijderd. Controleer de browseropslag.",
      });
    }
  }
  discard = () => {
    this.clear();
    this.baseline = JSON.stringify(draftDocument(this.store.getState()));
  };
  restore = () => {
    const pending = this.status.pending;
    if (!pending) return;
    const document = structuredClone(pending.document);
    this.publish({ pending: null });
    // Recover as an unsaved copy: never overwrite a named original automatically.
    this.store.setState({
      label: document.label,
      elements: document.elements,
      paperType: document.settings!.paperType,
      rollDirection: document.settings!.rollDirection,
      printSettings: document.settings!.printSettings,
      currentLabelId: null,
      currentLabelName: document.name,
      currentLabelDirty: true,
      selectedIds: [],
      editingTextId: null,
    });
    this.needsSave = true;
    this.flush();
  };
}
