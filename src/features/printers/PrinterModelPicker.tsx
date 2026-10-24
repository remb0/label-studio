import { useNumberFormatter, useT } from "../../lib/i18n.ts";

import { useEffect, useState } from "react";
import { Bluetooth, Check, ChevronLeft, Search } from "lucide-react";
import { usePrinterStore } from "../../store/printer-store.ts";
import { useEditorV2Store } from "../../store/editor-store.ts";
import { usePrintSession } from "../../lib/print-session.ts";
import { PrinterModelImage } from "./PrinterModelImage.tsx";
import { getPrinterImage } from "./printer-images.ts";
import { PrinterSpecifications } from "./PrinterSpecifications.tsx";
import {
  BRANDS,
  CONNECTION_LABELS,
  EMPTY_FILTERS,
  RESULT_LIMIT,
  filterPrinters,
  printerMetadata,
  type PrinterFilters,
} from "./printer-discovery.ts";
import "./printer-wizard.css";

export function PrinterModelPicker({
  className = "",
  onReadyChange,
}: {
  className?: string;
  onReadyChange?: (ready: boolean) => void;
}) {
  const number = useNumberFormatter();
  const tx = useT();
  const selected = usePrinterStore((s) => s.preferredModelId);
  const confirmed = usePrinterStore((s) => s.hasConfirmedPrinterChoice);
  const locked = usePrinterStore(
    (s) => s.isConnected || s.isConnecting || s.isScanning || s.isPrinting,
  );
  const busy = usePrintSession();
  const disabled = locked || busy;
  const [step, setStep] = useState(confirmed ? 2 : 0);
  const [candidate, setCandidate] = useState<string | null | undefined>(
    confirmed ? selected : undefined,
  );
  const [applied, setApplied] = useState(confirmed);
  const [filters, setFilters] = useState<PrinterFilters>({ ...EMPTY_FILTERS });
  const [showAll, setShowAll] = useState(false);
  const results = filterPrinters(filters);
  const visible = showAll ? results : results.slice(0, RESULT_LIMIT);
  const chosen = candidate ? printerMetadata(candidate) : null;
  const ready =
    step === 2 &&
    confirmed &&
    applied &&
    candidate === selected &&
    !chosen?.designOnly;
  useEffect(() => {
    onReadyChange?.(ready);
  }, [ready, onReadyChange]);
  function change(patch: Partial<PrinterFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setShowAll(false);
  }
  function propose(id: string | null) {
    if (disabled) return;
    setCandidate(id);
    setApplied(false);
    setStep(2);
  }
  function apply() {
    if (disabled || candidate === undefined) return;
    usePrinterStore.getState().selectPreferredModel(candidate);
    if (usePrinterStore.getState().preferredModelId !== candidate) return;
    const settings = usePrinterStore.getState().settings;
    useEditorV2Store.setState({
      printSettings: {
        density: settings.density,
        ditherMode: settings.ditherMode,
        threshold: settings.threshold,
      },
    });
    setApplied(true);
  }
  return (
    <section
      className={`printer-wizard ${className}`}
      aria-label={tx("Printermodel kiezen")}
    >
      <header>
        <h3>{tx("Vind jouw printer")}</h3>
        <p>
          {tx(
            "Kijk op de onderkant of verpakking. Kies eerst het merk, vind je model en controleer wat al werkt.",
          )}{" "}
        </p>
      </header>
      <ol className="printer-steps" aria-label={tx("Stappen printerkeuze")}>
        {[tx("Merk"), tx("Model vinden"), tx("Controleren")].map(
          (name, index) => (
            <li key={name} aria-current={step === index ? "step" : undefined}>
              <span>{number(index + 1)}</span>
              {name}
            </li>
          ),
        )}
      </ol>
      {step === 0 && (
        <>
          <h4>{tx("Welk merk staat op jouw printer?")}</h4>
          <div className="printer-brands">
            {BRANDS.map((brand) => (
              <button
                key={brand.id}
                type="button"
                disabled={disabled}
                aria-label={tx("chooseBrand", { name: brand.name })}
                onClick={() => {
                  change({ ...EMPTY_FILTERS, brand: brand.id });
                  setStep(1);
                }}
              >
                <span className="printer-brand-logo">
                  {brand.logo ? (
                    <img src={brand.logo} alt="" />
                  ) : (
                    <span
                      className="printer-wordmark"
                      style={{ fontSize: brand.name.length > 6 ? 13 : 19 }}
                    >
                      {brand.name}
                    </span>
                  )}
                </span>
                <span className="printer-card-copy">
                  <strong>{brand.name}</strong>
                  <small>{tx(brand.hint)}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="printer-actions">
            <button
              disabled={disabled}
              onClick={() => {
                change({ ...EMPTY_FILTERS });
                setStep(1);
              }}
            >
              {tx("Ik weet het merk niet")}{" "}
            </button>
            <button
              disabled={disabled}
              onClick={() => {
                setFilters({ ...EMPTY_FILTERS });
                setShowAll(true);
                setStep(1);
              }}
            >
              {tx("Alles tonen (")}
              {number(filterPrinters(EMPTY_FILTERS).length)})
            </button>
          </div>
          <button
            className="printer-auto"
            disabled={disabled}
            aria-pressed={applied && candidate === null}
            onClick={() => propose(null)}
          >
            <Bluetooth size={20} />
            <span>
              <strong>{tx("Automatisch herkennen")}</strong>
              <small>
                {tx(
                  "Voor ondersteunde BLE-printers. Je kiest zelf het apparaat in het browservenster.",
                )}{" "}
              </small>
            </span>
          </button>
        </>
      )}
      {step === 1 && (
        <>
          <button
            className="printer-back"
            disabled={disabled}
            onClick={() => setStep(0)}
          >
            <ChevronLeft size={16} />
            {tx("Terug naar merk")}{" "}
          </button>
          <h4>{tx("Zoek het modelnummer of filter op eigenschappen")}</h4>
          <label className="printer-search">
            <Search size={18} />
            <span className="sr-only">
              {tx("Zoek printermodel of Bluetoothnaam")}
            </span>
            <input
              disabled={disabled}
              value={filters.query}
              placeholder={tx("Bijvoorbeeld D11s, 450 Turbo, P15 of LP90")}
              onChange={(e) => change({ query: e.target.value })}
            />
          </label>
          <div className="printer-filters">
            <label>
              {tx("Merk")}{" "}
              <select
                aria-label={tx("Merk")}
                disabled={disabled}
                value={filters.brand}
                onChange={(e) =>
                  change({ brand: e.target.value as PrinterFilters["brand"] })
                }
              >
                <option value="any">{tx("Alle merken")}</option>
                {BRANDS.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {tx("Verbinding")}{" "}
              <select
                disabled={disabled}
                value={filters.connection}
                aria-label={tx("Verbinding")}
                onChange={(e) =>
                  change({
                    connection: e.target.value as PrinterFilters["connection"],
                  })
                }
              >
                <option value="any">{tx("Maakt niet uit")}</option>
                {Object.entries(CONNECTION_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {tx(label)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {tx("Resolutie")}{" "}
              <select
                disabled={disabled}
                value={filters.dpi}
                aria-label={tx("Resolutie")}
                onChange={(e) =>
                  change({ dpi: e.target.value as PrinterFilters["dpi"] })
                }
              >
                <option value="any">{tx("Weet ik niet")}</option>
                <option value="203">203 dpi</option>
                <option value="300">300 dpi</option>
              </select>
            </label>
            <label>
              {tx("Papier")}{" "}
              <select
                disabled={disabled}
                value={filters.paper}
                aria-label={tx("Papier")}
                onChange={(e) =>
                  change({ paper: e.target.value as PrinterFilters["paper"] })
                }
              >
                <option value="any">{tx("Alle typen")}</option>
                <option value="gap">{tx("Losse labels")}</option>
                <option value="continuous">{tx("Doorlopende rol")}</option>
              </select>
            </label>
            <label>
              {tx("Labelmaat")}{" "}
              <select
                disabled={disabled}
                value={filters.size}
                aria-label={tx("Labelmaat")}
                onChange={(e) =>
                  change({ size: e.target.value as PrinterFilters["size"] })
                }
              >
                <option value="any">{tx("Alle maten")}</option>
                <option value="small">
                  {tx("Kleine labels · korte zijde ≤ 15 mm")}{" "}
                </option>
                <option value="shipping">
                  {tx("Verzendlabels · korte zijde ≥ 100 mm")}{" "}
                </option>
              </select>
            </label>
          </div>
          <p className="printer-count" role="status">
            {results.length
              ? tx("matchingModels", {
                  visible: visible.length,
                  total: results.length,
                })
              : tx(
                  "Geen passend model gevonden. Probeer minder filters of meld jouw printer aan onderaan de printerpagina.",
                )}
          </p>
          <div className="printer-results">
            {visible.map((model) => (
              <button
                key={model.id}
                data-printer-result={model.id}
                aria-label={`${model.id === "action-pocket-300" ? tx(model.name) : model.name} ${tx(model.subtitle)}`}
                disabled={disabled}
                aria-pressed={selected === model.id}
                onClick={() => propose(model.id)}
              >
                <PrinterModelImage
                  modelId={model.id}
                  name={
                    model.id === "action-pocket-300"
                      ? tx(model.name)
                      : model.name
                  }
                />
                <span className="printer-card-copy">
                  <strong>
                    {model.id === "action-pocket-300"
                      ? tx(model.name)
                      : model.name}
                  </strong>
                  <small>{tx(model.subtitle)}</small>
                  <span
                    className={
                      model.designOnly
                        ? "printer-badge limited"
                        : "printer-badge"
                    }
                  >
                    {model.designOnly
                      ? tx("Alleen ontwerpen")
                      : tx("BLE-printprotocol aanwezig")}
                  </span>
                  <small>
                    {model.specs.dpi
                      ? `${model.specs.dpi} dpi`
                      : tx("Resolutie niet bevestigd")}{" "}
                    ·{" "}
                    {model.connections
                      .map((connection) => tx(CONNECTION_LABELS[connection]))
                      .join(" / ")}
                  </small>
                  {(model.specs.evidence === "conflicting" ||
                    model.specs.evidence === "unverified") && (
                    <small className="printer-limited">
                      {tx("Firmware / specificaties controleren")}{" "}
                    </small>
                  )}
                </span>
              </button>
            ))}
          </div>
          {results.length > RESULT_LIMIT && (
            <button
              disabled={disabled}
              className="printer-more"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll
                ? tx("Minder tonen")
                : tx("showAllModels", { count: results.length })}
            </button>
          )}
          <button
            className="printer-back"
            disabled={disabled}
            onClick={() => change({ ...EMPTY_FILTERS })}
          >
            {tx("Filters wissen")}{" "}
          </button>
        </>
      )}
      {step === 2 && candidate !== undefined && (
        <>
          <h4>{tx("Controleer jouw keuze")}</h4>
          <div className="printer-review">
            <strong>{chosen?.name ?? tx("Automatisch herkennen")}</strong>
            {chosen ? (
              <>
                <p>
                  {tx("Ontwerppreset:")}{" "}
                  {number(chosen.defaults.recommendedSize.widthMm)} ×{" "}
                  {number(chosen.defaults.recommendedSize.heightMm)} mm ·{" "}
                  {number(chosen.defaults.dpi)} {tx("dpi · dichtheid")}{" "}
                  {chosen.defaults.density}.
                </p>
                <p className={chosen.designOnly ? "printer-limited" : ""}>
                  {chosen.designOnly
                    ? tx(
                        "Alleen ontwerpen: direct printen naar dit model is nog niet geïmplementeerd. Je kunt labels ontwerpen en als PNG exporteren.",
                      )
                    : tx(
                        "Voor dit model is een BLE-printprotocol aanwezig. De browser controleert de echte apparaatnaam bij verbinden. Fysieke afdrukkwaliteit is nog niet gecertificeerd.",
                      )}
                </p>
                {getPrinterImage(chosen.id) && (
                  <p className="printer-photo-source">
                    {tx(
                      "Afbeelding gekoppeld aan de productbron en modelreferentie. Uitvoering of kleur kan verschillen.",
                    )}{" "}
                    <a
                      href={getPrinterImage(chosen.id)!.source}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {tx("Bekijk de bron")}{" "}
                    </a>
                  </p>
                )}
                <PrinterSpecifications modelId={chosen.id} />
              </>
            ) : (
              <p>
                {tx(
                  "De browser laat je een apparaat kiezen. Alleen een herkend en ondersteund BLE-model krijgt printerinstellingen; onbekende printers worden niet geforceerd gekoppeld.",
                )}{" "}
              </p>
            )}
            <p>
              {tx(
                "Je ontwerp en labelmaat blijven behouden. Het aanbevolen formaat kun je later kiezen bij Instellingen.",
              )}{" "}
            </p>
            {applied ? (
              <p className="printer-applied" role="status">
                <Check size={16} />
                {tx("Printerkeuze bewaard")}{" "}
                {chosen?.designOnly
                  ? tx(" · geen directe printroute")
                  : tx(" · klaar voor de Bluetooth-kiezer")}
              </p>
            ) : (
              <button
                className="printer-apply"
                disabled={disabled}
                onClick={apply}
              >
                {tx("Gebruik dit printerprofiel")}{" "}
              </button>
            )}
          </div>
          <div className="printer-actions">
            <button disabled={disabled} onClick={() => setStep(1)}>
              {tx("Terug naar modellen")}{" "}
            </button>
            <button disabled={disabled} onClick={() => setStep(0)}>
              {tx("Andere printer kiezen")}{" "}
            </button>
          </div>
        </>
      )}
      {disabled && (
        <p className="printer-limited">
          {tx(
            "Rond de printopdracht af en verbreek de verbinding om een ander printerprofiel te kiezen.",
          )}{" "}
        </p>
      )}
    </section>
  );
}
