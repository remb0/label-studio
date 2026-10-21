import type { RawImageData } from "@thermoprint/core";

export interface Calibration {
  offsetXMm: number;
  offsetYMm: number;
}
export const NO_CALIBRATION: Calibration = { offsetXMm: 0, offsetYMm: 0 };
const KEY = "label-studio:calibration:v1";
export function validateCalibration(value: unknown): Calibration {
  const data = value as Calibration | null;
  if (
    !data ||
    ![data.offsetXMm, data.offsetYMm].every(
      (v) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 5,
    )
  )
    throw new Error("Correctie moet tussen −5 en 5 mm liggen.");
  return { offsetXMm: data.offsetXMm, offsetYMm: data.offsetYMm };
}
function readProfiles(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
function key(deviceId: string, modelId: string) {
  return JSON.stringify([deviceId, modelId]);
}
export function loadCalibration(
  deviceId: string,
  modelId: string,
): Calibration {
  try {
    return validateCalibration(readProfiles()[key(deviceId, modelId)]);
  } catch {
    return { ...NO_CALIBRATION };
  }
}
export function saveCalibration(
  deviceId: string,
  modelId: string,
  value: Calibration,
): void {
  const next = validateCalibration(value);
  localStorage.setItem(
    KEY,
    JSON.stringify({ ...readProfiles(), [key(deviceId, modelId)]: next }),
  );
}

/** Printer-axis translation, after document rotation/resampling. Never crop ink silently. */
export function applyCalibration(
  image: RawImageData,
  value: Calibration,
  dpi: number,
): RawImageData {
  const calibration = validateCalibration(value);
  const dx = Math.round((calibration.offsetXMm * dpi) / 25.4);
  const dy = Math.round((calibration.offsetYMm * dpi) / 25.4);
  if (!dx && !dy) return image;
  const { width, height } = image;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const source = (y * width + x) * 4;
      const tx = x + dx,
        ty = y + dy;
      if (tx < 0 || tx >= width || ty < 0 || ty >= height) {
        // Transparent pixels print white, regardless of their hidden RGB values.
        if (
          image.data[source + 3] > 0 &&
          Math.min(
            image.data[source],
            image.data[source + 1],
            image.data[source + 2],
          ) < 250
        )
          throw new Error(
            "Kalibratie zou inhoud afsnijden. Vergroot de marge of verklein de correctie bij Printer → Kalibratie.",
          );
        continue;
      }
      const target = (ty * width + tx) * 4;
      for (let channel = 0; channel < 4; channel++)
        data[target + channel] = image.data[source + channel];
    }
  return { data, width, height };
}
