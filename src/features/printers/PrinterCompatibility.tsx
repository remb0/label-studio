import { useT, useLanguage, t } from "../../lib/i18n.ts";

import { useState } from "react";
import { ALL_PRINTER_MODELS, isDesignOnlyModel } from "./model-catalog.ts";
import { getCompatibilityLevel } from "./compatibility-status.ts";

const repo = "https://github.com/remb0/label-studio/issues/new";
export function PrinterCompatibility() {
  const tx = useT();
  const lang = useLanguage((s) => s.language);
  const [id, setId] = useState<string>(ALL_PRINTER_MODELS[0].id);
  const level = getCompatibilityLevel(id);
  const report = (success: boolean) => {
    const model = ALL_PRINTER_MODELS.find((x) => x.id === id)?.name || id;
    const body = `## Compatibility report\nModel: ${model}\nResult: ${success ? "Works" : "Does not work"}\n\n## Details\nConnection type (Bluetooth / USB / LAN):\nBrowser and OS:\nLabel size:\nPrint alignment:\nFirmware (optional):\nSteps to reproduce:\n\n[ ] I tested a real printed label\n\nDo not include serial numbers, MAC addresses or private data.\nReports require review and do NOT automatically grant Studio Certified status.`;
    window.open(
      repo +
        "?" +
        new URLSearchParams({
          title: `Compatibility: ${model} — ${success ? "works" : "fails"}`,
          body,
        }).toString(),
      "_blank",
      "noopener,noreferrer",
    );
  };
  return (
    <article className="studio-card mt-5">
      <h2>{t(lang, "validation")}</h2>
      <p>{t(lang, "reportIntro")}</p>
      <select
        aria-label={t(lang, "model")}
        className="studio-field"
        value={id}
        onChange={(e) => setId(e.target.value)}
      >
        {ALL_PRINTER_MODELS.map((x) => (
          <option key={x.id} value={x.id}>
            {x.id === "action-pocket-300" ? tx(x.name) : x.name}
          </option>
        ))}
      </select>
      <p className="my-3">
        <strong>
          {t(
            lang,
            level === "studio-certified"
              ? "certified"
              : level === "community-reported"
                ? "reported"
                : "unknown",
          )}
        </strong>{" "}
        ·{" "}
        {isDesignOnlyModel(id)
          ? t(lang, "experimental")
          : tx(
              "Bluetooth protocol implemented · hardware certification pending",
            )}
      </p>
      <div className="flex flex-wrap gap-3">
        <button className="studio-primary" onClick={() => report(true)}>
          {t(lang, "reportWorking")}
        </button>
        <button className="studio-secondary" onClick={() => report(false)}>
          {t(lang, "reportFail")}
        </button>
      </div>
    </article>
  );
}
