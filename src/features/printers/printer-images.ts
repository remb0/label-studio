/** Exact model matches only; never borrow a photo from a related model. */
export interface PrinterImage {
  src: string;
  source: string;
  assetSource: string;
  checkedOn: string;
}

const dymoSource = "https://www.dymo.com/labelwriter.html";
function dymoImage(
  id: string,
  assetId: string,
  extension: string,
): PrinterImage {
  return {
    src: `/printers/${id}.jpg`,
    source: dymoSource,
    assetSource: `https://newellbrands.imgix.net/${assetId}/${assetId}.${extension}?fm=jpg&w=320&fit=max&q=85`,
    checkedOn: "2026-10-22",
  };
}

export const PRINTER_IMAGES: Readonly<Record<string, PrinterImage>> = {
  "dymo-550": dymoImage(
    "dymo-550",
    "b3b063fa-a4df-358f-8dd8-488311bf18ee",
    "jpg",
  ),
  "dymo-550-turbo": dymoImage(
    "dymo-550-turbo",
    "a19c093c-aa1e-32ca-969b-485cd34be225",
    "jpg",
  ),
  "dymo-5xl": dymoImage(
    "dymo-5xl",
    "07ed6640-05c5-3825-b568-f77f5e59059c",
    "jpg",
  ),
  "dymo-450-twin": dymoImage(
    "dymo-450-twin",
    "53b62ba5-0553-37f9-9121-ffbca43dd58c",
    "tif",
  ),
  "dymo-450-duo": dymoImage(
    "dymo-450-duo",
    "8da7cfe4-c591-3319-8e14-cd6d5bf674b2",
    "tif",
  ),
  p12: {
    src: "/printers/marklife-p12.jpg",
    source:
      "https://www.marklifeprinter.com/Mobile-Photo-Printer-Original-Portable-Printers-Impresora-Smart-Mini-Wireless-Thermal-Photo-Printer-p.html",
    assetSource:
      "https://www.marklifeprinter.com/Uploads/pro/Mini-Wireless-Thermal-Printer.14.3-1.jpg",
    checkedOn: "2026-10-22",
  },
  p15: {
    src: "/printers/marklife-p15.jpg",
    source:
      "https://www.marklifeprinter.com/Marklife-Black-and-white-barcode-portable-bottle-mini-thermal-printing-sticker-printer-for-home-using-p.html",
    assetSource:
      "https://www.marklifeprinter.com/Uploads/pro/mini-thermal-printing-sticker-printer.16.3-1.jpg",
    checkedOn: "2026-10-22",
  },
};

export function getPrinterImage(modelId: string): PrinterImage | null {
  return Object.hasOwn(PRINTER_IMAGES, modelId)
    ? PRINTER_IMAGES[modelId]
    : null;
}
