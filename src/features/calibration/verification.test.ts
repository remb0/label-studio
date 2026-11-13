import { beforeEach, describe, expect, it } from "vitest";
import {
  forgetPrinterVerification,
  loadPrinterVerification,
  mergePrinterVerifications,
  recordPrinterVerification,
  rulerTicks,
  sanitizePrinterVerifications,
} from "./verification.ts";

describe("printer verification", () => {
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

  it("records and forgets a confirmation per model", () => {
    recordPrinterVerification(
      "luckp-d1s",
      { paperType: "continuous", widthMm: 48, lengthMm: 40 },
      1_000,
    );
    expect(loadPrinterVerification("luckp-d1s")).toEqual({
      at: 1_000,
      paperType: "continuous",
      widthMm: 48,
      lengthMm: 40,
    });
    expect(loadPrinterVerification("p15")).toBeNull();
    forgetPrinterVerification("luckp-d1s");
    expect(loadPrinterVerification("luckp-d1s")).toBeNull();
  });

  it("drops invalid entries", () => {
    expect(
      sanitizePrinterVerifications({
        ok: { at: 5, paperType: "gap", widthMm: 40, lengthMm: 30 },
        badPaper: { at: 5, paperType: "roll", widthMm: 40, lengthMm: 30 },
        badSize: { at: 5, paperType: "gap", widthMm: 0, lengthMm: 30 },
        badTime: { at: -1, paperType: "gap", widthMm: 40, lengthMm: 30 },
      }),
    ).toEqual({ ok: { at: 5, paperType: "gap", widthMm: 40, lengthMm: 30 } });
    expect(sanitizePrinterVerifications([1, 2])).toEqual({});
  });

  it("keeps the newest confirmation when merging devices", () => {
    const old = { at: 1, paperType: "gap" as const, widthMm: 40, lengthMm: 30 };
    const fresh = { ...old, at: 2, widthMm: 48 };
    expect(mergePrinterVerifications({ a: old }, { a: fresh, b: old })).toEqual(
      { a: fresh, b: old },
    );
    expect(mergePrinterVerifications({ a: fresh }, { a: old })).toEqual({
      a: fresh,
    });
  });

  it("marks every millimetre, half centimetre and centimetre", () => {
    const ticks = rulerTicks(48);
    expect(ticks).toHaveLength(49);
    expect(ticks[0]).toEqual({ mm: 0, kind: "major" });
    expect(ticks[5].kind).toBe("half");
    expect(ticks[7].kind).toBe("minor");
    expect(
      ticks.filter((tick) => tick.kind === "major").map((t) => t.mm),
    ).toEqual([0, 10, 20, 30, 40]);
  });
});
