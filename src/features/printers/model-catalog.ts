import { LocalizedError } from "../../lib/i18n.ts";
import {
  findDeviceByName,
  getDevice,
  type BlePeripheral,
} from "@thermoprint/core";
import { RESEARCHED_MODELS } from "./researched-models.ts";

export const PRINTER_MODELS = [
  {
    id: "fichero-d11s",
    name: "Fichero D11s / 5836",
    subtitle: "14 × 30 mm papier · 12 mm printbaar",
    silhouette: "slim",
  },
  {
    id: "luckp-d1s",
    name: "LuckP D1S",
    subtitle: "Fichero 3561 / LuckP · brede labels",
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

/** Design-only models: no Bluetooth protocol is assigned to these printers. */
export const DESIGN_ONLY_MODELS = [
  {
    id: "dymo-450",
    name: "DYMO LabelWriter 450",
    subtitle: "USB · alleen ontwerpen",
    silhouette: "wide",
  },
  {
    id: "dymo-450-turbo",
    name: "DYMO LabelWriter 450 Turbo",
    subtitle: "USB · alleen ontwerpen",
    silhouette: "wide",
  },
  {
    id: "dymo-450-twin",
    name: "DYMO LabelWriter 450 Twin Turbo",
    subtitle: "USB · alleen ontwerpen",
    silhouette: "wide",
  },
  {
    id: "dymo-450-duo",
    name: "DYMO LabelWriter 450 Duo",
    subtitle: "USB · alleen ontwerpen",
    silhouette: "wide",
  },
  {
    id: "dymo-4xl",
    name: "DYMO LabelWriter 4XL",
    subtitle: "USB · alleen ontwerpen",
    silhouette: "wide",
  },
  {
    id: "dymo-550",
    name: "DYMO LabelWriter 550",
    subtitle: "USB · alleen ontwerpen",
    silhouette: "wide",
  },
  {
    id: "dymo-550-turbo",
    name: "DYMO LabelWriter 550 Turbo",
    subtitle: "USB/LAN · alleen ontwerpen",
    silhouette: "wide",
  },
  {
    id: "dymo-5xl",
    name: "DYMO LabelWriter 5XL",
    subtitle: "USB/LAN · alleen ontwerpen",
    silhouette: "wide",
  },
  {
    id: "action-pocket-300",
    name: "Action pocket printer (model onbekend)",
    subtitle: "300-dpi ontwerppreset · exact apparaat niet bevestigd",
    silhouette: "compact",
  },
  ...RESEARCHED_MODELS,
] as const;

export const ALL_PRINTER_MODELS = [...PRINTER_MODELS, ...DESIGN_ONLY_MODELS];

const dymoSizes = [
  { widthMm: 25, heightMm: 54 },
  { widthMm: 57, heightMm: 32 },
  { widthMm: 57, heightMm: 102 },
  { widthMm: 46, heightMm: 79 },
  { widthMm: 13, heightMm: 25 },
];
const wideDymoSizes = [...dymoSizes, { widthMm: 102, heightMm: 152 }];

export function getDesignModelConfig(id: string) {
  const researched = RESEARCHED_MODELS.find((model) => model.id === id);
  if (researched)
    return {
      supportedPaperTypes: researched.paperTypes,
      defaultPaperType: "gap" as const,
      gapSizes: researched.sizes,
      continuousSizes: researched.paperTypes.includes("continuous")
        ? researched.sizes
        : [],
      defaultSize: researched.sizes[0],
      printWidth: 0,
      dpi: researched.dpi,
    };
  if (id === "action-pocket-300")
    return {
      supportedPaperTypes: ["gap"] as ("gap" | "continuous")[],
      defaultPaperType: "gap" as const,
      gapSizes: [{ widthMm: 50, heightMm: 15 }],
      continuousSizes: [],
      defaultSize: { widthMm: 50, heightMm: 15 },
      printWidth: 0,
      dpi: 300,
    };
  if (!id.startsWith("dymo-") || !DESIGN_ONLY_MODELS.some((m) => m.id === id))
    return null;
  const large = id === "dymo-4xl" || id === "dymo-5xl";
  const gapSizes = (large ? wideDymoSizes : dymoSizes).filter(
    (size) => large || size.widthMm <= 57,
  );
  return {
    supportedPaperTypes: ["gap"] as ("gap" | "continuous")[],
    defaultPaperType: "gap" as const,
    gapSizes,
    continuousSizes: [],
    defaultSize: { widthMm: 57, heightMm: 32 },
    printWidth: 0,
    dpi: 300,
  };
}

export function getModelLabelConfig(id: string | null) {
  if (!id) return null;
  return getDevice(id)?.labelConfig ?? getDesignModelConfig(id);
}

export function isDesignOnlyModel(id: string | null) {
  return !!id && DESIGN_ONLY_MODELS.some((model) => model.id === id);
}

export function getPrinterModelDefaults(id: string) {
  const profile = getDevice(id);
  const design = getDesignModelConfig(id);
  if (!profile?.labelConfig && !design) return null;
  return {
    density: (profile?.defaults.density ?? 2) as 1 | 2 | 3,
    paperType: (profile?.labelConfig ?? design)!.defaultPaperType,
    printWidth: profile?.printWidth ?? design?.printWidth ?? 384,
    dpi: profile?.dpi ?? design?.dpi ?? 203,
    supportedPaperTypes: (profile?.labelConfig ?? design)!.supportedPaperTypes,
    recommendedSize: (profile?.labelConfig ?? design)!.defaultSize,
  };
}

/** Never use a visual choice to force a protocol onto another device. */
export function validatePrinterModel(
  peripheral: BlePeripheral,
  preferredModelId: string | null,
) {
  const detected = findDeviceByName(peripheral.name);
  if (!detected)
    throw new LocalizedError("unknownPrinter", { name: peripheral.name });
  if (preferredModelId && detected.modelId !== preferredModelId) {
    const selected =
      PRINTER_MODELS.find((model) => model.id === preferredModelId)?.name ??
      preferredModelId;
    throw new LocalizedError("wrongPrinter", {
      selected,
      name: peripheral.name,
    });
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
