import { Bluetooth, Check } from "lucide-react";
import { usePrinterStore } from "../../store/printer-store.ts";
import { useEditorV2Store } from "../../store/editor-store.ts";
import { usePrintSession } from "../../lib/print-session.ts";
import { getCompatibilityLevel } from "./PrinterCompatibility.tsx";
import { useLanguage, t } from "../../lib/i18n.ts";
import { getPrinterModelDefaults, ALL_PRINTER_MODELS, isDesignOnlyModel } from "./model-catalog.ts";

function PrinterIllustration({
  shape,
}: {
  shape: "wide" | "compact" | "slim";
}) {
  const width = shape === "wide" ? 64 : shape === "slim" ? 40 : 50;
  const x = (100 - width) / 2;
  return (
    <svg
      viewBox="0 0 100 84"
      className="h-20 w-24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x={x}
        y="17"
        width={width}
        height="54"
        rx="14"
        fill="currentColor"
        opacity=".12"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d={`M${x + 8} 34H${x + width - 8}`}
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect
        x={x + 10}
        y="8"
        width={width - 20}
        height="24"
        rx="3"
        fill="var(--color-ink-850)"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d={`M${x + 16} 17H${x + width - 16}M${x + 16} 23H${x + width - 20}`}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity=".65"
      />
      <circle
        cx={x + width / 2}
        cy="55"
        r="5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx={x + width - 12} cy="43" r="2" fill="currentColor" />
    </svg>
  );
}

/** Model preference is separate from a real Bluetooth connection. */
export function PrinterModelPicker({ className = "" }: { className?: string }) {
  const selected = usePrinterStore((s) => s.preferredModelId);
  const language = useLanguage((s) => s.language);
  const locked = usePrinterStore(
    (s) => s.isConnected || s.isConnecting || s.isScanning || s.isPrinting,
  );
  const busy = usePrintSession();
  const disabled = locked || busy;
  const defaults = selected ? getPrinterModelDefaults(selected) : null;

  function select(modelId: string | null) {
    usePrinterStore.getState().selectPreferredModel(modelId);
    if (disabled) return;
    const settings = usePrinterStore.getState().settings;
    useEditorV2Store.setState({
      printSettings: {
        density: settings.density,
        ditherMode: settings.ditherMode,
        threshold: settings.threshold,
      },
    });
  }

  return (
    <section className={className} aria-label="Printermodel kiezen">
      <h3 className="text-ui-base font-semibold text-ink-100 mb-1">
        Kies je printer
      </h3>
      <p className="text-ui-sm text-ink-400 mb-3">
        De instellingen passen zich aan het apparaat aan. Je ontwerp en
        labelmaat blijven behouden.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled}
          aria-pressed={selected === null}
          onClick={() => select(null)}
          className={`col-span-2 flex items-center gap-3 rounded-lg border p-3 text-left disabled:opacity-50 ${selected === null ? "border-accent bg-accent/10" : "border-white/10 bg-ink-800/50 hover:border-accent/50"}`}
        >
          <Bluetooth size={24} className="text-accent shrink-0" />
          <span className="flex-1">
            <span className="block text-ui-base text-ink-100 font-medium">
              Automatisch herkennen
            </span>
            <span className="text-ui-sm text-ink-400">
              Kies de printer straks in het Bluetoothvenster.
            </span>
          </span>
          {selected === null && <Check size={16} className="text-accent" />}
        </button>
        {ALL_PRINTER_MODELS.map((model) => {
          const active = selected === model.id;
          const config = getPrinterModelDefaults(model.id)!;
          return (
            <button
              type="button"
              key={model.id}
              disabled={disabled}
              aria-pressed={active}
              onClick={() => select(model.id)}
              className={`relative flex flex-col items-center rounded-lg border p-3 text-center disabled:opacity-50 ${active ? "border-accent bg-accent/10 text-accent" : "border-white/10 bg-ink-800/50 text-ink-400 hover:border-accent/50"}`}
            >
              {active && <Check size={16} className="absolute right-2 top-2" />}
              <PrinterIllustration shape={model.silhouette} />
              <span className="text-ui-base text-ink-100 font-semibold">
                {model.name}
              </span>
              <span className="text-ui-xs text-ink-400 mt-1">
                {model.subtitle}
              </span>
              <span className="text-ui-xs text-ink-500 mt-1">{t(language,getCompatibilityLevel(model.id)==="studio-certified" ? "certified" : "unknown")}</span>
              <span className="text-ui-xs text-ink-500 mt-1">
                {isDesignOnlyModel(model.id) ? "Ontwerpprofiel · printen nog niet ondersteund" : config.supportedPaperTypes.includes("continuous")
                  ? "Losse labels en doorlopend papier"
                  : "Losse labels"}
              </span>
            </button>
          );
        })}
      </div>
      {defaults && (
        <p className="mt-3 text-ui-sm text-ink-400">
          {selected && isDesignOnlyModel(selected) ? "Alleen ontwerpen · " : ""}Aanbevolen label: {defaults.recommendedSize.widthMm} ×{" "}
          {defaults.recommendedSize.heightMm} mm · {defaults.dpi} dpi ·
          dichtheid {defaults.density}. Pas de labelmaat aan bij Formaat.
        </p>
      )}
      {locked && (
        <p className="mt-2 text-ui-xs text-ink-400">
          Verbreek de verbinding om een ander printermodel te kiezen.
        </p>
      )}
    </section>
  );
}
