import { create } from "zustand";
import type { BlePeripheral, PrinterStatus } from "@thermoprint/core";
import { getDevice } from "@thermoprint/core";
import type { PrintSettings } from "./types.ts";
import {
  loadPreferredPrinterChoice,
  savePreferredPrinterModel,
  savePrinterProfile,
} from "../lib/printer-profiles.ts";
import { isPrintSessionBusy } from "../lib/print-session.ts";
import {
  getModelLabelConfig,
  getDesignModelConfig,
  isDesignOnlyModel,
} from "../features/printers/model-catalog.ts";

interface PrinterState {
  peripheral: BlePeripheral | null;
  isConnected: boolean;
  isConnecting: boolean;
  isScanning: boolean;
  isPrinting: boolean;
  status: PrinterStatus | null;
  battery: number;
  printProgress: { bytesSent: number; totalBytes: number } | null;
  error: string | null;

  modelId: string | null;
  preferredModelId: string | null;
  hasConfirmedPrinterChoice: boolean;
  autoDetectedModelId: string | null;
  deviceModel: string | null;
  deviceInfo: {
    firmware: string | null;
    serial: string | null;
    mac: string | null;
    btVersion: string | null;
    btName: string | null;
    speed: string | null;
  };
  printerStatus: string | null;

  settings: PrintSettings;

  setPeripheral: (p: BlePeripheral | null) => void;
  setConnected: (v: boolean) => void;
  setConnecting: (v: boolean) => void;
  setScanning: (v: boolean) => void;
  setPrinting: (v: boolean) => void;
  setStatus: (s: PrinterStatus | null) => void;
  setBattery: (b: number) => void;
  setPrintProgress: (
    p: { bytesSent: number; totalBytes: number } | null,
  ) => void;
  setError: (e: string | null) => void;
  setModelId: (id: string | null) => void;
  selectPreferredModel: (id: string | null) => void;
  updateSettings: (patch: Partial<PrintSettings>) => void;
}

export function applyModelDefaults(modelId: string): void {
  if (isPrintSessionBusy()) return;
  const profile = getDevice(modelId);
  const lc = getModelLabelConfig(modelId);
  if (!lc) return;

  usePrinterStore.getState().updateSettings({
    paperType: lc.defaultPaperType,
    density: (profile?.defaults.density ?? 2) as 1 | 2 | 3,
    printWidth:
      profile?.printWidth ?? getDesignModelConfig(modelId)?.printWidth ?? 384,
  });
}

const preferredChoice = loadPreferredPrinterChoice();
const preferredModelId = preferredChoice.modelId;
const preferredProfile = preferredModelId ? getDevice(preferredModelId) : null;

export const usePrinterStore = create<PrinterState>((set) => ({
  peripheral: null,
  isConnected: false,
  isConnecting: false,
  isScanning: false,
  isPrinting: false,
  status: null,
  battery: -1,
  printProgress: null,
  error: null,

  modelId: null,
  preferredModelId,
  hasConfirmedPrinterChoice: preferredChoice.confirmed,
  autoDetectedModelId: null,
  deviceModel: null,
  deviceInfo: {
    firmware: null,
    serial: null,
    mac: null,
    btVersion: null,
    btName: null,
    speed: null,
  },
  printerStatus: null,

  settings: {
    density: (preferredProfile?.defaults.density ?? 2) as 1 | 2 | 3,
    paperType: preferredProfile?.labelConfig?.defaultPaperType ?? "gap",
    ditherMode: "floyd-steinberg",
    threshold: 128,
    printWidth: preferredProfile?.printWidth ?? 384,
  },

  setPeripheral: (peripheral) => set({ peripheral }),
  setConnected: (isConnected) => set({ isConnected }),
  setConnecting: (isConnecting) => set({ isConnecting }),
  setScanning: (isScanning) => set({ isScanning }),
  setPrinting: (isPrinting) => set({ isPrinting }),
  setStatus: (status) => set({ status }),
  setBattery: (battery) => set({ battery }),
  setPrintProgress: (printProgress) => set({ printProgress }),
  setError: (error) => set({ error }),
  setModelId: (modelId) => set({ modelId }),
  selectPreferredModel: (preferredModelId) => {
    const state = usePrinterStore.getState();
    if (
      isPrintSessionBusy() ||
      state.isConnected ||
      state.isConnecting ||
      state.isScanning ||
      state.isPrinting
    )
      return;
    if (
      preferredModelId &&
      !getDevice(preferredModelId) &&
      !isDesignOnlyModel(preferredModelId)
    )
      return;
    savePreferredPrinterModel(preferredModelId);
    set({ preferredModelId, hasConfirmedPrinterChoice: true });
    if (preferredModelId) applyModelDefaults(preferredModelId);
  },
  updateSettings: (patch) =>
    set((s) => {
      const settings = { ...s.settings, ...patch };
      if (s.peripheral && s.modelId)
        savePrinterProfile({
          peripheral: s.peripheral,
          modelId: s.modelId,
          settings,
        });
      return { settings };
    }),
}));
