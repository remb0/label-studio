import type {
  ImageBitmap1bpp,
  PrintCommand,
  PrinterProtocol,
  PrinterResponse,
  PrintSequenceOptions,
} from "../types.js";

/** AiYin D11s protocol used by the Fichero 5836. */
export class AiYinD11sProtocol implements PrinterProtocol {
  readonly id = "aiyin-d11s";

  buildPrintSequence(
    image: ImageBitmap1bpp,
    options: PrintSequenceOptions = {},
  ): PrintCommand[] {
    if (
      image.width !== 96 ||
      image.bytesPerRow !== 12 ||
      image.data.length !== 12 * image.height ||
      image.height < 1 ||
      image.height > 65535
    )
      throw new Error("Fichero D11s requires a valid 96-dot bitmap");
    if (!image.data.some((byte) => byte !== 0))
      throw new Error("Het label bevat geen zwarte afdrukpunten.");

    const density = options.density ?? 2;
    if (![1, 2, 3].includes(density))
      throw new Error("Density must be 1, 2 or 3");
    if ((options.paperType ?? "gap") !== "gap")
      throw new Error("Fichero D11s ondersteunt alleen voorgesneden labels.");

    const command = (
      label: string,
      bytes: number[],
      delayMs: number,
    ): PrintCommand => ({ label, data: Uint8Array.from(bytes), delayMs });
    const raster = new Uint8Array(8 + image.data.length);
    raster.set([
      0x1d,
      0x76,
      0x30,
      0,
      12,
      0,
      image.height & 255,
      image.height >> 8,
    ]);
    raster.set(image.data, 8);

    return [
      command("density", [0x10, 0xff, 0x10, 0, density - 1], 100),
      command("paper", [0x10, 0xff, 0x84, 0], 50),
      command("wakeup", new Array<number>(12).fill(0), 50),
      command("enable", [0x10, 0xff, 0xfe, 0x01], 50),
      { label: "raster", data: raster, bulk: true, delayMs: 500 },
      command("form-feed", [0x1d, 0x0c], 300),
      command("stop", [0x10, 0xff, 0xfe, 0x45], 2000),
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
    if (type === "firmware")
      return {
        label: "firmware",
        data: Uint8Array.of(0x10, 0xff, 0x20, 0xf1),
      };
    if (type === "serial")
      return {
        label: "serial",
        data: Uint8Array.of(0x10, 0xff, 0x20, 0xf2),
      };
    throw new Error(`Fichero D11s does not support ${type} queries`);
  }
  parseResponse(data: Uint8Array): PrinterResponse | null {
    if (data.length === 1 && data[0] === 0xaa)
      return { type: "success", raw: data };
    if (data.length >= 2 && data[0] === 0x4f && data[1] === 0x4b)
      return { type: "success", raw: data };
    if (data.length >= 2 && data[0] === 0xff)
      return { type: "error", raw: data, value: data[1] };
    return null;
  }
}
