import type { BaseElement, LabelSize } from "../store/editor-store.ts";
import type { SavedLabel } from "../lib/library.ts";
import { createId } from "../lib/id.ts";
import { resizeLabel } from "./document.ts";

export interface StarterTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  document: Omit<SavedLabel, "id">;
}

const text = (
  id: string,
  x: number,
  y: number,
  width: number,
  size: number,
  content: string,
  bold = false,
  align = "left",
): BaseElement => ({
  id,
  type: "text",
  x,
  y,
  width,
  height: size * content.split("\n").length,
  rotation: 0,
  props: {
    text: content,
    fontFamily: "Inter",
    fontSize: size,
    fontWeight: bold ? 700 : 400,
    fill: "#000000",
    align,
  },
});

const line = (
  id: string,
  x: number,
  y: number,
  width: number,
): BaseElement => ({
  id,
  type: "line",
  x,
  y,
  width,
  height: 0,
  rotation: 0,
  props: { stroke: "#000000", strokeWidth: 2 },
});

function template(
  id: string,
  name: string,
  category: string,
  description: string,
  widthMm: number,
  heightMm: number,
  elements: BaseElement[],
  shape: LabelSize["shape"] = "rounded",
): StarterTemplate {
  return {
    id,
    name,
    category,
    description,
    document: {
      name,
      label: resizeLabel(
        { shape, split: "none" } as LabelSize,
        widthMm,
        heightMm,
        203,
      ),
      elements,
      createdAt: 0,
      updatedAt: 0,
      settings: {
        paperType: "gap",
        rollDirection: "vertical",
        printSettings: { density: 2, ditherMode: "threshold", threshold: 128 },
      },
    },
  };
}

/** Built-ins are sources only. Instantiation always makes an independent document. */
export const STARTER_TEMPLATES: StarterTemplate[] = [
  template(
    "address",
    "Adres",
    "Verzenden",
    "Een rustig en goed leesbaar adreslabel.",
    48,
    30,
    [
      text("name", 20, 35, 340, 25, "Mila Voorbeeld", true),
      text(
        "address",
        20,
        83,
        340,
        22,
        "Voorbeeldstraat 12\n1234 AB Voorbeeldstad\nNederland",
      ),
    ],
  ),
  template(
    "business-address",
    "Zakelijk adres",
    "Verzenden",
    "Bedrijf, contactpersoon en adres in één ontwerp.",
    48,
    35,
    [
      text("company", 20, 30, 340, 26, "STUDIO VOORBEELD", true),
      line("separator", 20, 73, 340),
      text(
        "address",
        20,
        97,
        340,
        21,
        "T.a.v. Mila Voorbeeld\nVoorbeeldlaan 24\n1234 AB Voorbeeldstad\nNederland",
      ),
    ],
  ),
  template(
    "cable",
    "Kabelmarkering",
    "Organiseren",
    "Twee gelijke uiteinden om om een kabel te vouwen.",
    48,
    15,
    [
      text("left", 12, 32, 165, 23, "NETWERK 01", true, "center"),
      {
        id: "fold",
        type: "line",
        x: 192,
        y: 16,
        width: 0.5,
        height: 88,
        rotation: 0,
        props: { stroke: "#000000", strokeWidth: 1, dash: [4, 4] },
      },
      text("right", 207, 32, 165, 23, "NETWERK 01", true, "center"),
    ],
  ),
  template(
    "storage",
    "Opbergdoos",
    "Organiseren",
    "Grote titel met ruimte voor inhoud en locatie.",
    48,
    40,
    [
      text("eyebrow", 22, 27, 336, 17, "OPBERGEN / WERKPLAATS"),
      text("title", 22, 70, 336, 35, "GEREEDSCHAP", true),
      line("separator", 22, 123, 336),
      text(
        "contents",
        22,
        148,
        336,
        21,
        "Schroeven · pluggen\nBoren · bits\n\nKast A  /  Vak 03",
      ),
    ],
  ),
  template(
    "qr-link",
    "QR-link",
    "Codes",
    "Scanbare voorbeeldlink met een leesbare omschrijving.",
    40,
    40,
    [
      text("title", 22, 25, 276, 23, "SCAN VOOR INFO", true, "center"),
      {
        id: "qr",
        type: "qrcode",
        x: 80,
        y: 80,
        width: 160,
        height: 160,
        rotation: 0,
        props: { content: "https://example.com", errorCorrectionLevel: "M" },
      },
      text("link", 22, 264, 276, 17, "example.com", false, "center"),
    ],
  ),
  template(
    "product",
    "Product & prijs",
    "Codes",
    "Productnaam, prijs en CODE128-artikelcode.",
    48,
    35,
    [
      text("name", 22, 22, 340, 24, "VOORBEELDPRODUCT", true),
      text("price", 22, 65, 340, 38, "€ 12,95", true),
      {
        id: "barcode",
        type: "barcode",
        x: 32,
        y: 132,
        width: 320,
        height: 64,
        rotation: 0,
        props: { content: "DEMO-001", format: "CODE128", displayValue: false },
      },
      text("code", 22, 216, 340, 18, "DEMO-001", false, "center"),
    ],
  ),
  template(
    "fragile",
    "Breekbaar",
    "Waarschuwing",
    "Een duidelijke waarschuwing voor dozen en pakketten.",
    48,
    30,
    [
      {
        id: "border",
        type: "rect",
        x: 15,
        y: 15,
        width: 354,
        height: 210,
        rotation: 0,
        props: { fill: "transparent", stroke: "#000000", strokeWidth: 4 },
      },
      text("title", 30, 49, 324, 38, "BREEKBAAR", true, "center"),
      line("separator", 44, 110, 296),
      text(
        "notice",
        30,
        141,
        324,
        22,
        "Voorzichtig behandelen\nDeze zijde boven",
        false,
        "center",
      ),
    ],
  ),
  template(
    "round-date",
    "Rond datumlabel",
    "Organiseren",
    "Voorraadlabel met inhoud en een aanpasbare datum.",
    40,
    40,
    [
      text("title", 50, 75, 220, 23, "ZELFGEMAAKT", true, "center"),
      text("contents", 48, 121, 224, 21, "Inhoud invullen", false, "center"),
      line("separator", 68, 170, 184),
      text("date", 60, 190, 200, 18, "Datum: __ / __ / ____", false, "center"),
      text("hint", 70, 226, 180, 15, "Koel bewaren", false, "center"),
    ],
    "circle",
  ),
];

export function createStarterDocument(
  templateId: string,
): Omit<SavedLabel, "id"> {
  const source = STARTER_TEMPLATES.find((item) => item.id === templateId);
  if (!source) throw new Error("Onbekend startsjabloon.");
  const document = structuredClone(source.document);
  document.elements = document.elements.map((element) => ({
    ...element,
    id: createId(),
  }));
  document.createdAt = document.updatedAt = Date.now();
  return document;
}
