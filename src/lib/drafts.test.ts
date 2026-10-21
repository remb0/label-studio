import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createStore } from "zustand/vanilla";
import { useEditorV2Store, type EditorState } from "../store/editor-store.ts";
import {
  DRAFT_KEY,
  DraftAutosaver,
  draftDocument,
  parseDraft,
} from "./drafts.ts";

function setup() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  } as Storage;
  const store = createStore<EditorState>(() => structuredCloneState());
  return { values, storage, store };
}
function structuredCloneState() {
  const initial = useEditorV2Store.getInitialState();
  return {
    ...initial,
    elements: [],
    label: { ...initial.label },
    library: { labels: [], recent: [], currentLabelId: null },
  };
}
const element = {
  id: "a",
  type: "text" as const,
  x: 2,
  y: 2,
  width: 100,
  height: 30,
  rotation: 0,
  props: { text: "Concept", fontSize: 20 },
};

describe("local draft recovery", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("debounces document edits, includes format/settings, excludes hardware and selection", () => {
    const { values, storage, store } = setup();
    const autosaver = new DraftAutosaver(store, storage);
    const stop = autosaver.start();
    store.setState({
      elements: [element],
      currentLabelDirty: true,
      selectedIds: ["a"],
      printing: true,
      printer: { connected: true, name: "demo", model: "D1S", battery: 90 },
    });
    vi.advanceTimersByTime(300);
    store.setState({
      paperType: "continuous",
      rollDirection: "vertical",
      printSettings: { density: 3, threshold: 160, ditherMode: "threshold" },
    });
    vi.advanceTimersByTime(599);
    expect(values.has(DRAFT_KEY)).toBe(false);
    vi.advanceTimersByTime(1);
    const saved = parseDraft(values.get(DRAFT_KEY)!);
    expect(saved.document.settings).toEqual({
      paperType: "continuous",
      rollDirection: "vertical",
      printSettings: { density: 3, threshold: 160, ditherMode: "threshold" },
    });
    expect(saved.document.elements).toEqual([element]);
    expect(values.get(DRAFT_KEY)).not.toContain("connected");
    expect(values.get(DRAFT_KEY)).not.toContain("selectedIds");
    stop();
  });

  it("captures live updates and undo without relying on the dirty flag", () => {
    const { values, storage, store } = setup();
    store.setState({ elements: [element], currentLabelId: "original" });
    const autosaver = new DraftAutosaver(store, storage);
    const stop = autosaver.start();
    store.setState({ elements: [{ ...element, x: 30 }] });
    vi.advanceTimersByTime(600);
    expect(parseDraft(values.get(DRAFT_KEY)!).document.elements[0].x).toBe(30);
    store.setState({ elements: [element] });
    vi.advanceTimersByTime(600);
    expect(values.has(DRAFT_KEY)).toBe(false);
    stop();
  });

  it("keeps name-only and format-only edits on an empty unsaved document", () => {
    const { values, storage, store } = setup();
    const autosaver = new DraftAutosaver(store, storage);
    const stop = autosaver.start();
    store.setState({ currentLabelName: "Mijn lege ontwerp" });
    vi.advanceTimersByTime(600);
    expect(parseDraft(values.get(DRAFT_KEY)!).document.name).toBe(
      "Mijn lege ontwerp",
    );
    store.setState({ label: { ...store.getState().label, shape: "circle" } });
    vi.advanceTimersByTime(600);
    expect(parseDraft(values.get(DRAFT_KEY)!).document.label.shape).toBe(
      "circle",
    );
    stop();
  });

  it("clears pending writes and stored drafts on explicit save/open/new", () => {
    const { values, storage, store } = setup();
    const autosaver = new DraftAutosaver(store, storage);
    const stop = autosaver.start();
    store.setState({ elements: [element], currentLabelDirty: true });
    vi.advanceTimersByTime(600);
    expect(values.has(DRAFT_KEY)).toBe(true);
    store.setState({ currentLabelDirty: false, currentLabelId: "saved" });
    expect(values.has(DRAFT_KEY)).toBe(false);
    store.setState({
      elements: [{ ...element, x: 20 }],
      currentLabelDirty: true,
    });
    store.setState({
      currentLabelDirty: false,
      currentLabelId: null,
      elements: [],
    });
    vi.advanceTimersByTime(1000);
    expect(values.has(DRAFT_KEY)).toBe(false);
    stop();
  });

  it("requires a recovery choice and restores an unsaved copy without overwriting originals", () => {
    const { storage, store } = setup();
    store.setState({
      currentLabelId: "original",
      currentLabelName: "Mijn etiket",
      elements: [element],
    });
    storage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        version: 1,
        savedAt: 10,
        document: draftDocument(store.getState()),
        printer: { connected: true },
      }),
    );
    store.setState({ elements: [], currentLabelId: null });
    const autosaver = new DraftAutosaver(store, storage);
    const stop = autosaver.start();
    expect(autosaver.getSnapshot().pending).not.toBeNull();
    expect(store.getState().elements).toEqual([]);
    autosaver.restore();
    expect(store.getState()).toMatchObject({
      currentLabelId: null,
      currentLabelDirty: true,
      currentLabelName: "Mijn etiket",
      elements: [element],
      printer: { connected: false },
      printing: false,
    });
    expect(store.getState().library.labels).toEqual([]);
    expect(autosaver.getSnapshot().pending).toBeNull();
    stop();
  });

  it("clears a live-edit draft when an already-clean named document is saved", () => {
    const { values, storage, store } = setup();
    const saved = { ...draftDocument(store.getState()), id: "original" };
    store.setState({
      currentLabelId: saved.id,
      elements: [element],
      library: { labels: [saved], recent: [], currentLabelId: saved.id },
    });
    const autosaver = new DraftAutosaver(store, storage);
    const stop = autosaver.start();
    store.setState({ elements: [{ ...element, x: 30 }] });
    vi.advanceTimersByTime(600);
    expect(values.has(DRAFT_KEY)).toBe(true);
    store.setState({
      library: {
        ...store.getState().library,
        labels: [{ ...saved, elements: store.getState().elements }],
      },
    });
    expect(values.has(DRAFT_KEY)).toBe(false);
    stop();
  });

  it("does not resurrect a discarded concept after further view-only activity", () => {
    const { storage, store, values } = setup();
    storage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        version: 1,
        savedAt: 10,
        document: { ...draftDocument(store.getState()), elements: [element] },
      }),
    );
    const autosaver = new DraftAutosaver(store, storage);
    const stop = autosaver.start();
    autosaver.discard();
    store.setState({ zoom: 3, selectedIds: [] });
    vi.advanceTimersByTime(1000);
    stop();
    expect(values.has(DRAFT_KEY)).toBe(false);
    expect(new DraftAutosaver(store, storage).getSnapshot().pending).toBeNull();
  });

  it("reports blocked/quota storage without crashing and flushes before debounce on stop", () => {
    const { store, storage } = setup();
    storage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    const autosaver = new DraftAutosaver(store, storage);
    const stop = autosaver.start();
    store.setState({ elements: [element], currentLabelDirty: true });
    expect(() => stop()).not.toThrow();
    expect(autosaver.getSnapshot().error).toContain(
      "Automatisch opslaan is niet gelukt",
    );
  });

  it("rejects corrupt, unsupported and unsafe drafts", () => {
    const { store } = setup();
    const valid = {
      version: 1,
      savedAt: 10,
      document: draftDocument(store.getState()),
    };
    expect(() => parseDraft("not json")).toThrow();
    expect(() =>
      parseDraft(JSON.stringify({ ...valid, version: 2 })),
    ).toThrow();
    expect(() =>
      parseDraft(
        JSON.stringify({
          ...valid,
          document: { ...valid.document, label: { widthMm: -1 } },
        }),
      ),
    ).toThrow();
    expect(() =>
      parseDraft(
        JSON.stringify({
          ...valid,
          document: {
            ...valid.document,
            elements: [
              {
                ...element,
                type: "image",
                props: { src: "https://example.com/a.png" },
              },
            ],
          },
        }),
      ),
    ).toThrow();
  });

  it("strips injected runtime settings before recovery", () => {
    const { store } = setup();
    const document = draftDocument(store.getState());
    const parsed = parseDraft(
      JSON.stringify({
        version: 1,
        savedAt: 10,
        document: {
          ...document,
          settings: {
            ...document.settings,
            printing: true,
            printer: { connected: true },
          },
        },
      }),
    );
    expect(parsed.document.settings).not.toHaveProperty("printing");
    expect(parsed.document.settings).not.toHaveProperty("printer");
  });
});
