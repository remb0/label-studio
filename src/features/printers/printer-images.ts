/** Exact model matches only; never borrow a photo from a related model. */
export interface PrinterImage {
  src: string;
  source: string;
  assetSource: string;
  modelEvidence?: string;
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
  "phomemo-m110": {
    src: "/printers/phomemo-m110.jpg",
    source: "https://phomemo.com/products/m110-label-maker",
    assetSource:
      "https://cdn.shopify.com/s/files/1/0180/9294/9568/files/flash-sale-phomemo-m110-bluetooth-portable-thermal-business-label-maker-356411.jpg?v=1746653143&width=320",
    checkedOn: "2026-10-22",
  },
  "phomemo-d30": {
    src: "/printers/phomemo-d30.jpg",
    source: "https://phomemo.com/products/d30-label-maker",
    assetSource:
      "https://cdn.shopify.com/s/files/1/0180/9294/9568/files/phomemo-d30-portable-bluetooth-home-label-maker-1056360.jpg?v=1771147627&width=320",
    checkedOn: "2026-10-22",
  },
  "niimbot-b21": {
    src: "/printers/niimbot-b21.jpg",
    source: "https://www.niimbotlabel.com/products/niimbot-b21-label-maker-1",
    assetSource:
      "https://cdn.shopify.com/s/files/1/0552/8266/3601/products/Red_677a3569-86e3-4c35-a9ba-08a0c22eaa4d.jpg?v=1666771142&width=320",
    checkedOn: "2026-10-22",
  },
  "niimbot-b1": {
    src: "/printers/niimbot-b1.png",
    source: "https://www.niimbotlabel.com/products/niimbot-b1-label-maker",
    assetSource:
      "https://cdn.shopify.com/s/files/1/0552/8266/3601/products/1.png?v=1657532585&width=320",
    checkedOn: "2026-10-22",
  },
  "niimbot-d110": {
    src: "/printers/niimbot-d110.png",
    source:
      "https://www.niimbotlabel.com/products/niimbot%E2%84%A2-d011-label-maker",
    assetSource:
      "https://cdn.shopify.com/s/files/1/0552/8266/3601/files/New-white.png?v=1728642341&width=320",
    checkedOn: "2026-10-22",
  },
  "niimbot-d11-h": {
    src: "/printers/niimbot-d11-h.png",
    source:
      "https://www.niimbotlabel.com/products/niimbot%E2%84%A2-d011-label-maker",
    assetSource:
      "https://www.niimbotlabel.com/cdn/shop/files/D11-HSKUNEW_1024x1024.png?v=1716888038&width=320",
    checkedOn: "2026-10-22",
  },
  "fichero-d11s": {
    src: "/printers/fichero-d11s.webp",
    source: "https://www.action.com/nl-nl/p/3212141/fichero-labelprinter/",
    assetSource:
      "https://asset.action.com/image/upload/t_digital_product_image/w_1080/3212141_8711568159001-111_01_q7zxaz.webp",
    modelEvidence:
      "https://github.com/0xMH/fichero-printer/tree/f945a87c43240c0c8689d1cce53772f8a20073a3",
    checkedOn: "2026-10-22",
  },
};

export function getPrinterImage(modelId: string): PrinterImage | null {
  return Object.hasOwn(PRINTER_IMAGES, modelId)
    ? PRINTER_IMAGES[modelId]
    : null;
}
