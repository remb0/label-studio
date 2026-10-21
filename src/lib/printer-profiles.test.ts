import { afterEach, describe, expect, test, vi } from "vitest";
import {
  loadPrinterProfiles,
  savePrinterProfile,
  loadPreferredPrinterModel,
  savePreferredPrinterModel,
} from "./printer-profiles";
import type { SavedPrinterProfile } from "./printer-profiles";

describe("local printer profiles", () => {
  afterEach(() => vi.unstubAllGlobals());
  const profile: SavedPrinterProfile = {
    peripheral: {
      id: "browser-device-id",
      name: "LuckP_D1S_F828_BLE",
      rssi: 0,
    },
    modelId: "luckp-d1s",
    settings: {
      density: 3,
      paperType: "gap",
      ditherMode: "threshold",
      threshold: 150,
      printWidth: 384,
    },
  };
  test("keeps independent device settings and updates the most recent device", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    savePrinterProfile(profile);
    savePrinterProfile({
      ...profile,
      peripheral: { ...profile.peripheral, id: "second-device" },
    });
    savePrinterProfile({
      ...profile,
      settings: { ...profile.settings, density: 1 },
    });
    expect(loadPrinterProfiles()).toHaveLength(2);
    expect(loadPrinterProfiles().at(-1)?.settings.density).toBe(1);
    expect(loadPrinterProfiles()[0].peripheral.id).toBe("second-device");
  });
  test("ignores malformed stored profiles and restricted storage", () => {
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify([
          { ...profile, settings: { ...profile.settings, density: 99 } },
          null,
        ]),
    });
    expect(loadPrinterProfiles()).toEqual([]);
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("storage blocked");
      },
    });
    expect(() => savePrinterProfile(profile)).not.toThrow();
    expect(loadPrinterProfiles()).toEqual([]);
  });
  test("persists model preference separately from Bluetooth device profiles", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    savePreferredPrinterModel("p15");
    expect(loadPreferredPrinterModel()).toBe("p15");
    expect(loadPrinterProfiles()).toEqual([]);
    savePreferredPrinterModel(null);
    expect(loadPreferredPrinterModel()).toBeNull();
    savePreferredPrinterModel("unsupported");
    expect(loadPreferredPrinterModel()).toBeNull();
  });
});
