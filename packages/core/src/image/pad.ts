import type { ImageBitmap1bpp } from "../protocol/types.js";

/** Center narrower designs on the physical printhead; reject accidental cropping. */
export function padBitmap(
  image: ImageBitmap1bpp,
  width: number,
): ImageBitmap1bpp {
  if (image.width > width)
    throw new Error(
      `Label is ${image.width} dots wide; printer supports ${width}. Rotate or reduce the label.`,
    );
  if (
    image.width < 1 ||
    image.height < 1 ||
    image.bytesPerRow !== Math.ceil(image.width / 8) ||
    image.data.length !== image.bytesPerRow * image.height
  )
    throw new Error("Invalid bitmap dimensions");
  if (image.width === width) return image;
  const bytesPerRow = Math.ceil(width / 8);
  const data = new Uint8Array(bytesPerRow * image.height);
  const left = Math.floor((width - image.width) / 2);
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++) {
      if (image.data[y * image.bytesPerRow + (x >> 3)] & (0x80 >> (x & 7))) {
        const destX = left + x;
        data[y * bytesPerRow + (destX >> 3)] |= 0x80 >> (destX & 7);
      }
    }
  return { data, width, height: image.height, bytesPerRow };
}
