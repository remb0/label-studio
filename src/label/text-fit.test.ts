import { describe, expect, it } from "vitest";
import { elementInsideLabel, fitTextSize } from "./text-fit.ts";
import type { LabelSize } from "../store/editor-store.ts";

const label: LabelSize = {
  widthMm: 25,
  heightMm: 25,
  widthPx: 200,
  heightPx: 200,
  shape: "rectangle",
};
const box = { x: 20, y: 20, width: 50, height: 30, rotation: 0 };

describe("automatic text fitting", () => {
  it("never enlarges imported text smaller than the normal minimum", () => {
    expect(
      fitTextSize(2, 100, 40, (size) => ({ width: size * 4, height: size })),
    ).toEqual({ fontSize: 2, fits: true });
    expect(
      fitTextSize(2, 1, 1, (size) => ({ width: size, height: size })),
    ).toEqual({ fontSize: 2, fits: false });
  });
  it("preserves requested size when it fits and never enlarges", () => {
    expect(
      fitTextSize(18, 100, 40, (size) => ({ width: size * 4, height: size })),
    ).toEqual({ fontSize: 18, fits: true });
  });
  it("finds a smaller size that fits both dimensions", () => {
    const result = fitTextSize(30, 80, 20, (size) => ({
      width: size * 8,
      height: size * 2,
    }));
    expect(result.fits).toBe(true);
    expect(result.fontSize).toBeCloseTo(10, 1);
    expect(result.fontSize).toBeLessThanOrEqual(10);
  });
  it("reports impossible fits without silently dropping content", () => {
    expect(
      fitTextSize(18, 2, 2, (size) => ({ width: size, height: size })),
    ).toEqual({ fontSize: 4, fits: false });
  });
  it("handles multiline wrapping discontinuities", () => {
    const result = fitTextSize(24, 80, 25, (size) => ({
      width: 70,
      height: size * (size > 12 ? 3 : 2),
    }));
    expect(result.fits).toBe(true);
    expect(result.fontSize).toBeLessThanOrEqual(12);
    expect(result.fontSize).toBeGreaterThan(11.9);
  });
});

describe("paper clipping checks", () => {
  it("accepts rectangle boundaries but catches negative coordinates", () => {
    expect(elementInsideLabel(box, label)).toBe(true);
    expect(elementInsideLabel({ ...box, x: -1 }, label)).toBe(false);
    expect(elementInsideLabel({ ...box, x: 160 }, label)).toBe(false);
  });
  it("rotates corners around element origin", () => {
    expect(elementInsideLabel({ ...box, rotation: 90 }, label)).toBe(false);
    expect(elementInsideLabel({ ...box, x: 40, rotation: 90 }, label)).toBe(
      true,
    );
  });
  it("rejects boxes cut by circle and rounded corners", () => {
    expect(
      elementInsideLabel({ ...box, x: 0, y: 0 }, { ...label, shape: "circle" }),
    ).toBe(false);
    expect(
      elementInsideLabel(
        { ...box, x: 75, y: 75 },
        { ...label, shape: "circle" },
      ),
    ).toBe(true);
    expect(
      elementInsideLabel(
        { ...box, x: 0, y: 0 },
        { ...label, shape: "rounded" },
      ),
    ).toBe(false);
  });
});
