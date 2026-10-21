import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  peripheral: null as { id: string } | null,
  modelId: null as string | null,
}));
vi.mock("../../store/printer-store.ts", () => ({
  usePrinterStore: { getState: () => state },
}));
import { calibratePrinterImage } from "./print-calibration.ts";
import { saveCalibration } from "./calibration.ts";
beforeEach(() => {
  state.peripheral = null;
  state.modelId = null;
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
});
it("uses only the current physical printer's correction for both print clients", () => {
  const data = new Uint8ClampedArray(12 * 12 * 4).fill(255);
  data.set([0, 0, 0, 255], (2 * 12 + 2) * 4);
  const image = { data, width: 12, height: 12 };
  expect(calibratePrinterImage(image)).toBe(image);
  saveCalibration("printer-one", "luckp-d1s", { offsetXMm: 1, offsetYMm: 0 });
  state.peripheral = { id: "printer-one" };
  state.modelId = "luckp-d1s";
  expect(calibratePrinterImage(image).data[(2 * 12 + 10) * 4]).toBe(0);
  state.peripheral = { id: "printer-two" };
  expect(calibratePrinterImage(image)).toBe(image);
});
