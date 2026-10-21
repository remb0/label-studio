import {
  findDeviceByName,
  getDevice,
  type BlePeripheral,
} from "@thermoprint/core";

export const PRINTER_MODELS = [
  {
    id: "luckp-d1s",
    name: "LuckP D1S",
    subtitle: "Fichero / LuckP · brede labels",
    silhouette: "wide",
  },
  {
    id: "p12",
    name: "Marklife P12",
    subtitle: "P11 / P12 / LP90 · compacte labels",
    silhouette: "compact",
  },
  {
    id: "p15",
    name: "Marklife P15",
    subtitle: "P15-familie · voorgesneden labels",
    silhouette: "slim",
  },
  {
    id: "m60",
    name: "Marklife M60",
    subtitle: "M60 / X2 · brede labels",
    silhouette: "wide",
  },
] as const;

export function getPrinterModelDefaults(id: string) {
  const profile = getDevice(id);
  if (!profile?.labelConfig) return null;
  return {
    density: profile.defaults.density as 1 | 2 | 3,
    paperType: profile.labelConfig.defaultPaperType,
    printWidth: profile.printWidth ?? 384,
    dpi: profile.dpi ?? 203,
    supportedPaperTypes: profile.labelConfig.supportedPaperTypes,
    recommendedSize: profile.labelConfig.defaultSize,
  };
}

/** Never use a visual choice to force a protocol onto another device. */
export function validatePrinterModel(
  peripheral: BlePeripheral,
  preferredModelId: string | null,
) {
  const detected = findDeviceByName(peripheral.name);
  if (!detected)
    throw new Error(
      `Geen ondersteund printerprofiel gevonden voor “${peripheral.name}”.`,
    );
  if (preferredModelId && detected.modelId !== preferredModelId) {
    const selected =
      PRINTER_MODELS.find((model) => model.id === preferredModelId)?.name ??
      preferredModelId;
    throw new Error(
      `Je koos ${selected}, maar “${peripheral.name}” hoort bij een ander printerprofiel. Kies het juiste model of Automatisch herkennen.`,
    );
  }
  return detected;
}

export function pickPermittedPrinter(
  peripherals: BlePeripheral[],
  preferredModelId: string | null,
  savedPeripheralId?: string,
): BlePeripheral | undefined {
  const candidates = peripherals.filter((peripheral) => {
    try {
      validatePrinterModel(peripheral, preferredModelId);
      return true;
    } catch {
      return false;
    }
  });
  return (
    candidates.find((item) => item.id === savedPeripheralId) ?? candidates[0]
  );
}
