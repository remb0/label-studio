import { getModelLabelConfig } from "../features/printers/model-catalog.ts";
import type { LabelSize } from "../store/editor-store.ts";
import { resizeLabel, toPixels } from "./document.ts";

export interface FormatPreset {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  shape: "rectangle" | "rounded" | "circle";
  paperType: "gap" | "continuous";
  rollDirection: "horizontal" | "vertical";
}

export const FORMAT_PRESETS: FormatPreset[] = [
  {
    id: "mini",
    name: "Mini",
    widthMm: 29,
    heightMm: 12,
    shape: "rounded",
    paperType: "gap",
    rollDirection: "horizontal",
  },
  {
    id: "slim",
    name: "Smal",
    widthMm: 40,
    heightMm: 12,
    shape: "rounded",
    paperType: "gap",
    rollDirection: "horizontal",
  },
  {
    id: "address",
    name: "Adres",
    widthMm: 50,
    heightMm: 30,
    shape: "rounded",
    paperType: "gap",
    rollDirection: "horizontal",
  },
  {
    id: "luckp",
    name: "LuckP breed",
    widthMm: 48,
    heightMm: 30,
    shape: "rectangle",
    paperType: "gap",
    rollDirection: "vertical",
  },
  {
    id: "square",
    name: "Vierkant",
    widthMm: 30,
    heightMm: 30,
    shape: "rectangle",
    paperType: "gap",
    rollDirection: "vertical",
  },
  {
    id: "round",
    name: "Rond",
    widthMm: 30,
    heightMm: 30,
    shape: "circle",
    paperType: "gap",
    rollDirection: "vertical",
  },
  {
    id: "continuous-small",
    name: "Korte strook",
    widthMm: 40,
    heightMm: 15,
    shape: "rectangle",
    paperType: "continuous",
    rollDirection: "horizontal",
  },
  {
    id: "continuous",
    name: "Doorlopende rol",
    widthMm: 48,
    heightMm: 56,
    shape: "rectangle",
    paperType: "continuous",
    rollDirection: "vertical",
  },
];

export function getFormatPresets(modelId: string | null): FormatPreset[] {
  const config = getModelLabelConfig(modelId);
  const presets = FORMAT_PRESETS.filter((p) => {
    if (!config) return true;
    if (!config.supportedPaperTypes.includes(p.paperType)) return false;
    const sizes =
      p.paperType === "gap" ? config.gapSizes : config.continuousSizes;
    return sizes.some(
      (size) => size.widthMm === p.widthMm && size.heightMm === p.heightMm,
    );
  });
  for (const paperType of ["gap", "continuous"] as const) {
    const sizes =
      paperType === "gap" ? config?.gapSizes : config?.continuousSizes;
    for (const size of sizes ?? []) {
      if (
        !presets.some(
          (p) =>
            p.widthMm === size.widthMm &&
            p.heightMm === size.heightMm &&
            p.paperType === paperType,
        )
      ) {
        presets.push({
          ...size,
          id: `${paperType}-${size.widthMm}-${size.heightMm}`,
          name: "Printerformaat",
          shape: "rectangle",
          paperType,
          rollDirection: "horizontal",
        });
      }
    }
  }
  return presets;
}

export function applyFormat(label: LabelSize, preset: FormatPreset): LabelSize {
  return {
    ...resizeLabel(label, preset.widthMm, preset.heightMm),
    shape: preset.shape,
  };
}

export function exceedsPrintWidth(
  label: Pick<LabelSize, "widthMm" | "heightMm">,
  direction: "horizontal" | "vertical",
  maxPixels: number,
): boolean {
  // Horizontal feed rotates the document by 90 degrees before raster output.
  return (
    toPixels(direction === "horizontal" ? label.heightMm : label.widthMm, 203) >
    maxPixels
  );
}
