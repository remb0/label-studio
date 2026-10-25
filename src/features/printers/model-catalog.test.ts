import { describe, expect, test } from "vitest";
import {
  getPrinterModelDefaults,
  PRINTER_MODELS,
  validatePrinterModel,
  pickPermittedPrinter,
} from "./model-catalog";

describe("visual printer choices", () => {
  test("reconnect honors preferred model before previously saved devices", () => {
    const luckp = { id: "luckp", name: "LuckP_D1S_F828_BLE", rssi: 0 };
    const p15 = { id: "p15", name: "P15_123", rssi: 0 };
    expect(pickPermittedPrinter([luckp, p15], "p15", "luckp")).toEqual(p15);
    expect(pickPermittedPrinter([luckp], "p15", "luckp")).toBeUndefined();
    expect(pickPermittedPrinter([luckp, p15], null, "p15")).toEqual(p15);
  });
  test("offers only registered models with supported defaults", () => {
    expect(PRINTER_MODELS.map((model) => model.id)).toEqual([
      "luckp-d1s",
      "p12",
      "p15",
      "m60",
    ]);
    for (const model of PRINTER_MODELS) {
      const config = getPrinterModelDefaults(model.id)!;
      expect(config.supportedPaperTypes).toContain(config.paperType);
      expect(config.printWidth).toBeGreaterThan(0);
      expect(config.dpi).toBe(203);
      expect(config.density).toBe(2);
    }
    expect(getPrinterModelDefaults("luckp-d1s")?.printWidth).toBe(384);
    expect(getPrinterModelDefaults("p15")?.supportedPaperTypes).toEqual([
      "gap",
    ]);
    expect(getPrinterModelDefaults("unsupported-d11s")).toBeNull();
  });
  test("recognizes devices without an explicit choice", () => {
    expect(
      validatePrinterModel(
        { name: "LuckP_D1S_F828_BLE", id: "device", rssi: 0 },
        null,
      ).modelId,
    ).toBe("luckp-d1s");
    expect(
      validatePrinterModel(
        { name: "FICHERO_5836", id: "device-5836", rssi: 0 },
        null,
      ).modelId,
    ).toBe("luckp-d1s");
    expect(
      validatePrinterModel({ name: "M60_123", id: "device", rssi: 0 }, "m60")
        .modelId,
    ).toBe("m60");
  });
  test("rejects mismatches and unknown names instead of forcing protocols", () => {
    expect(() =>
      validatePrinterModel(
        { name: "LuckP_D1S_F828_BLE", id: "device", rssi: 0 },
        "p15",
      ),
    ).toThrow("ander printerprofiel");
    expect(() =>
      validatePrinterModel(
        { name: "LuckP_D11S", id: "device", rssi: 0 },
        "luckp-d1s",
      ),
    ).toThrow("Geen ondersteund printerprofiel");
  });
});
