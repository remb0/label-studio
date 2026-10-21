import { Check } from "lucide-react";
import {
  getFormatPresets,
  type FormatPreset,
  exceedsPrintWidth,
} from "../label/format-presets.ts";
import type { LabelSize } from "../store/editor-store.ts";
import { favoritesFirst, useFavorites } from "../lib/favorites.ts";
import { FavoriteButton, FavoritesStorageNotice } from "./FavoriteButton.tsx";

interface Props {
  label: LabelSize;
  paperType: "gap" | "continuous";
  modelId: string | null;
  maxPixels?: number;
  onSelect: (preset: FormatPreset) => void;
}

export function FormatPicker({
  label,
  paperType,
  modelId,
  maxPixels,
  onSelect,
}: Props) {
  const favorites = useFavorites((state) => state.ids);
  return (
    <>
      <div
        className="grid grid-cols-2 sm:grid-cols-3 gap-2"
        aria-label="Labelformaten"
      >
        {favoritesFirst(getFormatPresets(modelId), "format", favorites).map(
          (preset) => {
            const active =
              label.widthMm === preset.widthMm &&
              label.heightMm === preset.heightMm &&
              (label.shape ?? "rectangle") === preset.shape &&
              paperType === preset.paperType;
            const scale = Math.min(
              1.5,
              78 / preset.widthMm,
              54 / preset.heightMm,
            );
            const tooWide =
              maxPixels !== undefined &&
              exceedsPrintWidth(preset, preset.rollDirection, maxPixels);
            return (
              <div
                key={preset.id}
                className="relative min-w-0"
                data-format-card={preset.id}
              >
                <button
                  type="button"
                  aria-label={`${preset.name}, ${preset.widthMm} × ${preset.heightMm} mm, ${preset.paperType === "gap" ? "los label" : "doorlopend"}`}
                  aria-pressed={active}
                  onClick={() => {
                    if (!tooWide) onSelect(preset);
                  }}
                  disabled={tooWide}
                  className={`relative w-full min-w-0 h-full rounded-xl border p-2 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${active ? "border-accent/70 bg-accent/10 text-accent" : "border-white/10 bg-ink-800 text-ink-200 hover:border-accent/40"}`}
                >
                  {active && (
                    <Check
                      size={13}
                      className="absolute top-2 left-2"
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className="h-16 flex items-center justify-center"
                    aria-hidden="true"
                  >
                    <span
                      style={{
                        width: preset.widthMm * scale,
                        height: preset.heightMm * scale,
                        borderRadius:
                          preset.shape === "circle"
                            ? "50%"
                            : preset.shape === "rounded"
                              ? 6
                              : 2,
                      }}
                      className="flex flex-col justify-center gap-1 px-2 bg-white shadow-md border border-black/10"
                    >
                      <span className="block w-2/3 h-0.5 bg-slate-400" />
                      <span className="block w-full h-0.5 bg-slate-200" />
                    </span>
                  </span>
                  <span className="block text-ui-xs font-semibold truncate">
                    {preset.name}
                  </span>
                  <span className="block text-ui-2xs font-mono mt-0.5">
                    {preset.widthMm} × {preset.heightMm} mm
                  </span>
                  <span className="block text-ui-2xs text-ink-400 mt-1">
                    {tooWide
                      ? "Breder dan printer"
                      : preset.paperType === "gap"
                        ? "Los label"
                        : "Doorlopend"}
                  </span>
                </button>
                <FavoriteButton
                  kind="format"
                  id={preset.id}
                  name={`Formaat ${preset.name}`}
                />
              </div>
            );
          },
        )}
      </div>
      <FavoritesStorageNotice />
    </>
  );
}
