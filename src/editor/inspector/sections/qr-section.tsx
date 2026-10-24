import { useNumberFormatter, useT } from "../../../lib/i18n.ts";

import type { BaseElement } from "../../../store/editor-store.ts";
import { useEditorV2Store } from "../../../store/editor-store.ts";
import { Section, Field, TextInput, Select } from "../fields.tsx";

interface Props {
  element: BaseElement;
}

export function QrSection({ element }: Props) {
  const number = useNumberFormatter();
  const tx = useT();
  const updateElement = useEditorV2Store((s) => s.updateElement);

  const p = element.props as {
    content?: string;
    errorCorrectionLevel?: string;
  };

  const update = (patch: Record<string, unknown>) =>
    updateElement(element.id, { props: patch });

  const eccLevel = p.errorCorrectionLevel || "M";
  const eccWidth =
    eccLevel === "H"
      ? "100%"
      : eccLevel === "Q"
        ? "75%"
        : eccLevel === "M"
          ? "50%"
          : "25%";

  return (
    <Section title={tx("QR Code")}>
      <Field label={tx("Data")}>
        <TextInput
          value={p.content || ""}
          onChange={(v) => update({ content: v })}
        />
      </Field>
      <div className="mt-1.5">
        <Field label="ECC">
          <Select
            value={eccLevel}
            onChange={(v) => update({ errorCorrectionLevel: v })}
            options={[
              { value: "L", label: tx("Low (7%)") },
              { value: "M", label: tx("Medium (15%)") },
              { value: "Q", label: tx("Quartile (25%)") },
              { value: "H", label: tx("High (30%)") },
            ]}
          />
        </Field>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-ui-xs text-ink-400">
        <div className="flex-1 h-1 rounded-full bg-ink-800 overflow-hidden">
          <div className="h-full bg-accent" style={{ width: eccWidth }} />
        </div>
        <span className="font-mono">
          {number((p.content || "").length)} {tx("chars")}
        </span>
      </div>
    </Section>
  );
}
