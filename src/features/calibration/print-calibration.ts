import type { RawImageData } from "@thermoprint/core";
import { getDevice } from "@thermoprint/core";
import { usePrinterStore } from "../../store/printer-store.ts";
import { applyCalibration, loadCalibration } from "./calibration.ts";

export function calibratePrinterImage(image: RawImageData): RawImageData {
  const { peripheral, modelId } = usePrinterStore.getState();
  if (!peripheral || !modelId) return image;
  return applyCalibration(
    image,
    loadCalibration(peripheral.id, modelId),
    getDevice(modelId)?.dpi ?? 203,
  );
}
