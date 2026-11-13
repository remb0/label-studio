import type { DeviceProfile } from "../types.js";
import { l11GapSizes as gapSizes } from "./l11-sizes.js";

export const p15Profile: DeviceProfile = {
  modelId: "p15",
  protocolId: "l11",
  serviceUuid: "0000ff00-0000-1000-8000-00805f9b34fb",
  characteristics: {
    tx: "0000ff02-0000-1000-8000-00805f9b34fb",
    rx: "0000ff01-0000-1000-8000-00805f9b34fb",
    cx: "0000ff03-0000-1000-8000-00805f9b34fb",
  },
  packetSize: 95,
  flowControl: {
    packetDelayMs: 30,
  },
  defaults: { density: 2, paperType: "gap" },
  densityCommand: "thickness",
  namePrefixes: [
    "P15",
    "P15R",
    "P15S",
    "P7",
    "iSPACE_LP15",
    "OUT_LPC",
    "M1",
    "LP15",
    "S15",
    "S12",
    "P1s",
    "LPC74",
  ],
  labelConfig: {
    supportedPaperTypes: ["gap"],
    defaultPaperType: "gap",
    gapSizes,
    continuousSizes: [],
    defaultSize: { widthMm: 40, heightMm: 12 },
  },
};
