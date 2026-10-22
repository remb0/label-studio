import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ALL_PRINTER_MODELS } from "./model-catalog.ts";
import { getPrinterImage, PRINTER_IMAGES } from "./printer-images.ts";

describe("model-specific product photos", () => {
  it("bundles a distinct supported image and exact-model provenance for every photo", () => {
    const sources = new Set<string>();
    for (const [id, photo] of Object.entries(PRINTER_IMAGES)) {
      expect(ALL_PRINTER_MODELS.some((model) => model.id === id)).toBe(true);
      expect(photo.source).toMatch(
        /^https:\/\/(www\.)?(dymo|marklifeprinter|niimbotlabel|phomemo|action)\.com\//,
      );
      expect(photo.checkedOn).toBe("2026-10-22");
      expect(sources.has(photo.assetSource)).toBe(false);
      sources.add(photo.assetSource);
      expect(photo.src).toMatch(/^\/printers\/[a-z0-9-]+\.(jpg|png|webp)$/);
      const file = readFileSync(`public${photo.src}`);
      if (photo.src.endsWith(".jpg"))
        expect([...file.subarray(0, 3)]).toEqual([255, 216, 255]);
      else if (photo.src.endsWith(".png"))
        expect([...file.subarray(0, 4)]).toEqual([137, 80, 78, 71]);
      else {
        expect(file.subarray(0, 4).toString()).toBe("RIFF");
        expect(file.subarray(8, 12).toString()).toBe("WEBP");
      }
      expect(file.length).toBeGreaterThan(1000);
      expect(file.length).toBeLessThan(400_000);
    }
  });

  it("never substitutes a related model, alias or unidentified product photo", () => {
    for (const id of [
      "dymo-450",
      "dymo-450-turbo",
      "dymo-4xl",
      "luckp-d1s",
      "m60",
      "action-pocket-300",
      "X2",
      "P11",
      "LP90",
      "toString",
    ])
      expect(getPrinterImage(id)).toBeNull();
    expect(getPrinterImage("dymo-450-twin")?.src).not.toBe(
      getPrinterImage("dymo-450-duo")?.src,
    );
    expect(Object.keys(PRINTER_IMAGES)).toHaveLength(14);
  });
});
