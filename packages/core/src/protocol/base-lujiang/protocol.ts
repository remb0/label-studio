import type {
  ImageBitmap1bpp,
  PrintCommand,
  PrinterProtocol,
  PrinterResponse,
  PrintSequenceOptions,
} from "../types.js";

/** Exact working legacy LuckP D1 sequence, including command boundaries/delays. */
export class BaseLujiangProtocol implements PrinterProtocol {
  readonly id = "base-lujiang";
  buildPrintSequence(
    image: ImageBitmap1bpp,
    options: PrintSequenceOptions = {},
  ): PrintCommand[] {
    if (
      image.width !== 384 ||
      image.bytesPerRow !== 48 ||
      image.data.length !== 48 * image.height ||
      image.height < 1 ||
      image.height > 65535
    )
      throw new Error("LuckP D1S requires a valid 384-dot bitmap");
    if (!image.data.some((byte) => byte !== 0))
      throw new Error("Het label bevat geen zwarte afdrukpunten.");
    const density = options.density ?? 2;
    if (![1, 2, 3].includes(density))
      throw new Error("Density must be 1, 2 or 3");
    const gap = (options.paperType ?? "gap") === "gap";
    const command = (
      label: string,
      bytes: number[],
      delayMs = 300,
    ): PrintCommand => ({ label, data: Uint8Array.from(bytes), delayMs });
    const raster = new Uint8Array(8 + image.data.length);
    raster.set([
      0x1d,
      0x76,
      0x30,
      0,
      48,
      0,
      image.height & 255,
      image.height >> 8,
    ]);
    raster.set(image.data, 8);
    return [
      command("density", [0x10, 0xff, 0x10, 0, density - 1]),
      command("paper", [0x10, 0xff, 0x84, gap ? 0 : 2]),
      command("enable", [0x10, 0xff, 0xf1, 3]),
      command("reset-buffer", new Array<number>(12).fill(0)),
      ...(gap ? [command("label-start", [0x1f, 0x11, 0x51])] : []),
      { label: "raster", data: raster, bulk: true, delayMs: 500 },
      ...(gap
        ? [
            command("form-feed", [0x1d, 0x0c]),
            command("label-end", [0x1f, 0x11, 0x50]),
          ]
        : [command("feed", [0x1b, 0x4a, 0x50])]),
      command("stop", [0x10, 0xff, 0xf1, 0x45], 2000),
    ];
  }
  buildWakeup(): PrintCommand[] {
    return [];
  }
  buildStatusQuery(): PrintCommand {
    return { label: "status", data: Uint8Array.of(0x10, 0xff, 0x40) };
  }
  buildBatteryQuery(): PrintCommand {
    return { label: "battery", data: Uint8Array.of(0x10, 0xff, 0x50, 0xf1) };
  }
  buildModelQuery(): PrintCommand {
    return { label: "model", data: Uint8Array.of(0x10, 0xff, 0x20, 0xf0) };
  }
  buildInfoQuery(type: string): PrintCommand {
    if (type !== "firmware")
      throw new Error(`LuckP D1S does not support ${type} queries`);
    return { label: "firmware", data: Uint8Array.of(0x10, 0xff, 0x20, 0xf1) };
  }
  // Raw diagnostic replies have no documented framing; never infer print success.
  parseResponse(data: Uint8Array): PrinterResponse | null {
    void data;
    return null;
  }
}
