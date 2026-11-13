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

export function loadPreferredPrinterChoice(): {
  modelId: string | null;
  confirmed: boolean;
} {
  try {
    const modelId = localStorage.getItem(MODEL_KEY);
    // An explicitly saved empty value means automatic detection; absence does not.
    if (modelId === "") return { modelId: null, confirmed: true };
    if (modelId && (getDevice(modelId) || isDesignOnlyModel(modelId)))
      return { modelId, confirmed: true };
  } catch {
    /* Optional local preference. */
  }
  return { modelId: null, confirmed: false };
}

export function loadPreferredPrinterModel(): string | null {
  return loadPreferredPrinterChoice().modelId;
}

export function savePreferredPrinterModel(modelId: string | null): void {
  try {
    localStorage.setItem(MODEL_KEY, modelId ?? "");
  } catch {
    /* Optional local preference. */
  }
}

/** Validates the parts of print settings that are safe to restore. */
export function isValidPrintSettings(value: unknown): value is PrintSettings {
  const s = value as PrintSettings | null;
  return (
    !!s &&
    typeof s === "object" &&
    [1, 2, 3].includes(s.density) &&
    ["gap", "continuous"].includes(s.paperType) &&
    ["floyd-steinberg", "threshold", "none"].includes(s.ditherMode) &&
    Number.isFinite(s.threshold) &&
    s.threshold >= 0 &&
    s.threshold <= 255 &&
    Number.isInteger(s.printWidth) &&
    s.printWidth > 0 &&
    s.printWidth <= 4096
  );
}

function pickSettings(s: PrintSettings): PrintSettings {
  return {
    density: s.density,
    paperType: s.paperType,
    ditherMode: s.ditherMode,
    threshold: s.threshold,
    printWidth: s.printWidth,
  };
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
        isValidPrintSettings(p.settings)
      );
    });
  } catch {
    return [];
  }
}

export function savePrinterProfile(profile: SavedPrinterProfile): void {
  rememberModelPrinterSettings(profile.modelId, profile.settings);
  try {
    const profiles = loadPrinterProfiles().filter(
      (item) => item.peripheral.id !== profile.peripheral.id,
    );
    localStorage.setItem(KEY, JSON.stringify([...profiles, profile]));
  } catch {
    /* Storage may be unavailable or full; connecting still works. */
  }
}

// ---- Per-model settings: device-independent, so they can sync to an account ----

const MODEL_SETTINGS_KEY = "label-studio:printer-model-settings:v1";
export type ModelPrinterSettings = Record<string, PrintSettings>;

export function sanitizeModelPrinterSettings(
  value: unknown,
): ModelPrinterSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: ModelPrinterSettings = {};
  for (const [modelId, settings] of Object.entries(value).slice(0, 100))
    if (
      modelId.length <= 120 &&
      (getDevice(modelId) || isDesignOnlyModel(modelId)) &&
      isValidPrintSettings(settings)
    )
      result[modelId] = pickSettings(settings);
  return result;
}

export function loadModelPrinterSettings(): ModelPrinterSettings {
  try {
    return sanitizeModelPrinterSettings(
      JSON.parse(localStorage.getItem(MODEL_SETTINGS_KEY) ?? "{}"),
    );
  } catch {
    return {};
  }
}

export function saveModelPrinterSettings(value: ModelPrinterSettings): void {
  try {
    localStorage.setItem(
      MODEL_SETTINGS_KEY,
      JSON.stringify(sanitizeModelPrinterSettings(value)),
    );
  } catch {
    /* Optional local preference. */
  }
}

export function rememberModelPrinterSettings(
  modelId: string,
  settings: PrintSettings,
): void {
  if (!isValidPrintSettings(settings)) return;
  saveModelPrinterSettings({
    ...loadModelPrinterSettings(),
    [modelId]: pickSettings(settings),
  });
}
