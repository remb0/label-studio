import { useNumberFormatter, useT } from "../lib/i18n.ts";

import { useEditorV2Store } from "../store/editor-store.ts";

export function StatusBar() {
  const number = useNumberFormatter();
  const tx = useT();
  const label = useEditorV2Store((s) => s.label);
  const elements = useEditorV2Store((s) => s.elements);
  const selectedIds = useEditorV2Store((s) => s.selectedIds);
  const paperType = useEditorV2Store((s) => s.paperType);
  const dirty = useEditorV2Store(
    (s) => s.currentLabelDirty || s.currentLabelId === null,
  );

  const sel = elements.filter((e) => selectedIds.includes(e.id));

  return (
    <div className="hidden md:flex absolute bottom-0 left-0 right-0 h-6 px-3 items-center justify-between text-ui-xs font-mono text-ink-500 bg-ink-900/80 border-t border-white/5 backdrop-blur-sm z-10">
      <div className="flex items-center gap-4">
        <span>
          {number(label.widthMm)}×{number(label.heightMm)}mm
        </span>
        <span>
          {tx(paperType === "gap" ? "Losse labels" : "Doorlopende rol")}
        </span>
        <span>
          {number(elements.length)} {tx("elements")}
        </span>
        {sel.length === 1 && (
          <span className="text-accent">
            {tx(
              (
                {
                  text: "Text",
                  rect: "Rectangle",
                  line: "Line",
                  image: "Image",
                  qrcode: "QR Code",
                  barcode: "Barcode",
                } as Record<string, string>
              )[sel[0].type] || sel[0].type,
            )}{" "}
            · {number(Math.round(sel[0].width))}×
            {number(Math.round(sel[0].height))}px · (
            {number(Math.round(sel[0].x))}, {number(Math.round(sel[0].y))})
          </span>
        )}
        {sel.length > 1 && (
          <span className="text-accent">
            {number(sel.length)} {tx("selected")}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1">
          <span
            className={`w-1.5 h-1.5 rounded-full ${dirty ? "bg-amber-400" : "bg-emerald-400"}`}
          />
          {dirty ? tx("Unsaved changes") : tx("Saved")}
        </span>
      </div>
    </div>
  );
}
