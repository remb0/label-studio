import { useNumberFormatter, useT } from "../../../lib/i18n.ts";

import { Settings, X } from "lucide-react";
import { useState } from "react";
import { useEditorV2Store } from "../../../store/editor-store.ts";
import { usePrinterStore } from "../../../store/printer-store.ts";
import { getDevice, type LabelSizePreset } from "@thermoprint/core";
import { resizeLabel, labelDpi } from "../../../label/document.ts";
import { FormatPicker } from "../../../components/FormatPicker.tsx";
import {
  applyFormat,
  exceedsPrintWidth,
} from "../../../label/format-presets.ts";

// Fallback sizes when no printer is connected
const FALLBACK_GAP_SIZES: LabelSizePreset[] = [
  { widthMm: 22, heightMm: 12 },
  { widthMm: 30, heightMm: 12 },
  { widthMm: 30, heightMm: 15 },
  { widthMm: 40, heightMm: 12 },
  { widthMm: 40, heightMm: 15 },
  { widthMm: 50, heightMm: 15 },
  { widthMm: 50, heightMm: 30 },
];
const FALLBACK_CONTINUOUS_SIZES: LabelSizePreset[] = [
  { widthMm: 22, heightMm: 12 },
  { widthMm: 30, heightMm: 15 },
  { widthMm: 40, heightMm: 12 },
  { widthMm: 40, heightMm: 15 },
  { widthMm: 50, heightMm: 15 },
];

function useLabelConfig(): {
  supportedPaperTypes: ("gap" | "continuous")[];
  sizesForPaperType: (pt: "gap" | "continuous") => LabelSizePreset[];
  hasProfile: boolean;
} {
  const modelId = usePrinterStore((s) => s.modelId ?? s.preferredModelId);
  const profile = modelId ? getDevice(modelId) : null;
  const lc = profile?.labelConfig;

  if (lc) {
    return {
      supportedPaperTypes: lc.supportedPaperTypes,
      sizesForPaperType: (pt) =>
        pt === "gap" ? lc.gapSizes : lc.continuousSizes,
      hasProfile: true,
    };
  }

  return {
    supportedPaperTypes: ["gap", "continuous"],
    sizesForPaperType: (pt) =>
      pt === "gap" ? FALLBACK_GAP_SIZES : FALLBACK_CONTINUOUS_SIZES,
    hasProfile: false,
  };
}

interface Props {
  onClose: () => void;
}

export function PrintSettingsFlyout({ onClose }: Props) {
  const number = useNumberFormatter();
  const tx = useT();
  const [units, setUnits] = useState<"mm" | "px">("mm");
  const [sizeError, setSizeError] = useState("");
  const rollDirection = useEditorV2Store((s) => s.rollDirection);
  const printSettings = useEditorV2Store((s) => s.printSettings);
  const paperType = useEditorV2Store((s) => s.paperType);
  const label = useEditorV2Store((s) => s.label);
  const isConnected = usePrinterStore((s) => s.isConnected);
  const modelId = usePrinterStore((s) => s.modelId ?? s.preferredModelId);
  const uiScale = useEditorV2Store((s) => s.uiScale);
  const setUiScale = useEditorV2Store((s) => s.setUiScale);
  const theme = useEditorV2Store((s) => s.theme);
  const mode = useEditorV2Store((s) => s.mode);
  const setTheme = useEditorV2Store((s) => s.setTheme);
  const setMode = useEditorV2Store((s) => s.setMode);

  const themes = [
    { id: "cyan", name: "Cyan", swatch: "#2ad0ff" },
    { id: "amber", name: "Amber", swatch: "#ff9f40" },
    { id: "graphite", name: "Graphite", swatch: "#e6e6eb" },
    { id: "violet", name: "Violet", swatch: "#a78bfa" },
    { id: "forest", name: "Forest", swatch: "#6ecc93" },
    { id: "paper", name: "Paper", swatch: "#e2bc7a" },
  ];

  const { supportedPaperTypes, sizesForPaperType, hasProfile } =
    useLabelConfig();
  const availableSizes = sizesForPaperType(paperType);
  const printerWidth = modelId ? getDevice(modelId)?.printWidth : undefined;

  const updateSettings = (patch: Partial<typeof printSettings>) => {
    useEditorV2Store.setState((s) => ({
      printSettings: { ...s.printSettings, ...patch },
      currentLabelDirty: true,
    }));
    usePrinterStore.getState().updateSettings({
      ...(patch.density !== undefined
        ? { density: patch.density as 1 | 2 | 3 }
        : {}),
      ...(patch.ditherMode !== undefined
        ? {
            ditherMode: patch.ditherMode as
              "threshold" | "none" | "floyd-steinberg",
          }
        : {}),
      ...(patch.threshold !== undefined ? { threshold: patch.threshold } : {}),
    });
  };

  const setPaperType = (pt: "gap" | "continuous") => {
    useEditorV2Store.setState({ paperType: pt, currentLabelDirty: true });
    // A custom document size stays intact when changing paper feed mode.
    usePrinterStore.getState().updateSettings({ paperType: pt });
  };

  const setLabelSize = (widthMm: number, heightMm: number) => {
    try {
      useEditorV2Store.setState({
        label: resizeLabel(label, widthMm, heightMm),
        currentLabelDirty: true,
      });
      setSizeError("");
    } catch (error) {
      setSizeError((error as Error).message);
    }
  };

  return (
    <div
      role="dialog"
      aria-label={tx("Label- en printinstellingen")}
      className="fixed inset-x-2 top-24 bottom-24 md:inset-auto md:absolute md:bottom-40 md:left-1/2 md:-translate-x-1/2 md:w-[420px] md:max-h-[calc(100dvh-240px)] flex flex-col overflow-hidden bg-ink-850/95 backdrop-blur-sm border border-white/8 rounded-lg shadow-panel z-40"
    >
      <div className="flex items-center justify-between px-3 h-9 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Settings size={14} className="text-accent" />
          <span className="text-ui-base font-semibold text-ink-100">
            {tx("Label- en printinstellingen")}{" "}
          </span>
        </div>
        <button
          aria-label={tx("Instellingen sluiten")}
          onClick={onClose}
          className="text-ink-400 hover:text-ink-100"
        >
          <X size={14} />
        </button>
      </div>
      <div className="p-4 space-y-5 overflow-y-auto overscroll-contain min-h-0">
        <section className="space-y-3">
          <div>
            <h3 className="font-semibold">{tx("Kies je labelformaat")}</h3>
            <p className="text-ui-sm text-ink-400 mt-1">
              {tx(
                "Kies de vorm en maat van je rol. Je kunt de afmetingen daarna aanpassen.",
              )}{" "}
            </p>
          </div>
          <FormatPicker
            label={label}
            paperType={paperType}
            modelId={modelId}
            maxPixels={printerWidth}
            onSelect={(preset) => {
              useEditorV2Store.setState({
                label: applyFormat(label, preset),
                paperType: preset.paperType,
                rollDirection: preset.rollDirection,
                currentLabelDirty: true,
              });
              usePrinterStore
                .getState()
                .updateSettings({ paperType: preset.paperType });
              setSizeError("");
            }}
          />
          {printerWidth !== undefined &&
            exceedsPrintWidth(label, rollDirection, printerWidth) && (
              <p role="status" className="text-ui-sm text-amber-400">
                {tx(
                  "Dit formaat is in deze doorvoerrichting breder dan de printkop. Kies een kleiner formaat of pas de doorvoerrichting aan.",
                )}{" "}
              </p>
            )}
        </section>
        <details className="space-y-3 border-b border-white/10 pb-4">
          <summary className="font-semibold cursor-pointer py-2">
            {tx("Formaat aanpassen")}{" "}
          </summary>
          <div className="flex gap-2">
            {(["mm", "px"] as const).map((unit) => (
              <button
                key={unit}
                onClick={() => setUnits(unit)}
                aria-pressed={units === unit}
                className={`px-4 py-2 rounded-md ${units === unit ? "bg-accent/15 text-accent" : "bg-ink-800"}`}
              >
                {unit}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(["width", "height"] as const).map((axis) => (
              <label key={axis} className="text-ui-sm text-ink-300">
                {axis === "width" ? tx("Breedte") : tx("Hoogte")} ({units})
                <input
                  aria-label={`${axis === "width" ? tx("Breedte") : tx("Hoogte")} (${units})`}
                  type="number"
                  min={1}
                  step={units === "px" ? 1 : 0.1}
                  value={
                    units === "mm" ? label[`${axis}Mm`] : label[`${axis}Px`]
                  }
                  className="w-full mt-1 h-9 px-2 rounded-md bg-ink-800 border border-white/10"
                  onChange={(e) => {
                    const value =
                      Number(e.target.value) *
                      (units === "px" ? 25.4 / labelDpi(label) : 1);
                    setLabelSize(
                      axis === "width" ? value : label.widthMm,
                      axis === "height" ? value : label.heightMm,
                    );
                  }}
                />
              </label>
            ))}
          </div>
          {sizeError && (
            <p role="alert" className="text-ui-sm text-red-400">
              {tx(sizeError)}
            </p>
          )}
          <label className="block text-ui-sm text-ink-300">
            {tx("Documentresolutie")}{" "}
            <select
              aria-label={tx("Documentresolutie")}
              className="w-full mt-1 h-9 px-2 bg-ink-800 border border-white/10 rounded-md"
              value={labelDpi(label)}
              onChange={(e) => {
                const dpi = Number(e.target.value) as 203 | 300;
                const ratio = dpi / labelDpi(label);
                useEditorV2Store.setState((state) => ({
                  label: resizeLabel(label, label.widthMm, label.heightMm, dpi),
                  elements: state.elements.map((el) => ({
                    ...el,
                    x: el.x * ratio,
                    y: el.y * ratio,
                    width: el.width * ratio,
                    height: el.height * ratio,
                    props: {
                      ...el.props,
                      ...(typeof el.props.fontSize === "number"
                        ? { fontSize: el.props.fontSize * ratio }
                        : {}),
                      ...(typeof el.props.strokeWidth === "number"
                        ? { strokeWidth: el.props.strokeWidth * ratio }
                        : {}),
                    },
                  })),
                  currentLabelDirty: true,
                }));
              }}
            >
              <option value={203}>203 dpi</option>
              <option value={300}>300 dpi</option>
            </select>
          </label>
          <p className="text-ui-sm text-ink-400 leading-relaxed">
            {number(label.widthPx)} × {number(label.heightPx)}{" "}
            {tx(
              "pixels. Documentresolutie bepaalt de ontwerpscherpte. De huidige printerprofielen printen op 203 dpi; uitvoer wordt naar de fysieke labelmaat omgerekend.",
            )}{" "}
          </p>
          <label className="block text-ui-sm text-ink-300">
            {tx("Vorm")}{" "}
            <select
              aria-label={tx("Labelvorm")}
              className="w-full mt-1 h-9 px-2 bg-ink-800 border border-white/10 rounded-md"
              value={label.shape ?? "rectangle"}
              onChange={(e) =>
                useEditorV2Store.setState({
                  label: {
                    ...label,
                    shape: e.target.value as "rectangle" | "rounded" | "circle",
                  },
                  currentLabelDirty: true,
                })
              }
            >
              <option value="rectangle">{tx("Rechthoek")}</option>
              <option value="rounded">{tx("Afgeronde hoeken")}</option>
              <option value="circle">{tx("Cirkel / ovaal")}</option>
            </select>
          </label>
          <label className="block text-ui-sm text-ink-300">
            {tx("Verdeling")}{" "}
            <select
              aria-label={tx("Labelverdeling")}
              className="w-full mt-1 h-9 px-2 bg-ink-800 border border-white/10 rounded-md"
              value={label.split ?? "none"}
              onChange={(e) =>
                useEditorV2Store.setState({
                  label: {
                    ...label,
                    split: e.target.value as "none" | "horizontal" | "vertical",
                  },
                  currentLabelDirty: true,
                })
              }
            >
              <option value="none">{tx("Geen")}</option>
              <option value="horizontal">
                {tx("Horizontale scheidingslijn")}
              </option>
              <option value="vertical">{tx("Verticale scheidingslijn")}</option>
            </select>
          </label>
          <label className="block text-ui-sm text-ink-300">
            {tx("Doorvoerrichting")}{" "}
            <select
              aria-label={tx("Doorvoerrichting")}
              className="w-full mt-1 h-9 px-2 bg-ink-800 border border-white/10 rounded-md"
              value={rollDirection}
              onChange={(e) =>
                useEditorV2Store.setState({
                  rollDirection: e.target.value as "horizontal" | "vertical",
                  currentLabelDirty: true,
                })
              }
            >
              <option value="horizontal">
                {tx("Horizontaal (ontwerp 90° draaien)")}{" "}
              </option>
              <option value="vertical">{tx("Verticaal (rechtstreeks)")}</option>
            </select>
          </label>
          <p className="text-ui-sm text-ink-400">
            {tx(
              "Labelinstellingen worden samen met het sjabloon bewaard. De scheidingslijn wordt ook geprint.",
            )}{" "}
          </p>
        </details>
        {/* Interfacegrootte */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-ui-2xs font-mono uppercase tracking-wider text-ink-400">
              {tx("Interfacegrootte")}{" "}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-ui-xs font-mono text-ink-100 tabular-nums">
                {number(Math.round(uiScale * 100))}%
              </span>
              {uiScale !== 1 && (
                <button
                  onClick={() => setUiScale(1)}
                  className="text-ui-2xs font-mono text-ink-400 hover:text-accent hover-fade"
                >
                  {tx("Reset")}{" "}
                </button>
              )}
            </div>
          </div>
          <input
            type="range"
            min={0.8}
            max={1.4}
            step={0.05}
            value={uiScale}
            onChange={(e) => setUiScale(parseFloat(e.target.value))}
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-ui-2xs font-mono text-ink-500 mt-0.5">
            <span>80%</span>
            <span>140%</span>
          </div>
        </div>

        <div className="border-t border-white/5" />

        {/* Theme */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-ui-2xs font-mono uppercase tracking-wider text-ink-400">
              {tx("Theme")}{" "}
            </div>
            <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-ink-800 border border-white/5">
              {([tx("dark"), tx("light")] as const).map((m) => (
                <button
                  key={tx(m)}
                  onClick={() => setMode(m)}
                  className={`px-2 h-6 rounded-[3px] text-ui-2xs font-medium capitalize ${
                    mode === m
                      ? "bg-ink-700 text-accent"
                      : "text-ink-400 hover:text-ink-100"
                  }`}
                >
                  {tx(m)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {themes.map((t) => {
              const active = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`flex items-center gap-1.5 h-8 px-2 rounded-md border hover-fade ${
                    active
                      ? "bg-accent/10 border-accent/40 text-accent"
                      : "bg-ink-800 border-white/5 text-ink-200 hover:border-white/15"
                  }`}
                  title={tx("themeName", { name: tx(t.name) })}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 ring-1 ring-black/20"
                    style={{ background: t.swatch }}
                  />
                  <span className="text-ui-xs font-medium">{tx(t.name)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-white/5" />

        {/* Papiersoort */}
        <div>
          <div className="text-ui-xs font-mono uppercase tracking-wider text-ink-400 mb-1.5">
            {tx("Papiersoort")}{" "}
          </div>
          <div className="flex items-center gap-1 p-0.5 rounded-md bg-ink-800 border border-white/5">
            {(["gap", "continuous"] as const).map((pt) => {
              const supported = supportedPaperTypes.includes(pt);
              return (
                <button
                  key={pt}
                  onClick={() => supported && setPaperType(pt)}
                  disabled={!supported}
                  className={`flex-1 h-7 rounded-[4px] text-ui-sm font-medium ${
                    paperType === pt
                      ? "bg-ink-700 text-accent"
                      : supported
                        ? "text-ink-300 hover:text-ink-100"
                        : "text-ink-600 cursor-not-allowed"
                  }`}
                >
                  {pt === "gap" ? tx("Losse labels (gap)") : tx("Doorlopend")}
                </button>
              );
            })}
          </div>
          {hasProfile && supportedPaperTypes.length === 1 && (
            <div className="text-ui-2xs text-ink-500 mt-1 font-mono">
              {tx("Alleen")}{" "}
              {tx(
                supportedPaperTypes[0] === "gap"
                  ? "Losse labels"
                  : "Doorlopende rol",
              )}{" "}
              {tx("ondersteund door deze printer")}{" "}
            </div>
          )}
        </div>

        {/* Extra maten uit het printerprofiel */}
        <details>
          <summary className="text-ui-sm cursor-pointer">
            {tx("Alle printermaten")}{" "}
          </summary>
          <div className="text-ui-xs font-mono uppercase tracking-wider text-ink-400 mb-1.5">
            {tx("Labelmaat")}{" "}
          </div>
          <div className="grid grid-cols-2 gap-1">
            {availableSizes.map((s) => {
              const active =
                s.widthMm === label.widthMm && s.heightMm === label.heightMm;
              return (
                <button
                  key={`${s.widthMm}x${s.heightMm}`}
                  onClick={() => setLabelSize(s.widthMm, s.heightMm)}
                  className={`h-7 rounded-md text-ui-xs font-mono border ${
                    active
                      ? "bg-accent/10 text-accent border-accent/30"
                      : "bg-ink-800 text-ink-300 border-white/5 hover:text-ink-100 hover:bg-ink-750"
                  }`}
                >
                  {number(s.widthMm)} × {number(s.heightMm)} mm
                </button>
              );
            })}
          </div>
        </details>

        {/* Zwarting */}
        <div>
          <div className="text-ui-xs font-mono uppercase tracking-wider text-ink-400 mb-1.5">
            {tx("Zwarting")}{" "}
          </div>
          <div className="flex items-center gap-1 p-0.5 rounded-md bg-ink-800 border border-white/5">
            {[1, 2, 3].map((d) => (
              <button
                key={d}
                onClick={() => updateSettings({ density: d })}
                className={`flex-1 h-7 rounded-[4px] text-ui-sm font-medium ${
                  printSettings.density === d
                    ? "bg-ink-700 text-accent"
                    : "text-ink-300"
                }`}
              >
                {[tx("Licht"), tx("Normaal"), tx("Donker")][d - 1]}
              </button>
            ))}
          </div>
        </div>

        {/* Dither */}
        <div>
          <div className="text-ui-xs font-mono uppercase tracking-wider text-ink-400 mb-1.5">
            {tx("Dither")}{" "}
          </div>
          <div className="grid grid-cols-3 gap-1">
            {[
              { v: "floyd-steinberg", l: "Floyd-S" },
              { v: "threshold", l: tx("Drempel") },
              { v: "none", l: tx("Geen") },
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => updateSettings({ ditherMode: o.v })}
                className={`h-7 rounded-md text-ui-xs font-medium border ${
                  printSettings.ditherMode === o.v
                    ? "bg-accent/10 text-accent border-accent/30"
                    : "bg-ink-800 text-ink-300 border-white/5"
                }`}
              >
                {tx(o.l)}
              </button>
            ))}
          </div>
        </div>

        {/* Drempel */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-ui-xs font-mono uppercase tracking-wider text-ink-400">
              {tx("Drempel")}{" "}
            </div>
            <div className="text-ui-sm font-mono text-ink-100">
              {number(printSettings.threshold)}
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={255}
            value={printSettings.threshold}
            onChange={(e) =>
              updateSettings({ threshold: Number(e.target.value) })
            }
            className="w-full accent-accent"
          />
        </div>

        {/* Printer info */}
        <div className="pt-2 border-t border-white/5 text-ui-sm">
          <div className="flex items-center justify-between">
            <span className="text-ink-400">{tx("Printer")}</span>
            <span className="text-ink-100 font-mono">
              {isConnected ? modelId || tx("Connected") : tx("Niet verbonden")}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-ink-400">{tx("Huidig label")}</span>
            <span className="text-ink-100 font-mono">
              {number(label.widthMm)} × {number(label.heightMm)} mm ·{" "}
              {tx(paperType === "gap" ? "Losse labels" : "Doorlopende rol")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
