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

export type RollDirection = "horizontal" | "vertical";

/**
 * Label size in printer terms. The axis across the print head is the roll
 * width; the axis along the feed is the length (free on a continuous roll).
 */
export function rollAxes(
  label: Pick<LabelSize, "widthMm" | "heightMm">,
  direction: RollDirection,
): { acrossMm: number; alongMm: number } {
  return direction === "vertical"
    ? { acrossMm: label.widthMm, alongMm: label.heightMm }
    : { acrossMm: label.heightMm, alongMm: label.widthMm };
}

export function presetRollWidth(preset: FormatPreset): number {
  return rollAxes(preset, preset.rollDirection).acrossMm;
}

/** Turns the design a quarter turn on screen while the roll width stays across the head. */
export function tiltLabel(
  label: LabelSize,
  direction: RollDirection,
): { label: LabelSize; rollDirection: RollDirection } {
  return {
    label: resizeLabel(label, label.heightMm, label.widthMm),
    rollDirection: direction === "vertical" ? "horizontal" : "vertical",
  };
}

/**
 * Applies a format. On a continuous roll only the roll width comes from the
 * preset: when the current paper is already continuous, its length and
 * orientation are kept, because the length is whatever the user enters.
 */
export function selectFormat(
  current: {
    label: LabelSize;
    paperType: "gap" | "continuous";
    rollDirection: RollDirection;
  },
  preset: FormatPreset,
): {
  label: LabelSize;
  paperType: "gap" | "continuous";
  rollDirection: RollDirection;
} {
  if (preset.paperType === "continuous" && current.paperType === "continuous") {
    const across = presetRollWidth(preset);
    const { alongMm } = rollAxes(current.label, current.rollDirection);
    const label =
      current.rollDirection === "vertical"
        ? resizeLabel(current.label, across, alongMm)
        : resizeLabel(current.label, alongMm, across);
    return {
      label: { ...label, shape: preset.shape },
      paperType: "continuous",
      rollDirection: current.rollDirection,
    };
  }
  return {
    label: applyFormat(current.label, preset),
    paperType: preset.paperType,
    rollDirection: preset.rollDirection,
  };
}
