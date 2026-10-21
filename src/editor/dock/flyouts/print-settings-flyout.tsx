import { Settings, X } from "lucide-react";
import { useState } from "react";
import { useEditorV2Store } from "../../../store/editor-store.ts";
import { usePrinterStore } from "../../../store/printer-store.ts";
import { getDevice, type LabelSizePreset } from "@thermoprint/core";
import { resizeLabel, labelDpi } from "../../../label/document.ts";

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
  const modelId = usePrinterStore((s) => s.modelId);
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
  const [units, setUnits] = useState<"mm" | "px">("mm");
  const [sizeError, setSizeError] = useState("");
  const rollDirection = useEditorV2Store((s) => s.rollDirection);
  const printSettings = useEditorV2Store((s) => s.printSettings);
  const paperType = useEditorV2Store((s) => s.paperType);
  const label = useEditorV2Store((s) => s.label);
  const isConnected = usePrinterStore((s) => s.isConnected);
  const modelId = usePrinterStore((s) => s.modelId);
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
      aria-label="Label- en printinstellingen"
      className="fixed inset-x-2 top-24 bottom-24 md:inset-auto md:absolute md:bottom-40 md:left-1/2 md:-translate-x-1/2 md:w-[420px] md:max-h-[calc(100dvh-240px)] flex flex-col overflow-hidden bg-ink-850/95 backdrop-blur-sm border border-white/8 rounded-lg shadow-panel z-40"
    >
      <div className="flex items-center justify-between px-3 h-9 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Settings size={14} className="text-accent" />
          <span className="text-ui-base font-semibold text-ink-100">
            Label- en printinstellingen
          </span>
        </div>
        <button
          aria-label="Instellingen sluiten"
          onClick={onClose}
          className="text-ink-400 hover:text-ink-100"
        >
          <X size={14} />
        </button>
      </div>
      <div className="p-4 space-y-5 overflow-y-auto overscroll-contain min-h-0">
        <div className="space-y-3 border-b border-white/10 pb-4">
          <h3 className="font-semibold">Eigen labelmaat</h3>
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
                {axis === "width" ? "Breedte" : "Hoogte"} ({units})
                <input
                  aria-label={`${axis === "width" ? "Breedte" : "Hoogte"} (${units})`}
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
              {sizeError}
            </p>
          )}
          <label className="block text-ui-sm text-ink-300">
            Documentresolutie
            <select
              aria-label="Documentresolutie"
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
            {label.widthPx} × {label.heightPx} pixels. Documentresolutie bepaalt
            de ontwerpscherpte. De huidige printerprofielen printen op 203 dpi;
            uitvoer wordt naar de fysieke labelmaat omgerekend.
          </p>
          <label className="block text-ui-sm text-ink-300">
            Vorm
            <select
              aria-label="Labelvorm"
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
              <option value="rectangle">Rechthoek</option>
              <option value="rounded">Afgeronde hoeken</option>
              <option value="circle">Cirkel / ovaal</option>
            </select>
          </label>
          <label className="block text-ui-sm text-ink-300">
            Verdeling
            <select
              aria-label="Labelverdeling"
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
              <option value="none">Geen</option>
              <option value="horizontal">Horizontale scheidingslijn</option>
              <option value="vertical">Verticale scheidingslijn</option>
            </select>
          </label>
          <label className="block text-ui-sm text-ink-300">
            Doorvoerrichting
            <select
              aria-label="Doorvoerrichting"
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
                Horizontaal (ontwerp 90° draaien)
              </option>
              <option value="vertical">Verticaal (rechtstreeks)</option>
            </select>
          </label>
          <p className="text-ui-sm text-ink-400">
            Labelinstellingen worden samen met het sjabloon bewaard. De
            scheidingslijn wordt ook geprint.
          </p>
        </div>
        {/* Interfacegrootte */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-ui-2xs font-mono uppercase tracking-wider text-ink-400">
              Interfacegrootte
            </div>
            <div className="flex items-center gap-2">
              <span className="text-ui-xs font-mono text-ink-100 tabular-nums">
                {Math.round(uiScale * 100)}%
              </span>
              {uiScale !== 1 && (
                <button
                  onClick={() => setUiScale(1)}
                  className="text-ui-2xs font-mono text-ink-400 hover:text-accent hover-fade"
                >
                  Reset
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
              Theme
            </div>
            <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-ink-800 border border-white/5">
              {(["dark", "light"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-2 h-6 rounded-[3px] text-ui-2xs font-medium capitalize ${
                    mode === m
                      ? "bg-ink-700 text-accent"
                      : "text-ink-400 hover:text-ink-100"
                  }`}
                >
                  {m}
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
                  title={`${t.name} theme`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 ring-1 ring-black/20"
                    style={{ background: t.swatch }}
                  />
                  <span className="text-ui-xs font-medium">{t.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-white/5" />

        {/* Papiersoort */}
        <div>
          <div className="text-ui-xs font-mono uppercase tracking-wider text-ink-400 mb-1.5">
            Papiersoort
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
                  {pt === "gap" ? "Losse labels (gap)" : "Doorlopend"}
                </button>
              );
            })}
          </div>
          {hasProfile && supportedPaperTypes.length === 1 && (
            <div className="text-ui-2xs text-ink-500 mt-1 font-mono">
              Alleen {supportedPaperTypes[0]} ondersteund door deze printer
            </div>
          )}
        </div>

        {/* Labelmaat */}
        <div>
          <div className="text-ui-xs font-mono uppercase tracking-wider text-ink-400 mb-1.5">
            Labelmaat
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
                  {s.widthMm} × {s.heightMm} mm
                </button>
              );
            })}
          </div>
        </div>

        {/* Zwarting */}
        <div>
          <div className="text-ui-xs font-mono uppercase tracking-wider text-ink-400 mb-1.5">
            Zwarting
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
                {["Licht", "Normaal", "Donker"][d - 1]}
              </button>
            ))}
          </div>
        </div>

        {/* Dither */}
        <div>
          <div className="text-ui-xs font-mono uppercase tracking-wider text-ink-400 mb-1.5">
            Dither
          </div>
          <div className="grid grid-cols-3 gap-1">
            {[
              { v: "floyd-steinberg", l: "Floyd-S" },
              { v: "threshold", l: "Drempel" },
              { v: "none", l: "Geen" },
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
                {o.l}
              </button>
            ))}
          </div>
        </div>

        {/* Drempel */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-ui-xs font-mono uppercase tracking-wider text-ink-400">
              Drempel
            </div>
            <div className="text-ui-sm font-mono text-ink-100">
              {printSettings.threshold}
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
            <span className="text-ink-400">Printer</span>
            <span className="text-ink-100 font-mono">
              {isConnected ? modelId || "Connected" : "Niet verbonden"}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-ink-400">Huidig label</span>
            <span className="text-ink-100 font-mono">
              {label.widthMm} × {label.heightMm} mm · {paperType}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
