import type { BaseElement, LabelSize } from "../store/editor-store.ts";

export interface TextLayout {
  width: number;
  height: number;
}

/** Never enlarge text: the chosen size stays the user's upper limit. */
export function fitTextSize(
  maximum: number,
  width: number,
  height: number,
  measure: (size: number) => TextLayout,
  minimum = 4,
): { fontSize: number; fits: boolean } {
  const max = Number.isFinite(maximum) && maximum > 0 ? maximum : 18;
  minimum = Math.min(
    max,
    Number.isFinite(minimum) && minimum > 0 ? minimum : 4,
  );
  const fits = (size: number) => {
    const layout = measure(size);
    return layout.width <= width + 0.01 && layout.height <= height + 0.01;
  };
  if (fits(max)) return { fontSize: max, fits: true };
  if (!fits(minimum)) return { fontSize: minimum, fits: false };
  let low = minimum;
  let high = max;
  for (let i = 0; i < 14; i++) {
    const mid = (low + high) / 2;
    if (fits(mid)) low = mid;
    else high = mid;
  }
  return { fontSize: Math.floor(low * 100) / 100, fits: true };
}

/** Conservative box check: rotated content must stay inside the actual paper shape. */
export function elementInsideLabel(
  element: Pick<BaseElement, "x" | "y" | "width" | "height" | "rotation">,
  label: LabelSize,
): boolean {
  const angle = ((element.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const inside = (x: number, y: number) => {
    if (
      x < -0.01 ||
      y < -0.01 ||
      x > label.widthPx + 0.01 ||
      y > label.heightPx + 0.01
    )
      return false;
    if (label.shape === "circle") {
      const dx = (x - label.widthPx / 2) / (label.widthPx / 2);
      const dy = (y - label.heightPx / 2) / (label.heightPx / 2);
      return dx * dx + dy * dy <= 1.0001;
    }
    if (label.shape === "rounded") {
      const r = Math.min(label.widthPx, label.heightPx) * 0.12;
      const cx = Math.max(r, Math.min(label.widthPx - r, x));
      const cy = Math.max(r, Math.min(label.heightPx - r, y));
      return (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.01;
    }
    return true;
  };
  return [
    [0, 0],
    [element.width, 0],
    [0, element.height],
    [element.width, element.height],
  ].every(([x, y]) =>
    inside(element.x + x * cos - y * sin, element.y + x * sin + y * cos),
  );
}
