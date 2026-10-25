import type { DeviceProfile } from "../types.js";

/** 96-dot AiYin D11s sold as Fichero 5836; not compatible with Lujiang D1S. */
export const ficheroD11sProfile: DeviceProfile = {
  modelId: "fichero-d11s",
  protocolId: "aiyin-d11s",
  serviceUuid: "18f0",
  characteristics: { tx: "2af1", rx: "2af0" },
  alternateServices: [{ serviceUuid: "ff00", tx: "ff02", rx: "ff01" }],
  printWidth: 96,
  dpi: 203,
  completionMode: "transmitted",
  writeWithoutResponse: true,
  packetSize: 200,
  flowControl: { packetDelayMs: 20 },
  defaults: { density: 2, paperType: "gap" },
  namePrefixes: ["FICHERO_5836", "D11s_"],
  namePattern: "^(?:fichero_5836(?:[_ -]|$)|d11s_)",
  labelConfig: {
    supportedPaperTypes: ["gap"],
    defaultPaperType: "gap",
    gapSizes: [{ widthMm: 12, heightMm: 30 }],
    continuousSizes: [],
    defaultSize: { widthMm: 12, heightMm: 30 },
  },
};
