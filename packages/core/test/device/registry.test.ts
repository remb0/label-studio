import { describe, expect, it } from "vitest";
import { findDeviceByName } from "../../src/device/registry.js";

describe("exact model name boundaries", () => {
  it("keeps documented names and separated firmware suffixes", () => {
    for (const [name, id] of [
      ["M1", "p15"],
      ["M1_TEST_BLE", "p15"],
      ["P15R_TEST", "p15"],
      ["P15-TEST", "p15"],
      ["P12_TEST", "p12"],
      ["LP90_TEST", "p12"],
      ["M60_TEST", "m60"],
      ["X2_TEST", "m60"],
      ["LuckP_D1S_TEST", "luckp-d1s"],
    ]) {
      expect(findDeviceByName(name)?.modelId).toBe(id);
    }
  });
  it("never assigns the M1 or P15 driver to a longer model number", () => {
    for (const name of [
      "M110",
      "M110_TEST",
      "M120_TEST",
      "P150_TEST",
      "P120_TEST",
      "X20_TEST",
      "D11s_TEST",
      "D110_TEST",
      "B21_TEST",
      "D30_TEST",
    ]) {
      expect(findDeviceByName(name)).toBeNull();
    }
  });
});
