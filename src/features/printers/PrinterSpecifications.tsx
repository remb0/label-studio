import { useT, useLanguage, formatDate, formatNumber } from "../../lib/i18n.ts";

import { getPrinterSpecs } from "./printer-specs.ts";
import { CONNECTION_LABELS } from "./printer-discovery.ts";

export function PrinterSpecifications({ modelId }: { modelId: string }) {
  const tx = useT();
  const language = useLanguage((s) => s.language);
  const specs = getPrinterSpecs(modelId);
  return (
    <details
      className="printer-specifications"
      open={specs.evidence === "conflicting" || specs.evidence === "unverified"}
    >
      <summary>{tx("Specificaties en bronnen")}</summary>
      <p>
        {tx("specsChecked", {
          date: formatDate(language, specs.checkedOn + "T12:00:00", {
            dateStyle: "medium",
          }),
        })}
      </p>
      <dl>
        <dt>{tx("Resolutie")}</dt>
        <dd>{specs.dpi ? `${specs.dpi} dpi` : tx("Niet bevestigd")}</dd>
        <dt>{tx("Printkop")}</dt>
        <dd>
          {specs.headDots
            ? tx("headWidth", {
                dots: specs.headDots,
                width: formatNumber(
                  language,
                  (specs.headDots * 25.4) / specs.dpi!,
                  { minimumFractionDigits: 1, maximumFractionDigits: 1 },
                ),
              })
            : tx("Niet bevestigd / betwist")}
        </dd>
        <dt>{tx("Papierbreedte")}</dt>
        <dd>
          {specs.mediaWidthMm
            ? `${specs.mediaWidthMm[0]}–${specs.mediaWidthMm[1]} mm`
            : tx("Niet bevestigd")}
        </dd>
        <dt>{tx("Hardwareverbinding")}</dt>
        <dd>
          {specs.connections
            .map((connection) => tx(CONNECTION_LABELS[connection]))
            .join(" · ")}
        </dd>
        <dt>{tx("Onderbouwing")}</dt>
        <dd>
          {tx(
            {
              product: "Productdocumentatie",
              project: "Community-/projectbron",
              conflicting: "Bronnen spreken elkaar deels tegen",
              unverified: "Nog niet onderbouwd",
            }[specs.evidence],
          )}
        </dd>
      </dl>
      {specs.notes.map((note) => (
        <p
          key={note}
          className={
            specs.evidence === "conflicting" || specs.evidence === "unverified"
              ? "printer-limited"
              : ""
          }
        >
          {tx(note)}
        </p>
      ))}
      {specs.sources.length > 0 && (
        <ul>
          {specs.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {tx(source.title)}
              </a>
            </li>
          ))}
        </ul>
      )}
      <p>
        {tx(
          "Geen nieuwe printerdriver of hardwarecertificering toegekend op basis van deze gegevens.",
        )}{" "}
      </p>
    </details>
  );
}
