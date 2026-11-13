import { describe, expect, it, vi } from "vitest";
import { emptyAddress } from "./address-model";
import {
  compactAddressBitmap,
  defaultDesign,
  previewPosition,
  renderAddress,
  unpackBitmap,
} from "./render-address";
function mockCanvas() {
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    drawImage: vi.fn(),
    getImageData: (_x: number, _y: number, width: number, height: number) => ({
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4).fill(255),
    }),
    putImageData: vi.fn(),
    measureText: (s: string) => ({ width: s.length * 13 }),
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
  return { canvas, ctx };
}
describe("shared address render", () => {
  const address = {
    ...emptyAddress(),
    name: "Jan Jansen",
    street: "Straat 1",
    postal: "1234 AB",
    city: "Utrecht",
  };
  it("renders gap labels using the original 384 × 240 geometry", () => {
    const { canvas, ctx } = mockCanvas();
    expect(renderAddress(canvas, address, defaultDesign).overflow).toBe(false);
    expect([canvas.width, canvas.height]).toEqual([384, 240]);
    expect(ctx.fillText).toHaveBeenCalledTimes(3);
  });
  it("uses the same renderer for continuous portrait layouts", () => {
    const { canvas, ctx } = mockCanvas();
    renderAddress(canvas, address, {
      ...defaultDesign,
      format: "continuous",
      portrait: true,
    });
    expect([canvas.width, canvas.height]).toEqual([384, 448]);
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 2);
  });
  it("extends a continuous bulk label along the feed without clipping its address", () => {
    const { canvas, ctx } = mockCanvas();
    const design = {
      ...defaultDesign,
      format: "continuous",
      textY: 0,
    } as const;
    const longAddress = {
      ...address,
      extra: "Bezorgen bij receptie ".repeat(30),
    };

    expect(renderAddress(canvas, longAddress, design).overflow).toBe(true);
    expect(
      renderAddress(canvas, longAddress, design, null, true).overflow,
    ).toBe(false);
    expect(canvas.width).toBe(384);
    expect(canvas.height).toBeGreaterThan(448);
    expect(ctx.translate).toHaveBeenLastCalledWith(0, expect.any(Number));
  });
  it("extends rotated text along the feed but still checks the physical roll width", () => {
    const { canvas } = mockCanvas();
    const design = {
      ...defaultDesign,
      format: "continuous",
      portrait: true,
    } as const;
    const longAddress = { ...address, name: "X".repeat(45) };
    expect(
      renderAddress(canvas, longAddress, design, null, true).overflow,
    ).toBe(false);
    expect(canvas.height).toBeGreaterThan(448);
    expect(
      renderAddress(canvas, longAddress, { ...design, textY: 0 }, null, true)
        .overflow,
    ).toBe(true);
  });
  it("reports overflowing unbreakable words and vertically overflowing labels", () => {
    expect(
      renderAddress(
        mockCanvas().canvas,
        { ...address, name: "X".repeat(100) },
        defaultDesign,
      ).overflow,
    ).toBe(true);
    expect(
      renderAddress(mockCanvas().canvas, address, {
        ...defaultDesign,
        textY: 0,
      }).overflow,
    ).toBe(true);
  });
  it("translates portrait drags to the rotated logical coordinates", () => {
    expect(previewPosition(192, 120, false, 384, 240)).toEqual({
      x: 0.5,
      y: 0.5,
    });
    expect(previewPosition(96, 180, true, 384, 240)).toEqual({
      x: 0.75,
      y: 0.75,
    });
  });
  it("unpacks odd-width printer raster rows into exact black/white preview pixels", () => {
    const rgba = unpackBitmap({
      width: 2,
      height: 2,
      bytesPerRow: 1,
      data: Uint8Array.of(0x80, 0x40),
    });
    expect(Array.from(rgba)).toEqual([
      0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 255,
    ]);
  });
});

describe("compact continuous address labels", () => {
  it("removes outer blank rows and keeps the print and its internal spacing", () => {
    const data = new Uint8Array(48 * 448);
    data[48 * 180] = 0x80;
    data[48 * 182 + 47] = 0x01;
    const image = { width: 384, height: 448, bytesPerRow: 48, data };

    const compact = compactAddressBitmap(image, true);
    expect(compact.height).toBe(43);
    expect(compact.data.slice(24 * 48, 27 * 48)).toEqual(
      data.slice(180 * 48, 183 * 48),
    );
    expect(compact.data.slice(0, 4 * 48)).toEqual(new Uint8Array(4 * 48));
    expect(compact.data.slice(4 * 48, 8 * 48)).toEqual(
      Uint8Array.from(Array.from({ length: 64 }, () => [0xff, 0xf0, 0]).flat()),
    );
    expect(compact.data.slice(8 * 48, 24 * 48)).toEqual(
      new Uint8Array(16 * 48),
    );
    expect(compact.data.slice(-16 * 48)).toEqual(new Uint8Array(16 * 48));
    expect(compactAddressBitmap(image, false).data).toEqual(
      compact.data.slice(8 * 48),
    );
  });
});
