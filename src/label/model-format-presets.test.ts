import { describe, expect, it } from "vitest";
import { getFormatPresets } from "./format-presets.ts";

describe("model-specific format choices", () => {
  it("shows only known media for a specific printer", () => {
    const dymo = getFormatPresets("dymo-550");
    expect(dymo.some((p) => p.widthMm === 57 && p.heightMm === 32)).toBe(true);
    expect(dymo.some((p) => p.widthMm === 102 && p.heightMm === 152)).toBe(false);
    expect(dymo.every((p) => p.paperType === "gap")).toBe(true);

    const wide = getFormatPresets("dymo-5xl");
    expect(wide.some((p) => p.widthMm === 102 && p.heightMm === 152)).toBe(true);

    const fichero = getFormatPresets("fichero-d11s");
    expect(fichero).toHaveLength(1);
    expect(fichero[0]).toMatchObject({ widthMm: 14, heightMm: 30, paperType: "gap" });
  });

  it("keeps supported protocol models and unrestricted automatic mode", () => {
    expect(getFormatPresets("luckp-d1s").every((p) => p.widthMm === 48)).toBe(true);
    expect(getFormatPresets(null).length).toBeGreaterThan(getFormatPresets("luckp-d1s").length);
  });
});
