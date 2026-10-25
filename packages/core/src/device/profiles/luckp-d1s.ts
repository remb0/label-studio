import type { DeviceProfile } from "../types.js";

/** 384-dot Base Lujiang printer; deliberately distinct from 96-dot D11s. */
export const luckpD1sProfile: DeviceProfile = {
  modelId: "luckp-d1s",
  protocolId: "base-lujiang",
  serviceUuid: "ff00",
  characteristics: { tx: "ff02", rx: "ff01" },
  alternateServices: [{ serviceUuid: "18f0", tx: "2af1", rx: "2af0" }],
  notificationsOptional: true,
  printWidth: 384,
  dpi: 203,
  completionMode: "transmitted",
  packetSize: 100,
  flowControl: { packetDelayMs: 50 },
  defaults: { density: 2, paperType: "gap" },
  namePrefixes: [
    "LuckP_D1",
    "LuckP-D1",
    "DP_D1",
    "DP-D1",
    "Fichero D1",
    "Fichero_D1",
    "FICHERO_5836",
  ],
  namePattern:
    "^(?:(?:luckp|dp)[_-]d1s?|fichero[ _-]d1s?|fichero_5836)(?:[_ -]|$)",
  labelConfig: {
    supportedPaperTypes: ["gap", "continuous"],
    defaultPaperType: "gap",
    gapSizes: [{ widthMm: 48, heightMm: 30 }],
    continuousSizes: [{ widthMm: 48, heightMm: 56 }],
    defaultSize: { widthMm: 48, heightMm: 30 },
  },
};
