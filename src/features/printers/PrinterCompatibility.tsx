import { useT } from "../../lib/i18n.ts";
import { useEffect, useMemo, useState } from "react";
import { ALL_PRINTER_MODELS, isDesignOnlyModel } from "./model-catalog.ts";
import { getCompatibilityLevel } from "./compatibility-status.ts";
import { usePrinterStore } from "../../store/printer-store.ts";
import {
  loadCompatibilitySummaries,
  submitCompatibilityReport,
  type CompatibilitySummary,
} from "../../lib/community-printers.ts";

declare const __APP_VERSION__: string;
declare const __COMMIT_SHA__: string;

const CHECKS = [
  ["testLabelPrinted", "Ik heb een echt testlabel geprint"],
  ["sizeAlignmentChecked", "Formaat, richting en uitlijning kloppen"],
  ["qrScanned", "QR-code of barcode is scanbaar"],
  ["reconnectChecked", "Opnieuw verbinden werkt"],
] as const;

export function PrinterCompatibility() {
  const tx = useT();
  const connectedModel = usePrinterStore((state) => state.modelId);
  const connected = usePrinterStore((state) => state.isConnected);
  const firmware = usePrinterStore((state) => state.deviceInfo.firmware);
  const [id, setId] = useState(connectedModel || ALL_PRINTER_MODELS[0].id);
  const [summaries, setSummaries] = useState<CompatibilitySummary[]>([]);
  const [result, setResult] = useState<"works" | "fails">("works");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadCompatibilitySummaries()
      .then(setSummaries)
      .catch(() => setSummaries([]));
  }, []);

  const effectiveId = connected && connectedModel ? connectedModel : id;
  const summary = summaries.find((item) => item.model_id === effectiveId);
  const level = getCompatibilityLevel(effectiveId);
  const communityLabel = useMemo(() => {
    if (level === "studio-certified") return "Studio geverifieerd";
    if (
      (summary?.successful_reports || 0) >= 2 &&
      (summary?.failed_reports || 0) === 0
    )
      return "Community bevestigd";
    if ((summary?.approved_reports || 0) > 0) return "Community getest";
    return "Nog niet getest";
  }, [level, summary]);

  const successfulChecklist = CHECKS.every(([key]) => checks[key]);
  const canSubmit =
    !busy &&
    Boolean(connected && connectedModel === effectiveId) &&
    (result === "fails" || successfulChecklist);

  const submit = async () => {
    setBusy(true);
    setStatus("");
    try {
      await submitCompatibilityReport({
        modelId: effectiveId,
        result,
        connected,
        testLabelPrinted: Boolean(checks.testLabelPrinted),
        sizeAlignmentChecked: Boolean(checks.sizeAlignmentChecked),
        qrScanned: Boolean(checks.qrScanned),
        reconnectChecked: Boolean(checks.reconnectChecked),
        firmware: firmware || undefined,
        notes,
        appVersion: `${__APP_VERSION__} (${__COMMIT_SHA__.slice(0, 12)})`,
      });
      setStatus(
        "Bedankt. Je rapport is opgeslagen en wordt eerst beoordeeld voordat het publiek meetelt.",
      );
      setNotes("");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Rapport opslaan mislukt.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="studio-card mt-5">
      <h2>{tx("Compatibiliteit en communitytest")}</h2>
      <p>
        {tx(
          "Bekijk gecontroleerde ervaringen van andere gebruikers of deel een test van de printer die nu verbonden is.",
        )}
      </p>
      <select
        aria-label={tx("Printermodel")}
        className="studio-field"
        value={effectiveId}
        disabled={Boolean(connected && connectedModel)}
        onChange={(event) => setId(event.target.value)}
      >
        {ALL_PRINTER_MODELS.map((model) => (
          <option key={model.id} value={model.id}>
            {tx(model.name)}
          </option>
        ))}
      </select>
      <div className="studio-compatibility-summary" aria-live="polite">
        <strong>{tx(communityLabel)}</strong>
        <span>
          {tx("Geslaagd")}: {summary?.successful_reports || 0}
        </span>
        <span>
          {tx("Mislukt")}: {summary?.failed_reports || 0}
        </span>
        <span>
          {isDesignOnlyModel(effectiveId)
            ? tx("Alleen ontwerpen; direct printprotocol ontbreekt")
            : tx("Direct printprotocol beschikbaar")}
        </span>
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <h3 className="font-semibold">{tx("Deel jouw fysieke test")}</h3>
        {!connected || connectedModel !== effectiveId ? (
          <p role="status">
            {tx(
              "Verbind dit exacte printermodel eerst. Zo voorkomen we rapporten voor het verkeerde apparaat.",
            )}
          </p>
        ) : (
          <>
            <div className="flex gap-2 my-3">
              <button
                className={
                  result === "works" ? "studio-primary" : "studio-secondary"
                }
                onClick={() => setResult("works")}
              >
                {tx("Werkt")}
              </button>
              <button
                className={
                  result === "fails" ? "studio-primary" : "studio-secondary"
                }
                onClick={() => setResult("fails")}
              >
                {tx("Werkt niet")}
              </button>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-ui-sm text-ink-300 mb-2">
                {tx("Bevestig wat je daadwerkelijk hebt gecontroleerd")}
              </legend>
              {CHECKS.map(([key, label]) => (
                <label key={key} className="flex items-start gap-2 text-ui-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(checks[key])}
                    onChange={(event) =>
                      setChecks((value) => ({
                        ...value,
                        [key]: event.target.checked,
                      }))
                    }
                  />
                  <span>{tx(label)}</span>
                </label>
              ))}
            </fieldset>
            <label className="block mt-4 text-ui-sm">
              {tx(
                "Opmerkingen zonder serienummer, MAC-adres of persoonsgegevens",
              )}
              <textarea
                className="studio-field min-h-24"
                maxLength={1000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
            <button
              className="studio-primary"
              disabled={!canSubmit}
              onClick={() => void submit()}
            >
              {busy ? tx("Opslaan…") : tx("Test ter beoordeling insturen")}
            </button>
          </>
        )}
      </div>
      {status && (
        <p role="status" className="mt-3">
          {tx(status)}
        </p>
      )}
    </article>
  );
}
