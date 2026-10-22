import { getDevice } from "@thermoprint/core";
import {
  ALL_PRINTER_MODELS,
  getModelLabelConfig,
  getPrinterModelDefaults,
  isDesignOnlyModel,
} from "./model-catalog.ts";

export const BRANDS = [
  {
    id: "action",
    name: "Action / Fichero",
    logo: "/brands/action.svg",
    hint: "D11s, mini pocket en LuckP/Fichero",
  },
  {
    id: "dymo",
    name: "DYMO",
    logo: "/brands/dymo.svg",
    hint: "LabelWriter 450, 550, 4XL en 5XL",
  },
  {
    id: "marklife",
    name: "Marklife",
    logo: "/brands/marklife.png",
    hint: "P12, P15 en M60 / X2",
  },
  {
    id: "luckp",
    name: "LuckP",
    logo: null,
    hint: "D1S / DP D1 / Fichero 3561",
  },
] as const;
export type BrandId = (typeof BRANDS)[number]["id"];
export type Connection = "ble" | "classic" | "wifi" | "usb" | "unknown";
export interface PrinterFilters {
  brand: BrandId | "any";
  query: string;
  connection: Connection | "any";
  dpi: "any" | "203" | "300";
  paper: "any" | "gap" | "continuous";
  size: "any" | "small" | "shipping";
}
export const EMPTY_FILTERS: PrinterFilters = {
  brand: "any",
  query: "",
  connection: "any",
  dpi: "any",
  paper: "any",
  size: "any",
};
export const RESULT_LIMIT = 4;
export const CONNECTION_LABELS: Record<Connection, string> = {
  ble: "Bluetooth LE",
  classic: "Bluetooth Classic",
  wifi: "Wifi / LAN",
  usb: "USB",
  unknown: "Nog niet geverifieerd",
};
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function printerMetadata(id: string) {
  const model = ALL_PRINTER_MODELS.find((item) => item.id === id);
  if (!model) throw new Error("Onbekend printermodel.");
  const brands: BrandId[] = id.startsWith("dymo-")
    ? ["dymo"]
    : id === "luckp-d1s"
      ? ["luckp", "action"]
      : id === "fichero-d11s" || id === "action-pocket-300"
        ? ["action"]
        : ["marklife"];
  const connections: Connection[] = !isDesignOnlyModel(id)
    ? ["ble"]
    : id.startsWith("dymo-")
      ? id === "dymo-550-turbo" || id === "dymo-5xl"
        ? ["usb", "wifi"]
        : ["usb"]
      : ["unknown"];
  const aliases =
    id === "luckp-d1s"
      ? "DP D1 Fichero 3561 LuckP_D1S"
      : id === "p12"
        ? "P11 LP90"
        : id === "m60"
          ? "X2"
          : "";
  const config = getModelLabelConfig(id)!;
  return {
    ...model,
    brands,
    connections,
    config,
    defaults: getPrinterModelDefaults(id)!,
    designOnly: isDesignOnlyModel(id),
    search: normalize(
      [
        model.name,
        model.subtitle,
        ...brands.map((brand) => BRANDS.find((b) => b.id === brand)!.name),
        aliases,
        ...(getDevice(id)?.namePrefixes ?? []),
      ].join(" "),
    ),
  };
}
export function filterPrinters(filters: PrinterFilters) {
  const words = normalize(filters.query).split(" ").filter(Boolean);
  return ALL_PRINTER_MODELS.map((model) => printerMetadata(model.id)).filter(
    (model) => {
      const sizes = [...model.config.gapSizes, ...model.config.continuousSizes];
      return (
        (filters.brand === "any" || model.brands.includes(filters.brand)) &&
        words.every((word) => model.search.includes(word)) &&
        (filters.connection === "any" ||
          model.connections.includes(filters.connection)) &&
        (filters.dpi === "any" || String(model.defaults.dpi) === filters.dpi) &&
        (filters.paper === "any" ||
          model.config.supportedPaperTypes.includes(filters.paper)) &&
        (filters.size === "any" ||
          sizes.some((size) =>
            filters.size === "small"
              ? Math.min(size.widthMm, size.heightMm) <= 15
              : Math.min(size.widthMm, size.heightMm) >= 100,
          ))
      );
    },
  );
}
