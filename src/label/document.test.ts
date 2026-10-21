import { describe, expect, it } from "vitest";
import { parseLabelSize, resizeLabel } from "./document.ts";
import { validateSavedLabel } from "../lib/library.ts";

const label = { widthMm: 40, heightMm: 12, widthPx: 320, heightPx: 96 };
const saved = {
  name: "Adres",
  label,
  elements: [],
  settings: {
    paperType: "continuous",
    rollDirection: "vertical",
    printSettings: { density: 2, ditherMode: "threshold", threshold: 128 },
  },
};

describe("document sizing and import", () => {
  it("migrates old documents and derives pixel sizes instead of trusting imports", () => {
    expect(parseLabelSize({ ...label, widthPx: 999999 })).toMatchObject({
      dpi: 203,
      widthPx: 320,
      heightPx: 96,
      shape: "rectangle",
      split: "none",
    });
  });
  it("retains physical dimensions at 300 dpi", () => {
    expect(resizeLabel(label, 40, 12, 300)).toMatchObject({
      widthMm: 40,
      heightMm: 12,
      widthPx: 472,
      heightPx: 142,
      dpi: 300,
    });
  });
  it("rejects unbounded, non-finite and unknown document properties", () => {
    for (const invalid of [
      { ...label, widthMm: 501 },
      { ...label, heightMm: NaN },
      { ...label, dpi: 600 },
      { ...label, split: "arbitrary" },
    ])
      expect(() => parseLabelSize(invalid)).toThrow();
  });
  it("keeps per-template print settings", () => {
    expect(validateSavedLabel(saved).settings).toEqual(saved.settings);
  });
  it("rejects invalid protocols, image URLs, geometry and duplicate object IDs", () => {
    const el = {
      id: "a",
      type: "image",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      rotation: 0,
      props: { src: "https://example.com/logo.png" },
    };
    expect(() => validateSavedLabel({ ...saved, elements: [el] })).toThrow();
    expect(() =>
      validateSavedLabel({
        ...saved,
        elements: [{ ...el, type: "text", x: Infinity }],
      }),
    ).toThrow();
    expect(() =>
      validateSavedLabel({
        ...saved,
        elements: [
          { ...el, type: "text" },
          { ...el, type: "text" },
        ],
      }),
    ).toThrow();
    expect(() =>
      validateSavedLabel({
        ...saved,
        settings: { ...saved.settings, printSettings: { density: 99 } },
      }),
    ).toThrow();
  });
});
