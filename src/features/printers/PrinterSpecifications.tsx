import { getPrinterSpecs } from "./printer-specs.ts";
import { CONNECTION_LABELS } from "./printer-discovery.ts";

export function PrinterSpecifications({ modelId }: { modelId: string }) {
  const specs = getPrinterSpecs(modelId);
  return (
    <details
      className="printer-specifications"
      open={specs.evidence === "conflicting" || specs.evidence === "unverified"}
    >
      <summary>Specificaties en bronnen</summary>
      <p>
        Hardwaregegevens staan los van de ontwerppreset en van direct printen in
        deze app. Gecontroleerd: {specs.checkedOn}.
      </p>
      <dl>
        <dt>Resolutie</dt>
        <dd>{specs.dpi ? `${specs.dpi} dpi` : "Niet bevestigd"}</dd>
        <dt>Printkop</dt>
        <dd>
          {specs.headDots
            ? `${specs.headDots} dots · circa ${((specs.headDots * 25.4) / specs.dpi!).toFixed(1)} mm`
            : "Niet bevestigd / betwist"}
        </dd>
        <dt>Papierbreedte</dt>
        <dd>
          {specs.mediaWidthMm
            ? `${specs.mediaWidthMm[0]}–${specs.mediaWidthMm[1]} mm`
            : "Niet bevestigd"}
        </dd>
        <dt>Hardwareverbinding</dt>
        <dd>
          {specs.connections
            .map((connection) => CONNECTION_LABELS[connection])
            .join(" · ")}
        </dd>
        <dt>Onderbouwing</dt>
        <dd>
          {
            {
              product: "Productdocumentatie",
              project: "Community-/projectbron",
              conflicting: "Bronnen spreken elkaar deels tegen",
              unverified: "Nog niet onderbouwd",
            }[specs.evidence]
          }
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
          {note}
        </p>
      ))}
      {specs.sources.length > 0 && (
        <ul>
          {specs.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.title}
              </a>
            </li>
          ))}
        </ul>
      )}
      <p>
        Geen nieuwe printerdriver of hardwarecertificering toegekend op basis
        van deze gegevens.
      </p>
    </details>
  );
}
