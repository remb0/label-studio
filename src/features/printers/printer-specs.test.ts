import { describe, expect, it } from "vitest";
import { findDeviceByName, getDevice } from "@thermoprint/core";
import {
  ALL_PRINTER_MODELS,
  getDesignModelConfig,
  isDesignOnlyModel,
} from "./model-catalog";
import { RESEARCHED_MODELS } from "./researched-models";
import { getPrinterSpecs } from "./printer-specs";
import { filterPrinters, EMPTY_FILTERS } from "./printer-discovery";

describe("source-based profile research", () => {
  it("keeps researched catalog models separate from executable drivers", () => {
    expect(ALL_PRINTER_MODELS).toHaveLength(20);
    for (const model of RESEARCHED_MODELS) {
      expect(isDesignOnlyModel(model.id)).toBe(true);
      expect(getDevice(model.id)).toBeNull();
      expect(getDesignModelConfig(model.id)?.printWidth).toBe(0);
      expect(getPrinterSpecs(model.id).sources.length).toBeGreaterThan(0);
      expect(getPrinterSpecs(model.id).checkedOn).toBe("2026-10-22");
    }
    expect(findDeviceByName("M110_TEST")).toBeNull();
  });
  it("records contradictions rather than borrowing a default or a similar model", () => {
    expect(getPrinterSpecs("phomemo-m110").headDots).toBeNull();
    expect(getPrinterSpecs("p15").headDots).toBeNull();
    expect(getPrinterSpecs("p12").evidence).toBe("conflicting");
    expect(getPrinterSpecs("action-pocket-300").dpi).toBeNull();
    expect(
      filterPrinters({ ...EMPTY_FILTERS, dpi: "300" }).some(
        (m) => m.id === "action-pocket-300",
      ),
    ).toBe(false);
    expect(getPrinterSpecs("niimbot-d11-h").dpi).toBe(300);
    expect(getPrinterSpecs("niimbot-d110").dpi).toBe(203);
    expect(getPrinterSpecs("fichero-d11s").headDots).toBe(96);
    expect(getPrinterSpecs("luckp-d1s").headDots).toBe(384);
  });
});
