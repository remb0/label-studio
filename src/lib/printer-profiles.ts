import type { BlePeripheral } from "@thermoprint/core";
import type { PrintSettings } from "../store/types.ts";
import { getDevice } from "@thermoprint/core";
import { isDesignOnlyModel } from "../features/printers/model-catalog.ts";

export interface SavedPrinterProfile {
  peripheral: BlePeripheral;
  modelId: string;
  settings: PrintSettings;
}
const KEY = "label-studio:printer-profiles:v1";
const MODEL_KEY = "label-studio:preferred-printer:v1";

export function loadPreferredPrinterModel(): string | null {
  try {
    const modelId = localStorage.getItem(MODEL_KEY);
    return modelId && (getDevice(modelId) || isDesignOnlyModel(modelId)) ? modelId : null;
  } catch {
    return null;
  }
}

export function savePreferredPrinterModel(modelId: string | null): void {
  try {
    localStorage.setItem(MODEL_KEY, modelId ?? "");
  } catch {
    /* Optional local preference. */
  }
}

export function loadPrinterProfiles(): SavedPrinterProfile[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SavedPrinterProfile => {
      if (!item || typeof item !== "object") return false;
      const p = item as SavedPrinterProfile;
      return (
        typeof p.modelId === "string" &&
        typeof p.peripheral?.id === "string" &&
        typeof p.peripheral?.name === "string" &&
        [1, 2, 3].includes(p.settings?.density) &&
        ["gap", "continuous"].includes(p.settings.paperType) &&
        ["floyd-steinberg", "threshold", "none"].includes(
          p.settings.ditherMode,
        ) &&
        Number.isFinite(p.settings.threshold) &&
        p.settings.threshold >= 0 &&
        p.settings.threshold <= 255 &&
        Number.isInteger(p.settings.printWidth) &&
        p.settings.printWidth > 0 &&
        p.settings.printWidth <= 4096
      );
    });
  } catch {
    return [];
  }
}

export function savePrinterProfile(profile: SavedPrinterProfile): void {
  try {
    const profiles = loadPrinterProfiles().filter(
      (item) => item.peripheral.id !== profile.peripheral.id,
    );
    localStorage.setItem(KEY, JSON.stringify([...profiles, profile]));
  } catch {
    /* Storage may be unavailable or full; connecting still works. */
  }
}
