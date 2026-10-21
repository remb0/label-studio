import { describe, expect, it, beforeEach } from "vitest";
import {
  applyCalibration,
  loadCalibration,
  saveCalibration,
  validateCalibration,
} from "./calibration.ts";

describe("printer calibration", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
  });
  it("isolates corrections by physical device and model", () => {
    saveCalibration("a", "p12", { offsetXMm: 1, offsetYMm: -2 });
    expect(loadCalibration("a", "p12")).toEqual({
      offsetXMm: 1,
      offsetYMm: -2,
    });
    expect(loadCalibration("b", "p12").offsetXMm).toBe(0);
    expect(loadCalibration("a", "p15").offsetXMm).toBe(0);
  });
  it("rejects invalid corrections and tolerates corrupt storage", () => {
    expect(() => validateCalibration({ offsetXMm: 6, offsetYMm: 0 })).toThrow();
    expect(() =>
      validateCalibration({ offsetXMm: NaN, offsetYMm: 0 }),
    ).toThrow();
    localStorage.setItem("label-studio:calibration:v1", "broken");
    expect(loadCalibration("a", "b").offsetXMm).toBe(0);
  });
  it("moves ink in printer axes while preserving dimensions and input", () => {
    const data = new Uint8ClampedArray(4 * 4 * 4).fill(255);
    data.set([0, 0, 0, 255], (1 * 4 + 1) * 4);
    const result = applyCalibration(
      { data, width: 4, height: 4 },
      { offsetXMm: 1, offsetYMm: 1 },
      25.4,
    );
    expect(result.data[(2 * 4 + 2) * 4]).toBe(0);
    expect(result.data[(1 * 4 + 1) * 4]).toBe(255);
    expect(data[(1 * 4 + 1) * 4]).toBe(0);
    expect([result.width, result.height]).toEqual([4, 4]);
  });
  it("refuses clipped ink but permits transparent margins", () => {
    const data = new Uint8ClampedArray(16).fill(255);
    data.set([0, 0, 0, 255], 4);
    expect(() =>
      applyCalibration(
        { data, width: 2, height: 2 },
        { offsetXMm: 1, offsetYMm: 0 },
        25.4,
      ),
    ).toThrow(/afsnijden/);
    data[7] = 0;
    expect(() =>
      applyCalibration(
        { data, width: 2, height: 2 },
        { offsetXMm: 1, offsetYMm: 0 },
        25.4,
      ),
    ).not.toThrow();
  });
  it("reports storage failures instead of pretending to save", () => {
    localStorage.setItem = () => {
      throw new Error("quota");
    };
    expect(() =>
      saveCalibration("a", "p12", { offsetXMm: 0, offsetYMm: 0 }),
    ).toThrow("quota");
  });
});
