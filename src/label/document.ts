import type { LabelSize } from "../store/editor-store.ts";

export const labelDpi = (label: LabelSize) => label.dpi ?? 203;
export const toPixels = (mm: number, dpi: number) =>
  Math.round((mm * dpi) / 25.4);

export function resizeLabel(
  label: LabelSize,
  widthMm: number,
  heightMm: number,
  dpi = labelDpi(label),
): LabelSize {
  if (
    ![widthMm, heightMm].every((v) => Number.isFinite(v) && v >= 2 && v <= 500)
  )
    throw new Error("Labelmaat moet tussen 2 en 500 mm liggen.");
  if (dpi !== 203 && dpi !== 300)
    throw new Error("Ongeldige documentresolutie.");
  return {
    ...label,
    widthMm,
    heightMm,
    widthPx: toPixels(widthMm, dpi),
    heightPx: toPixels(heightMm, dpi),
    dpi,
  };
}

/** Same clipping path is used by the interactive canvas and exported bitmap. */
export function traceLabelPath(
  ctx: Pick<
    CanvasRenderingContext2D,
    "beginPath" | "rect" | "ellipse" | "roundRect"
  >,
  label: LabelSize,
) {
  ctx.beginPath();
  if (label.shape === "circle")
    ctx.ellipse(
      label.widthPx / 2,
      label.heightPx / 2,
      label.widthPx / 2,
      label.heightPx / 2,
      0,
      0,
      Math.PI * 2,
    );
  else if (label.shape === "rounded")
    ctx.roundRect(
      0,
      0,
      label.widthPx,
      label.heightPx,
      Math.min(label.widthPx, label.heightPx) * 0.12,
    );
  else ctx.rect(0, 0, label.widthPx, label.heightPx);
}

export function parseLabelSize(value: unknown): LabelSize {
  if (!value || typeof value !== "object")
    throw new Error("Labelmaat ontbreekt.");
  const v = value as LabelSize;
  if (
    v.shape !== undefined &&
    !["rectangle", "rounded", "circle"].includes(v.shape)
  )
    throw new Error("Ongeldige labelvorm.");
  if (
    v.split !== undefined &&
    !["none", "horizontal", "vertical"].includes(v.split)
  )
    throw new Error("Ongeldige labelsplitsing.");
  return resizeLabel(
    { ...v, shape: v.shape ?? "rectangle", split: v.split ?? "none" },
    v.widthMm,
    v.heightMm,
    v.dpi ?? 203,
  );
}
