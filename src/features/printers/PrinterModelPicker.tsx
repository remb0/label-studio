import { useEffect, useState } from "react";
import { Bluetooth, Check, ChevronLeft, Search } from "lucide-react";
import { usePrinterStore } from "../../store/printer-store.ts";
import { useEditorV2Store } from "../../store/editor-store.ts";
import { usePrintSession } from "../../lib/print-session.ts";
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
  const selected = usePrinterStore((s) => s.preferredModelId);
  const locked = usePrinterStore(
    (s) => s.isConnected || s.isConnecting || s.isScanning || s.isPrinting,
  );
  const busy = usePrintSession();
  const disabled = locked || busy;
  const [step, setStep] = useState(selected ? 2 : 0);
  const [candidate, setCandidate] = useState<string | null | undefined>(
    selected ?? undefined,
  );
  const [applied, setApplied] = useState(!!selected);
  const [filters, setFilters] = useState<PrinterFilters>({ ...EMPTY_FILTERS });
  const [showAll, setShowAll] = useState(false);
  const results = filterPrinters(filters);
  const visible = showAll ? results : results.slice(0, RESULT_LIMIT);
  const chosen = candidate ? printerMetadata(candidate) : null;
  const ready =
    step === 2 && applied && candidate === selected && !chosen?.designOnly;
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
      aria-label="Printermodel kiezen"
    >
      <header>
        <h3>Vind jouw printer</h3>
        <p>
          Kijk op de onderkant of verpakking. Kies eerst het merk, vind je model
          en controleer wat al werkt.
        </p>
      </header>
      <ol className="printer-steps" aria-label="Stappen printerkeuze">
        {["Merk", "Model vinden", "Controleren"].map((name, index) => (
          <li key={name} aria-current={step === index ? "step" : undefined}>
            <span>{index + 1}</span>
            {name}
          </li>
        ))}
      </ol>
      {step === 0 && (
        <>
          <h4>Welk merk staat op jouw printer?</h4>
          <div className="printer-brands">
            {BRANDS.map((brand) => (
              <button
                key={brand.id}
                type="button"
                disabled={disabled}
                aria-label={`Kies merk ${brand.name}`}
                onClick={() => {
                  change({ ...EMPTY_FILTERS, brand: brand.id });
                  setStep(1);
                }}
              >
                <span className="printer-brand-logo">
                  {brand.logo ? (
                    <img src={brand.logo} alt="" />
                  ) : (
                    <span className="printer-wordmark">LuckP</span>
                  )}
                </span>
                <strong>{brand.name}</strong>
                <small>{brand.hint}</small>
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
              Ik weet het merk niet
            </button>
            <button
              disabled={disabled}
              onClick={() => {
                setFilters({ ...EMPTY_FILTERS });
                setShowAll(true);
                setStep(1);
              }}
            >
              Alles tonen ({filterPrinters(EMPTY_FILTERS).length})
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
              <strong>Automatisch herkennen</strong>
              <small>
                Voor ondersteunde BLE-printers. Je kiest zelf het apparaat in
                het browservenster.
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
            Terug naar merk
          </button>
          <h4>Zoek het modelnummer of filter op eigenschappen</h4>
          <label className="printer-search">
            <Search size={18} />
            <span className="sr-only">Zoek printermodel of Bluetoothnaam</span>
            <input
              disabled={disabled}
              value={filters.query}
              placeholder="Bijvoorbeeld D11s, 450 Turbo, P15 of LP90"
              onChange={(e) => change({ query: e.target.value })}
            />
          </label>
          <div className="printer-filters">
            <label>
              Merk
              <select
                aria-label="Merk"
                disabled={disabled}
                value={filters.brand}
                onChange={(e) =>
                  change({ brand: e.target.value as PrinterFilters["brand"] })
                }
              >
                <option value="any">Alle merken</option>
                {BRANDS.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Verbinding
              <select
                disabled={disabled}
                value={filters.connection}
                aria-label="Verbinding"
                onChange={(e) =>
                  change({
                    connection: e.target.value as PrinterFilters["connection"],
                  })
                }
              >
                <option value="any">Maakt niet uit</option>
                {Object.entries(CONNECTION_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Resolutie
              <select
                disabled={disabled}
                value={filters.dpi}
                aria-label="Resolutie"
                onChange={(e) =>
                  change({ dpi: e.target.value as PrinterFilters["dpi"] })
                }
              >
                <option value="any">Weet ik niet</option>
                <option value="203">203 dpi</option>
                <option value="300">300 dpi</option>
              </select>
            </label>
            <label>
              Papier
              <select
                disabled={disabled}
                value={filters.paper}
                aria-label="Papier"
                onChange={(e) =>
                  change({ paper: e.target.value as PrinterFilters["paper"] })
                }
              >
                <option value="any">Alle typen</option>
                <option value="gap">Losse labels</option>
                <option value="continuous">Doorlopende rol</option>
              </select>
            </label>
            <label>
              Labelmaat
              <select
                disabled={disabled}
                value={filters.size}
                aria-label="Labelmaat"
                onChange={(e) =>
                  change({ size: e.target.value as PrinterFilters["size"] })
                }
              >
                <option value="any">Alle maten</option>
                <option value="small">
                  Kleine labels · korte zijde ≤ 15 mm
                </option>
                <option value="shipping">
                  Verzendlabels · korte zijde ≥ 100 mm
                </option>
              </select>
            </label>
          </div>
          <p className="printer-count" role="status">
            {results.length
              ? `${visible.length} van ${results.length} passende modellen`
              : "Geen passend model gevonden. Probeer minder filters of meld jouw printer aan onderaan de printerpagina."}
          </p>
          <div className="printer-results">
            {visible.map((model) => (
              <button
                key={model.id}
                data-printer-result={model.id}
                disabled={disabled}
                aria-pressed={selected === model.id}
                onClick={() => propose(model.id)}
              >
                <strong>{model.name}</strong>
                <small>{model.subtitle}</small>
                <span
                  className={
                    model.designOnly ? "printer-badge limited" : "printer-badge"
                  }
                >
                  {model.designOnly
                    ? "Alleen ontwerpen"
                    : "BLE-printprotocol aanwezig"}
                </span>
                <small>
                  {model.defaults.dpi} dpi ·{" "}
                  {model.connections
                    .map((connection) => CONNECTION_LABELS[connection])
                    .join(" / ")}
                </small>
              </button>
            ))}
          </div>
          {results.length > RESULT_LIMIT && (
            <button
              disabled={disabled}
              className="printer-more"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "Minder tonen" : `Alles tonen (${results.length})`}
            </button>
          )}
          <button
            className="printer-back"
            disabled={disabled}
            onClick={() => change({ ...EMPTY_FILTERS })}
          >
            Filters wissen
          </button>
        </>
      )}
      {step === 2 && candidate !== undefined && (
        <>
          <h4>Controleer jouw keuze</h4>
          <div className="printer-review">
            <strong>{chosen?.name ?? "Automatisch herkennen"}</strong>
            {chosen ? (
              <>
                <p>
                  Aanbevolen label: {chosen.defaults.recommendedSize.widthMm} ×{" "}
                  {chosen.defaults.recommendedSize.heightMm} mm ·{" "}
                  {chosen.defaults.dpi} dpi · dichtheid{" "}
                  {chosen.defaults.density}.
                </p>
                <p className={chosen.designOnly ? "printer-limited" : ""}>
                  {chosen.designOnly
                    ? "Alleen ontwerpen: direct printen naar dit model is nog niet geïmplementeerd. Je kunt labels ontwerpen en als PNG exporteren."
                    : "Voor dit model is een BLE-printprotocol aanwezig. De browser controleert de echte apparaatnaam bij verbinden. Fysieke afdrukkwaliteit is nog niet gecertificeerd."}
                </p>
              </>
            ) : (
              <p>
                De browser laat je een apparaat kiezen. Alleen een herkend en
                ondersteund BLE-model krijgt printerinstellingen; onbekende
                printers worden niet geforceerd gekoppeld.
              </p>
            )}
            <p>
              Je ontwerp en labelmaat blijven behouden. Het aanbevolen formaat
              kun je later kiezen bij Instellingen.
            </p>
            {applied ? (
              <p className="printer-applied" role="status">
                <Check size={16} />
                Printerkeuze bewaard
                {chosen?.designOnly
                  ? " · geen directe printroute"
                  : " · klaar voor de Bluetooth-kiezer"}
              </p>
            ) : (
              <button
                className="printer-apply"
                disabled={disabled}
                onClick={apply}
              >
                Gebruik dit printerprofiel
              </button>
            )}
          </div>
          <div className="printer-actions">
            <button disabled={disabled} onClick={() => setStep(1)}>
              Terug naar modellen
            </button>
            <button disabled={disabled} onClick={() => setStep(0)}>
              Andere printer kiezen
            </button>
          </div>
        </>
      )}
      {disabled && (
        <p className="printer-limited">
          Rond de printopdracht af en verbreek de verbinding om een ander
          printerprofiel te kiezen.
        </p>
      )}
    </section>
  );
}
