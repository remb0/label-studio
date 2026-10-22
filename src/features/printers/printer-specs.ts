export type HardwareConnection =
  "ble" | "classic" | "wifi" | "lan" | "usb" | "unknown";
export interface SpecSource {
  title: string;
  url: string;
}
export interface PrinterSpecs {
  dpi: 203 | 300 | null;
  headDots: number | null;
  mediaWidthMm: [number, number] | null;
  connections: HardwareConnection[];
  evidence: "product" | "project" | "conflicting" | "unverified";
  notes: string[];
  sources: SpecSource[];
  checkedOn: string;
}

export const NIIMBLUE_SOURCE: SpecSource = {
  title: "NiimBlue · modelregister (MIT, vastgezette revisie)",
  url: "https://github.com/MultiMote/niimbluelib/blob/a9bc3f5c20c95e3a31ea3f5f2302ce7b27c34abe/src/printer_models.ts",
};
export const FICHERO_SOURCE: SpecSource = {
  title: "Fichero D11s · model, Action-artikel en protocolreferentie",
  url: "https://github.com/0xMH/fichero-printer/tree/f945a87c43240c0c8689d1cce53772f8a20073a3",
};
const marklifeHardware: SpecSource = {
  title: "thermal-label · hardwaremetingen en onzekerheden",
  url: "https://thermal-label.github.io/marklife/hardware",
};
const table = (model: string): SpecSource => ({
  title: "OpenTLP · hardwaretabel (MIT, vastgezette revisie)",
  url: `https://github.com/opentlp/opentlp/blob/b21036a918fd2cbf210e588b9456b60679ecc47e/packages/hardware/devices/${model}.md`,
});
const product = (title: string, url: string): SpecSource => ({ title, url });
const spec = (data: Omit<PrinterSpecs, "checkedOn">): PrinterSpecs => ({
  ...data,
  checkedOn: "2026-10-22",
});
const niimbot = (
  headDots: number,
  dpi: 203 | 300,
  model: string,
  notes: string[] = [],
): PrinterSpecs =>
  spec({
    dpi,
    headDots,
    mediaWidthMm: null,
    connections: ["ble"],
    evidence: "project",
    notes: [
      "Hardwaregegevens uit een communityregister; geen driver of fysieke certificering in Label Studio. Model- en firmwarevarianten kunnen verschillen.",
      ...notes,
    ],
    sources: [NIIMBLUE_SOURCE, table(`niimbot/niimbot_${model}`)],
  });

const SPECS: Record<string, PrinterSpecs> = {
  "luckp-d1s": spec({
    dpi: 203,
    headDots: 384,
    mediaWidthMm: null,
    connections: ["ble"],
    evidence: "project",
    notes: [
      "Waarden uit het bestaande projectprofiel; niet fysiek geverifieerd. Niet verwarren met de 96-dot Fichero D11s.",
    ],
    sources: [
      product(
        "Bestaand LuckP-profiel",
        "https://github.com/remb0/label-studio/blob/b0d4c4706ced7c05153919d0007e881ee3617a95/packages/core/src/device/profiles/luckp-d1s.ts",
      ),
    ],
  }),
  p12: spec({
    dpi: 203,
    headDots: 96,
    mediaWidthMm: [12, 15],
    connections: ["ble", "classic", "usb"],
    evidence: "conflicting",
    notes: [
      "Printkop van 96 dots (circa 12 mm) gemeten in communityonderzoek; papierbreedte is niet hetzelfde als printbare breedte.",
      "Bronnen beschrijven P12-firmware met L11 én moderne 1F-framing. Label Studio heeft alleen het bestaande L11-profiel; modelnaam of foto bewijst geen firmwarecompatibiliteit. P11/LP90 zijn zoek-/protocolaliassen, geen bevestigde identieke apparaten.",
    ],
    sources: [
      marklifeHardware,
      table("marklife/marklife_p12"),
      product(
        "Marklife P12 productpagina",
        "https://www.marklifeprinter.com/Mobile-Photo-Printer-Original-Portable-Printers-Impresora-Smart-Mini-Wireless-Thermal-Photo-Printer-p.html",
      ),
    ],
  }),
  p15: spec({
    dpi: 203,
    headDots: null,
    mediaWidthMm: [12, 15],
    connections: ["ble", "classic", "usb"],
    evidence: "conflicting",
    notes: [
      "203 dpi en 12–15 mm volgens fabrikant. De ene communitybron noemt 96 dots bevestigd, de andere noemt dit afgeleid. Daarom geen bevestigde printkopbreedte ingevuld.",
      "Familie-aliassen zoals P7 en M1 zijn geen bewijs van dezelfde behuizing of firmware.",
    ],
    sources: [
      marklifeHardware,
      table("marklife/marklife_p15"),
      product(
        "Marklife P15 productpagina",
        "https://www.marklifeprinter.com/Marklife-Black-and-white-barcode-portable-bottle-mini-thermal-printing-sticker-printer-for-home-using-p.html",
      ),
    ],
  }),
  m60: spec({
    dpi: 203,
    headDots: null,
    mediaWidthMm: null,
    connections: ["ble", "classic"],
    evidence: "project",
    notes: [
      "M60 wordt als X2-whitelabel beschreven. De 384-dot-breedte is bij die bron een aanname, geen meting. X2-foto's worden niet als M60-foto gebruikt.",
    ],
    sources: [marklifeHardware],
  }),
  "fichero-d11s": spec({
    dpi: 203,
    headDots: 96,
    mediaWidthMm: [14, 14],
    connections: ["ble", "classic"],
    evidence: "project",
    notes: [
      "AiYin D11s; Action-artikel 3212141, standaard 14 × 30 mm. De GitHub-referentie koppelt dit specifieke artikel aan het model.",
      "BLE- en Classic-hardware gedocumenteerd bij de bron; de AiYin-printroute is niet ingebouwd in Label Studio. USB-C is hier alleen als laden onderbouwd.",
    ],
    sources: [
      FICHERO_SOURCE,
      product(
        "Action · artikel 3212141",
        "https://www.action.com/nl-nl/p/3212141/fichero-labelprinter/",
      ),
    ],
  }),
  "action-pocket-300": spec({
    dpi: null,
    headDots: null,
    mediaWidthMm: null,
    connections: ["unknown"],
    evidence: "unverified",
    notes: [
      "Nog geen uniek artikelnummer of betrouwbare modelreferentie. De bestaande 300-dpi / 50 × 15 mm-keuze is uitsluitend een ontwerppreset, geen bevestigde printerspecificatie.",
    ],
    sources: [],
  }),
  "niimbot-d110": niimbot(96, 203, "d110"),
  "niimbot-d11-h": niimbot(142, 300, "d11h", [
    "Dit is D11-H: niet D11, D11s of de AiYin/Fichero D11s. Geen automatische driverkoppeling op de naam D11.",
  ]),
  "niimbot-b1": niimbot(384, 203, "b1"),
  "niimbot-b21": niimbot(384, 203, "b21"),
  "phomemo-d30": spec({
    dpi: 203,
    headDots: 96,
    mediaWidthMm: [6, 15],
    connections: ["ble"],
    evidence: "project",
    notes: [
      "Fabrikant vermeldt papier van 6 / 12 / 14 / 15 mm; 96 dots komt uit de communitytabel. Een catalogusprofiel is geen geïmplementeerde D/Q-driver.",
    ],
    sources: [
      table("phomemo/phomemo_d30"),
      product(
        "Phomemo D30 · productspecificaties",
        "https://phomemo.com/products/d30-label-maker",
      ),
    ],
  }),
  "phomemo-m110": spec({
    dpi: 203,
    headDots: null,
    mediaWidthMm: [20, 50],
    connections: ["ble", "usb"],
    evidence: "conflicting",
    notes: [
      "De fabrikant bevestigt 203 dpi en papierbreedte 20–50 mm. Dit zegt niet dat 50 mm volledig printbaar is.",
      "GitHub-projecten spreken elkaar tegen: 344 tegenover 384 dots. Daarom blijft de printkopbreedte onbekend en is de nieuwe keuze uitsluitend voor ontwerpen.",
    ],
    sources: [
      table("phomemo/phomemo_m110"),
      product(
        "Phomemo M110 · productspecificaties",
        "https://phomemo.com/products/m110-label-maker",
      ),
    ],
  }),
};

export function getPrinterSpecs(id: string): PrinterSpecs {
  if (Object.hasOwn(SPECS, id)) return SPECS[id];
  if (
    [
      "dymo-450",
      "dymo-450-turbo",
      "dymo-450-twin",
      "dymo-450-duo",
      "dymo-4xl",
      "dymo-550",
      "dymo-550-turbo",
      "dymo-5xl",
    ].includes(id)
  )
    return spec({
      dpi: 300,
      headDots: null,
      mediaWidthMm: null,
      connections:
        id === "dymo-550-turbo" || id === "dymo-5xl" ? ["usb", "lan"] : ["usb"],
      evidence: "product",
      notes: [
        "DYMO vermeldt USB/LAN op de 550 Turbo en 5XL: LAN betekent Ethernet, niet wifi. De cataloguskeuze activeert geen browserdriver.",
        "De 450 Duo heeft een afzonderlijk D1-tapemechanisme; dit profiel betreft uitsluitend de LW-labelrol.",
      ],
      sources: [
        product(
          "DYMO · modellenvergelijking",
          "https://www.dymo.com/labelwriter.html",
        ),
        product(
          "DYMO · 450-serie gebruikershandleiding",
          "https://download.dymo.com/dymo/user-guides/LabelWriter/LW450Series/UG/LabelWriter_UserGuide_en.pdf",
        ),
      ],
    });
  return spec({
    dpi: null,
    headDots: null,
    mediaWidthMm: null,
    connections: ["unknown"],
    evidence: "unverified",
    notes: ["Geen beoordeelde modelbron beschikbaar."],
    sources: [],
  });
}
