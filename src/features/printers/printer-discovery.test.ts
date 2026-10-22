import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  filterPrinters,
  printerMetadata,
  RESULT_LIMIT,
} from "./printer-discovery.ts";
describe("printer discovery", () => {
  it("limits a large catalogue by default in the UI", () => {
    expect(filterPrinters(EMPTY_FILTERS).length).toBeGreaterThan(RESULT_LIMIT);
    expect(RESULT_LIMIT).toBe(4);
  });
  it("finds aliases and punctuation-insensitive names", () => {
    expect(
      filterPrinters({ ...EMPTY_FILTERS, query: "LP90" }).map((m) => m.id),
    ).toEqual(["p12"]);
    expect(
      filterPrinters({ ...EMPTY_FILTERS, query: "LuckP_D1S" }).map((m) => m.id),
    ).toEqual(["luckp-d1s"]);
    expect(
      filterPrinters({ ...EMPTY_FILTERS, query: "450 Turbo" }).map((m) => m.id),
    ).toEqual(["dymo-450-turbo", "dymo-450-twin"]);
  });
  it("combines brand, resolution, paper and size filters", () => {
    const results = filterPrinters({
      ...EMPTY_FILTERS,
      brand: "dymo",
      dpi: "300",
      size: "shipping",
    });
    expect(results.map((m) => m.id)).toEqual(["dymo-4xl", "dymo-5xl"]);
    expect(
      filterPrinters({
        ...EMPTY_FILTERS,
        brand: "marklife",
        paper: "continuous",
      }).every((m) => m.config.supportedPaperTypes.includes("continuous")),
    ).toBe(true);
    expect(
      filterPrinters({ ...EMPTY_FILTERS, brand: "dymo", dpi: "203" }),
    ).toEqual([]);
  });
  it("does not equate connection hardware with app printing support", () => {
    expect(
      filterPrinters({ ...EMPTY_FILTERS, connection: "wifi" }).every(
        (m) => m.designOnly,
      ),
    ).toBe(true);
    expect(filterPrinters({ ...EMPTY_FILTERS, connection: "wifi" })).toEqual(
      [],
    );
    expect(
      filterPrinters({ ...EMPTY_FILTERS, connection: "lan" }).map((m) => m.id),
    ).toEqual(["dymo-550-turbo", "dymo-5xl"]);
    expect(printerMetadata("fichero-d11s").connections).toEqual([
      "ble",
      "classic",
    ]);
    expect(printerMetadata("fichero-d11s").designOnly).toBe(true);
  });
});
