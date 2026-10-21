import { addressLines, type Address } from "./address-model";
import { processImage, type ImageBitmap1bpp } from "@thermoprint/core";
const logoCache = new WeakMap<
  HTMLImageElement,
  Map<number, HTMLCanvasElement>
>();
export function unpackBitmap(bitmap: ImageBitmap1bpp): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(bitmap.width * bitmap.height * 4);
  for (let y = 0; y < bitmap.height; y++)
    for (let x = 0; x < bitmap.width; x++) {
      const p = (y * bitmap.width + x) * 4;
      const value =
        bitmap.data[y * bitmap.bytesPerRow + (x >> 3)] & (0x80 >> (x & 7))
          ? 0
          : 255;
      pixels[p] = pixels[p + 1] = pixels[p + 2] = value;
      pixels[p + 3] = 255;
    }
  return pixels;
}
function ditherLogo(logo: HTMLImageElement, width: number): HTMLCanvasElement {
  let cache = logoCache.get(logo);
  if (!cache) {
    cache = new Map();
    logoCache.set(logo, cache);
  }
  const previous = cache.get(width);
  if (previous) return previous;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.max(1, Math.round((width * logo.height) / logo.width));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(logo, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  pixels.data.set(
    unpackBitmap(processImage(pixels, { dither: "floyd-steinberg" })),
  );
  ctx.putImageData(pixels, 0, 0);
  // Limit retained scale variants while dragging the size slider.
  if (cache.size > 12) cache.clear();
  cache.set(width, canvas);
  return canvas;
}
export function previewPosition(
  x: number,
  y: number,
  portrait: boolean,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  return portrait
    ? { x: y / canvasHeight, y: 1 - x / canvasWidth }
    : { x: x / canvasWidth, y: y / canvasHeight };
}
export interface AddressDesign {
  format: "gap" | "continuous";
  portrait: boolean;
  size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  border: boolean;
  textX: number;
  textY: number;
  logoX: number;
  logoY: number;
  logoScale: number;
  logoLayer: "front" | "back";
  logoSrc: string;
  density: number;
  copies: number;
}
export const defaultDesign: AddressDesign = {
  format: "gap",
  portrait: false,
  size: 25,
  bold: true,
  italic: false,
  underline: false,
  border: false,
  textX: 0.5,
  textY: 0.5,
  logoX: 0.5,
  logoY: 0.5,
  logoScale: 100,
  logoLayer: "back",
  logoSrc: "",
  density: 2,
  copies: 1,
};
export function renderAddress(
  canvas: HTMLCanvasElement,
  address: Address,
  design: AddressDesign,
  logo?: HTMLImageElement | null,
): { overflow: boolean } {
  canvas.width = 384;
  canvas.height = design.format === "gap" ? 240 : 448;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("Canvas is niet beschikbaar.");
  const w = design.portrait ? canvas.height : canvas.width,
    h = design.portrait ? canvas.width : canvas.height;
  c.save();
  if (design.portrait) {
    c.translate(canvas.width, 0);
    c.rotate(Math.PI / 2);
  }
  c.fillStyle = "#fff";
  c.fillRect(0, 0, w, h);
  const drawLogo = () => {
    if (!logo) return;
    const image = ditherLogo(
      logo,
      Math.max(
        1,
        Math.round((Math.min(w * 0.5, 150) * design.logoScale) / 100),
      ),
    );
    c.drawImage(
      image,
      Math.round(design.logoX * w - image.width / 2),
      Math.round(design.logoY * h - image.height / 2),
    );
  };
  if (design.logoLayer === "back") drawLogo();
  c.font = `${design.italic ? "italic " : ""}${design.bold ? "700" : "400"} ${design.size}px Arial,sans-serif`;
  const maxWidth = w - 24;
  const lines: string[] = [];
  for (const content of addressLines(address)) {
    let line = "";
    for (const word of content.trim().split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && c.measureText(next).width > maxWidth) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
  }
  const lineHeight = design.size + 7,
    x = design.textX * w - maxWidth / 2,
    top = design.textY * h - (lines.length * lineHeight) / 2;
  const overflow =
    x < 0 ||
    top < 0 ||
    top + lines.length * lineHeight > h ||
    lines.some(
      (line) =>
        x + c.measureText(line).width > w ||
        c.measureText(line).width > maxWidth,
    );
  lines.forEach((line, i) => {
    const y = top + design.size + i * lineHeight;
    if (logo && design.logoLayer === "back") {
      c.lineWidth = 4;
      c.strokeStyle = "#fff";
      c.strokeText(line, x, y);
    }
    c.fillStyle = "#000";
    c.fillText(line, x, y);
    if (design.underline)
      c.fillRect(
        x,
        y + 2,
        c.measureText(line).width,
        Math.max(1, design.size / 15),
      );
  });
  if (design.logoLayer === "front") drawLogo();
  if (design.border) {
    c.strokeStyle = "#000";
    c.lineWidth = 2;
    c.strokeRect(2, 2, w - 4, h - 4);
  }
  c.restore();
  // Quantize text edges once so PNG, preview and the transmitted raster agree.
  const pixels = c.getImageData(0, 0, canvas.width, canvas.height);
  pixels.data.set(
    unpackBitmap(processImage(pixels, { dither: "threshold", threshold: 150 })),
  );
  c.putImageData(pixels, 0, 0);
  return { overflow };
}
