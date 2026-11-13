import { describe, expect, it } from "vitest";
import {
  FORMAT_PRESETS,
  applyFormat,
  exceedsPrintWidth,
  presetRollWidth,
  rollAxes,
  selectFormat,
  tiltLabel,
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

describe("continuous roll formats", () => {
  const base = resizeLabel(
    { widthMm: 48, heightMm: 56, widthPx: 0, heightPx: 0, dpi: 203 },
    48,
    56,
  );
  const roll = FORMAT_PRESETS.find((preset) => preset.id === "continuous")!;
  const small = FORMAT_PRESETS.find(
    (preset) => preset.id === "continuous-small",
  )!;

  it("maps label axes onto the roll width and the free length", () => {
    expect(rollAxes(base, "vertical")).toEqual({ acrossMm: 48, alongMm: 56 });
    expect(rollAxes(base, "horizontal")).toEqual({ acrossMm: 56, alongMm: 48 });
    expect(presetRollWidth(roll)).toBe(48);
    expect(presetRollWidth(small)).toBe(15);
  });

  it("tilts the design while the roll width stays across the head", () => {
    const tilted = tiltLabel(base, "vertical");
    expect(tilted.rollDirection).toBe("horizontal");
    expect([tilted.label.widthMm, tilted.label.heightMm]).toEqual([56, 48]);
    expect(rollAxes(tilted.label, tilted.rollDirection).acrossMm).toBe(48);
  });

  it("keeps the chosen length when switching between rolls", () => {
    const long = resizeLabel(base, 120, 48);
    const next = selectFormat(
      { label: long, paperType: "continuous", rollDirection: "horizontal" },
      roll,
    );
    expect(next.rollDirection).toBe("horizontal");
    expect([next.label.widthMm, next.label.heightMm]).toEqual([120, 48]);
    const narrower = selectFormat(
      { label: long, paperType: "continuous", rollDirection: "horizontal" },
      small,
    );
    expect([narrower.label.widthMm, narrower.label.heightMm]).toEqual([
      120, 15,
    ]);
  });

  it("applies the whole preset when coming from gap labels", () => {
    const next = selectFormat(
      { label: base, paperType: "gap", rollDirection: "horizontal" },
      roll,
    );
    expect(next).toMatchObject({
      paperType: "continuous",
      rollDirection: "vertical",
    });
    expect([next.label.widthMm, next.label.heightMm]).toEqual([48, 56]);
  });
});
