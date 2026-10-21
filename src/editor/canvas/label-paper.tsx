import { Shape } from "react-konva";
import { useEditorV2Store } from "../../store/editor-store.ts";
import { traceLabelPath } from "../../label/document.ts";

export function LabelPaper() {
  const label = useEditorV2Store((s) => s.label);

  return (
    <Shape
      id="label-paper"
      sceneFunc={(ctx, shape) => {
        traceLabelPath(ctx as unknown as CanvasRenderingContext2D, label);
        ctx.fillStrokeShape(shape);
      }}
      x={0}
      y={0}
      width={label.widthPx}
      height={label.heightPx}
      fill="#ffffff"
      shadowColor="rgba(0,0,0,0.3)"
      shadowBlur={20}
      shadowOffsetY={4}
      listening={false}
    />
  );
}
