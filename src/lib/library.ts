import { zipSync, strToU8 } from "fflate";
import type { BaseElement, LabelSize } from "../store/editor-store.ts";
import { parseLabelSize } from "../label/document.ts";

// ---- Types ----

export interface SavedLabel {
  id: string;
  name: string;
  label: LabelSize;
  elements: BaseElement[];
  createdAt: number;
  updatedAt: number;
  settings?: {
    paperType: "gap" | "continuous";
    rollDirection: "horizontal" | "vertical";
    printSettings: { density: number; ditherMode: string; threshold: number };
  };
}

export interface Library {
  labels: SavedLabel[];
  recent: string[]; // label ids, most-recent-first
  currentLabelId: string | null;
}

// ---- LocalStorage persistence ----

const LS_KEY = "thermoprint.library.v1";

export function loadLibrary(): Library | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    // Migrate old schema if needed
    if (parsed.projects && !parsed.labels) {
      parsed.labels = parsed.projects;
      delete parsed.projects;
    }
    if (!Array.isArray(parsed.labels)) return null;
    parsed.labels = parsed.labels.map((label: SavedLabel) => ({
      ...validateSavedLabel(label),
      id: label.id,
    }));
    parsed.recent = Array.isArray(parsed.recent) ? parsed.recent : [];
    return parsed as Library;
  } catch {
    return null;
  }
}

let _saveTimer: ReturnType<typeof setTimeout> | null = null;

export function persistLibrary(lib: Library): void {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(lib));
    } catch (e) {
      console.warn("[thermoprint] library save failed:", e);
    }
    _saveTimer = null;
  }, 300);
}

// ---- JSON export ----

export function downloadLabelAsJson(label: SavedLabel): void {
  const data = {
    name: label.name,
    label: label.label,
    elements: label.elements,
    createdAt: label.createdAt,
    updatedAt: label.updatedAt,
    settings: label.settings,
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${label.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadLibraryAsZip(labels: SavedLabel[]): void {
  const files: Record<string, Uint8Array> = {};
  const usedNames = new Set<string>();

  for (const label of labels) {
    const baseName = label.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    let fileName = baseName;
    let i = 1;
    while (usedNames.has(fileName)) {
      fileName = `${baseName}_${i++}`;
    }
    usedNames.add(fileName);

    const data = {
      name: label.name,
      label: label.label,
      elements: label.elements,
      createdAt: label.createdAt,
      updatedAt: label.updatedAt,
      settings: label.settings,
    };
    files[`${fileName}.json`] = strToU8(JSON.stringify(data, null, 2));
  }

  const zipped = zipSync(files);
  const blob = new Blob([zipped.buffer as ArrayBuffer], {
    type: "application/zip",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `label-studio-bibliotheek-${new Date().toISOString().slice(0, 10)}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importLabelFromJson(
  file: File,
): Promise<Omit<SavedLabel, "id">> {
  return new Promise((resolve, reject) => {
    if (file.size > 20 * 1024 * 1024) {
      reject(new Error("Labelbestand is groter dan 20 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        resolve(
          validateSavedLabel({
            ...data,
            name: data.name || file.name.replace(/\.json$/, ""),
          }),
        );
      } catch (error) {
        reject(
          error instanceof Error ? error : new Error("Ongeldig labelbestand."),
        );
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

export function validateSavedLabel(value: unknown): Omit<SavedLabel, "id"> {
  if (!value || typeof value !== "object")
    throw new Error("Ongeldig labelbestand.");
  const data = value as SavedLabel;
  const label = parseLabelSize(data.label);
  if (!Array.isArray(data.elements) || data.elements.length > 1000)
    throw new Error("Ongeldige objectenlijst.");
  const ids = new Set<string>();
  for (const el of data.elements) {
    if (
      !el ||
      !["text", "qrcode", "barcode", "rect", "line", "image"].includes(
        el.type,
      ) ||
      typeof el.id !== "string" ||
      ids.has(el.id) ||
      ![el.x, el.y, el.width, el.height, el.rotation].every(
        (v) =>
          typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 100000,
      ) ||
      el.width <= 0 ||
      el.height < 0 ||
      !el.props ||
      typeof el.props !== "object"
    )
      throw new Error("Een labelobject is ongeldig.");
    ids.add(el.id);
    for (const key of [
      "text",
      "content",
      "fontFamily",
      "fill",
      "stroke",
      "src",
    ]) {
      if (el.props[key] !== undefined && typeof el.props[key] !== "string")
        throw new Error(`Ongeldige tekstwaarde: ${key}.`);
    }
    for (const key of [
      "fontSize",
      "strokeWidth",
      "letterSpacing",
      "fontWeight",
      "naturalWidth",
      "naturalHeight",
    ]) {
      const number = el.props[key];
      if (
        number !== undefined &&
        (typeof number !== "number" ||
          !Number.isFinite(number) ||
          Math.abs(number) > 10000)
      )
        throw new Error(`Ongeldige objectwaarde: ${key}.`);
    }
    if (
      el.props.align !== undefined &&
      !["left", "center", "right"].includes(String(el.props.align))
    )
      throw new Error("Ongeldige uitlijning.");
    if (
      el.type === "qrcode" &&
      el.props.errorCorrectionLevel !== undefined &&
      !["L", "M", "Q", "H"].includes(String(el.props.errorCorrectionLevel))
    )
      throw new Error("Ongeldige QR-instelling.");
    if (
      el.type === "barcode" &&
      el.props.format !== undefined &&
      !["CODE128", "EAN13", "UPC", "CODE39", "ITF14"].includes(
        String(el.props.format),
      )
    )
      throw new Error("Ongeldig barcodeformaat.");
    if (
      el.type === "image" &&
      (typeof el.props.src !== "string" ||
        !/^data:image\/(png|jpeg|webp|gif);base64,/.test(el.props.src))
    )
      throw new Error(
        "Afbeeldingen moeten in het labelbestand zijn ingesloten (PNG, JPEG, WebP of GIF).",
      );
  }
  const settings = data.settings;
  if (
    settings &&
    (!["gap", "continuous"].includes(settings.paperType) ||
      !["horizontal", "vertical"].includes(settings.rollDirection) ||
      !settings.printSettings ||
      ![1, 2, 3].includes(settings.printSettings.density) ||
      !["threshold", "none", "floyd-steinberg"].includes(
        settings.printSettings.ditherMode,
      ) ||
      !Number.isFinite(settings.printSettings.threshold) ||
      settings.printSettings.threshold < 0 ||
      settings.printSettings.threshold > 255)
  )
    throw new Error("Ongeldige printinstellingen.");
  return {
    name:
      typeof data.name === "string" ? data.name.slice(0, 200) : "Nieuw label",
    label,
    elements: structuredClone(data.elements),
    settings,
    createdAt: Number.isFinite(data.createdAt) ? data.createdAt : Date.now(),
    updatedAt: Date.now(),
  };
}
