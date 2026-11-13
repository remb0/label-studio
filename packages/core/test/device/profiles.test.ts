import { describe, expect, it } from "vitest";
import {
  findDeviceByName,
  getRegisteredDevices,
} from "../../src/device/registry.js";
import type { LabelSizePreset } from "../../src/device/types.js";

const sameSize = (a: LabelSizePreset, b: LabelSizePreset) =>
  a.widthMm === b.widthMm && a.heightMm === b.heightMm;

describe("built-in device profiles", () => {
  const profiles = getRegisteredDevices();

  it("have unique model IDs", () => {
    const ids = profiles.map((p) => p.modelId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(profiles.map((p) => [p.modelId, p] as const))(
    "%s has a self-consistent label configuration",
    (_id, profile) => {
      const config = profile.labelConfig;
      expect(config).toBeDefined();
      if (!config) return;
      expect(config.supportedPaperTypes).toContain(config.defaultPaperType);
      expect(config.supportedPaperTypes).toContain(profile.defaults.paperType);
      if (!config.supportedPaperTypes.includes("continuous"))
        expect(config.continuousSizes).toEqual([]);
      const defaultList =
        config.defaultPaperType === "gap"
          ? config.gapSizes
          : config.continuousSizes;
      expect(defaultList.some((s) => sameSize(s, config.defaultSize))).toBe(
        true,
      );
      for (const list of [config.gapSizes, config.continuousSizes]) {
        for (const size of list) {
          expect(size.widthMm).toBeGreaterThan(0);
          expect(size.heightMm).toBeGreaterThan(0);
        }
        const keys = list.map((s) => `${s.widthMm}x${s.heightMm}`);
        expect(new Set(keys).size).toBe(keys.length);
      }
    },
  );

  it.each(profiles.map((p) => [p.modelId, p] as const))(
    "%s has sane transport and print defaults",
    (_id, profile) => {
      expect([1, 2, 3]).toContain(profile.defaults.density);
      if (profile.packetSize !== undefined)
        expect(profile.packetSize).toBeGreaterThanOrEqual(20);
      if (profile.printWidth !== undefined) {
        expect(profile.printWidth % 8).toBe(0);
        expect(profile.dpi).toBeGreaterThan(0);
      }
      expect(profile.namePrefixes.length).toBeGreaterThan(0);
    },
  );

  it("resolves every advertised name prefix to its own profile", () => {
    for (const profile of profiles)
      for (const prefix of profile.namePrefixes) {
        expect(findDeviceByName(prefix)?.modelId, prefix).toBe(profile.modelId);
        expect(findDeviceByName(`${prefix}_ABCD`)?.modelId, prefix).toBe(
          profile.modelId,
        );
      }
  });
});
