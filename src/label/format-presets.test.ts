import { describe, expect, it } from "vitest";
import {
  FORMAT_PRESETS,
  applyFormat,
  exceedsPrintWidth,
} from "./format-presets.ts";
import { resizeLabel } from "./document.ts";

describe("visual format presets", () => {
  it("converts preset millimeters at document dpi and preserves other document properties", () => {
    const label = resizeLabel(
      {
        widthMm: 40,
        heightMm: 12,
        widthPx: 320,
        heightPx: 96,
        split: "vertical",
      },
      40,
      12,
      300,
    );
    expect(
      applyFormat(
        label,
        FORMAT_PRESETS.find((p) => p.id === "round")!,
      ),
    ).toMatchObject({
      widthMm: 30,
      heightMm: 30,
      widthPx: 354,
      heightPx: 354,
      dpi: 300,
      shape: "circle",
      split: "vertical",
    });
  });
  it("checks the physical printhead dimension after feed rotation", () => {
    expect(
      exceedsPrintWidth({ widthMm: 50, heightMm: 30 }, "vertical", 384),
    ).toBe(true);
    expect(
      exceedsPrintWidth({ widthMm: 50, heightMm: 30 }, "horizontal", 384),
    ).toBe(false);
    expect(
      exceedsPrintWidth({ widthMm: 48, heightMm: 56 }, "vertical", 384),
    ).toBe(false);
    expect(
      exceedsPrintWidth({ widthMm: 48, heightMm: 56 }, "horizontal", 384),
    ).toBe(true);
  });
});
