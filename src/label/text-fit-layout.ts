import Konva from "konva";
import type { BaseElement, LabelSize } from "../store/editor-store.ts";
import { elementInsideLabel, fitTextSize } from "./text-fit.ts";

export function textFontStyle(props: Record<string, unknown>): string {
  return (
    [
      props.italic ? "italic" : "",
      Number(props.fontWeight) >= 700 ? "bold" : "",
    ]
      .filter(Boolean)
      .join(" ") || "normal"
  );
}

/** Use the renderer's own wrapping engine, with no fixed height or ellipsis. */
export function getTextLayout(element: BaseElement) {
  const p = element.props;
  const node = new Konva.Text({
    text: String(p.text ?? ""),
    fontSize: Number(p.fontSize) || 18,
    fontFamily: String(p.fontFamily || "Inter"),
    fontStyle: textFontStyle(p),
    letterSpacing: Number(p.letterSpacing) || 0,
    width: Math.max(1, element.width),
    wrap: "word",
  });
  const measure = (size: number) => {
    node.fontSize(size);
    // Konva stops wrapping when even one glyph cannot fit. An empty/partial
    // textArr is therefore not proof of a successful fit.
    const complete =
      node.textArr
        .map((line) => line.text)
        .join("")
        .replace(/\s/g, "") === String(p.text ?? "").replace(/\s/g, "");
    return {
      width: complete
        ? Math.max(0, ...node.textArr.map((line) => line.width))
        : Infinity,
      height: node.height(),
    };
  };
  try {
    const fit =
      p.autoFit === true
        ? fitTextSize(
            Number(p.fontSize) || 18,
            element.width,
            element.height,
            measure,
          )
        : { fontSize: Number(p.fontSize) || 18, fits: true };
    const layout = measure(fit.fontSize);
    return {
      ...layout,
      ...fit,
      fits: fit.fits && layout.width <= element.width + 0.01,
    };
  } finally {
    node.destroy();
  }
}

export interface ContentWarning {
  id: string;
  message: string;
}

export function getContentWarnings(
  elements: BaseElement[],
  label: LabelSize,
): ContentWarning[] {
  return elements.flatMap((element, index) => {
    const layout = element.type === "text" ? getTextLayout(element) : null;
    const name =
      element.type === "text" ? `Tekst ${index + 1}` : `Element ${index + 1}`;
    if (layout && !layout.fits)
      return [
        {
          id: element.id,
          message: element.props.autoFit
            ? `${name}: tekst past niet, zelfs op ${layout.fontSize} px. Vergroot het tekstvak of verkort de tekst.`
            : `${name}: tekst past niet in de breedte. Vergroot het tekstvak of schakel automatisch passend maken in.`,
        },
      ];
    const bounds = {
      ...element,
      height: layout
        ? element.props.autoFit
          ? element.height
          : layout.height
        : element.height,
    };
    if (!elementInsideLabel(bounds, label))
      return [
        {
          id: element.id,
          message: `${name}: valt buiten de labelrand en kan worden afgesneden. Verplaats of verklein het element.`,
        },
      ];
    return [];
  });
}

export function assertLabelContentFits(
  elements: BaseElement[],
  label: LabelSize,
) {
  const warnings = getContentWarnings(elements, label);
  if (warnings.length)
    throw new Error(
      `Controleer de labelinhoud vóór het printen. ${warnings[0].message}`,
    );
}
