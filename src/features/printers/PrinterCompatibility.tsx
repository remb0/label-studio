import { useT } from "../../lib/i18n.ts";
import { useEffect, useMemo, useState } from "react";
import { ALL_PRINTER_MODELS, isDesignOnlyModel } from "./model-catalog.ts";
import { getCompatibilityLevel } from "./compatibility-status.ts";
import { usePrinterStore } from "../../store/printer-store.ts";
import {
  loadCompatibilitySummaries,
  type CompatibilitySummary,
} from "../../lib/community-printers.ts";

export function PrinterCompatibility() {
  const tx = useT();
  const connectedModel = usePrinterStore((state) => state.modelId);
  const connected = usePrinterStore((state) => state.isConnected);
  const [id, setId] = useState(connectedModel || ALL_PRINTER_MODELS[0].id);
  const [summaries, setSummaries] = useState<CompatibilitySummary[]>([]);

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

  return (
    <article className="studio-card mt-5">
      <h2>{tx("Compatibiliteit en communitytest")}</h2>
      <p>
        {tx(
          "Bekijk gecontroleerde ervaringen van andere gebruikers met dit printermodel.",
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

      <p className="mt-4 text-ui-sm">
        {tx(
          "Zelf getest? Gebruik Printertest & kalibratie op deze pagina: print een liniaal, bevestig dat je printer werkt en deel de uitkomst.",
        )}
      </p>
    </article>
  );
}
