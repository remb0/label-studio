import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorV2Store as store } from "./editor-store.ts";

afterEach(() => {
  vi.useRealTimers();
});

describe("saved label documents", () => {
  it("restores the label resolution, geometry and print settings together", () => {
    vi.useFakeTimers();
    store.getState().newLabel();
    store.setState({
      label: {
        widthMm: 40,
        heightMm: 30,
        widthPx: 472,
        heightPx: 354,
        dpi: 300,
        shape: "rounded",
        split: "vertical",
      },
      paperType: "continuous",
      rollDirection: "vertical",
      printSettings: { density: 3, ditherMode: "threshold", threshold: 90 },
    });
    store.getState().saveLabelAs("Etiket met profiel");
    const id = store.getState().currentLabelId!;
    store.getState().newLabel();
    store.getState().openLabel(id);
    expect(store.getState()).toMatchObject({
      currentLabelName: "Etiket met profiel",
      paperType: "continuous",
      rollDirection: "vertical",
      printSettings: { density: 3, ditherMode: "threshold", threshold: 90 },
      label: { widthMm: 40, dpi: 300, shape: "rounded", split: "vertical" },
    });
    vi.clearAllTimers();
  });
});
