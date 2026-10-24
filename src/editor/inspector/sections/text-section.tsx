import { useT } from "../../../lib/i18n.ts";
import { Bold, Italic, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import type { BaseElement } from "../../../store/editor-store.ts";
import { useEditorV2Store } from "../../../store/editor-store.ts";
import { getTextLayout } from "../../../label/text-fit-layout.ts";
import {
  Section,
  Field,
  NumInput,
  TextInput,
  Select,
  SegBtn,
  SegGroup,
  ColorInput,
} from "../fields.tsx";

interface Props {
  element: BaseElement;
}

export function TextSection({ element }: Props) {
  const tx = useT();
  const updateElement = useEditorV2Store((s) => s.updateElement);

  const p = element.props as {
    text?: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: number;
    letterSpacing?: number;
    fill?: string;
    align?: string;
    italic?: boolean;
    autoFit?: boolean;
  };

  const update = (patch: Record<string, unknown>) =>
    updateElement(element.id, { props: patch });

  return (
    <Section title={tx("Text")}>
      <Field label={tx("Content")}>
        <TextInput value={p.text || ""} onChange={(v) => update({ text: v })} />
      </Field>
      <div className="grid grid-cols-2 gap-1.5 mt-1.5">
        <Field label={tx("Size")} mono>
          <NumInput
            value={p.fontSize || 18}
            onChange={(v) => update({ fontSize: v })}
            suffix="px"
          />
        </Field>
        <Field label={tx("Track")} mono>
          <NumInput
            value={p.letterSpacing || 0}
            onChange={(v) => update({ letterSpacing: v })}
            suffix="px"
            step={0.1}
          />
        </Field>
      </div>
      <div className="mt-1.5">
        <Field label={tx("Font")}>
          <Select
            value={p.fontFamily || "Inter"}
            onChange={(v) => update({ fontFamily: v })}
            options={[
              { value: "Inter", label: "Inter" },
              { value: "JetBrains Mono", label: "JetBrains Mono" },
              { value: "Arial", label: "Arial" },
              { value: "Georgia", label: "Georgia" },
              { value: "Courier New", label: "Courier New" },
            ]}
          />
        </Field>
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <SegGroup>
          <SegBtn
            active={(p.fontWeight || 400) >= 600}
            onClick={() =>
              update({ fontWeight: (p.fontWeight || 400) >= 600 ? 400 : 700 })
            }
            title={tx("Bold")}
          >
            <Bold size={14} />
          </SegBtn>
          <SegBtn
            active={!!p.italic}
            onClick={() => update({ italic: !p.italic })}
            title={tx("Italic")}
          >
            <Italic size={14} />
          </SegBtn>
        </SegGroup>
        <SegGroup>
          <SegBtn
            active={p.align === "left"}
            onClick={() => update({ align: "left" })}
          >
            <AlignLeft size={14} />
          </SegBtn>
          <SegBtn
            active={p.align === "center"}
            onClick={() => update({ align: "center" })}
          >
            <AlignCenter size={14} />
          </SegBtn>
          <SegBtn
            active={p.align === "right"}
            onClick={() => update({ align: "right" })}
          >
            <AlignRight size={14} />
          </SegBtn>
        </SegGroup>
      </div>
      <div className="mt-1.5">
        <Field label={tx("Color")}>
          <ColorInput
            value={p.fill || "#000000"}
            onChange={(v) => update({ fill: v })}
          />
        </Field>
      </div>
      <label className="mt-3 flex items-center gap-2 text-ui-sm text-ink-200">
        <input
          type="checkbox"
          checked={p.autoFit === true}
          onChange={(event) => update({ autoFit: event.target.checked })}
        />
        {tx("Tekst automatisch passend maken")}{" "}
      </label>
      <p className="mt-1 text-ui-xs text-ink-400">
        {p.autoFit
          ? tx(
              "Weergave: {size} px. Het tekstvak blijft even groot; vergroot het vak als de tekst te klein wordt.",
              { size: getTextLayout(element).fontSize },
            )
          : tx(
              "Schakel in om tekst binnen de breedte en hoogte van dit tekstvak te houden. De ingestelde lettergrootte blijft het maximum.",
            )}
      </p>
    </Section>
  );
}
