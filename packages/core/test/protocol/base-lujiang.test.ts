import { describe, expect, test } from "vitest";
import { BaseLujiangProtocol } from "../../src/protocol/base-lujiang/protocol";
import { findDeviceByName } from "../../src/device/registry";
import { padBitmap } from "../../src/image/pad";

describe("LuckP D1S legacy compatibility", () => {
  const protocol = new BaseLujiangProtocol();
  const image = {
    width: 384,
    height: 1,
    bytesPerRow: 48,
    data: Uint8Array.from([128, ...new Array<number>(47).fill(0)]),
  };
  test("keeps gap command boundaries, density conversion and raster header", () => {
    const commands = protocol.buildPrintSequence(image, {
      density: 2,
      paperType: "gap",
    });
    expect(commands.map((c) => Array.from(c.data))).toEqual([
      [16, 255, 16, 0, 1],
      [16, 255, 132, 0],
      [16, 255, 241, 3],
      new Array<number>(12).fill(0),
      [31, 17, 81],
      [29, 118, 48, 0, 48, 0, 1, 0, ...image.data],
      [29, 12],
      [31, 17, 80],
      [16, 255, 241, 69],
    ]);
    expect(commands.map((c) => c.delayMs)).toEqual([
      300, 300, 300, 300, 300, 500, 300, 300, 2000,
    ]);
  });
  test("continuous mode feeds 80 dots and has no gap commands", () => {
    const commands = protocol.buildPrintSequence(image, {
      density: 3,
      paperType: "continuous",
    });
    expect(Array.from(commands[0].data)).toEqual([16, 255, 16, 0, 2]);
    expect(commands.some((c) => c.label === "label-start")).toBe(false);
    expect(Array.from(commands.at(-2)!.data)).toEqual([27, 74, 80]);
  });
  test("recognizes the real BLE name and keeps upstream models", () => {
    expect(findDeviceByName("LuckP_D1S_F828_BLE")?.printWidth).toBe(384);
    expect(findDeviceByName("Fichero D1S")?.protocolId).toBe("base-lujiang");
    expect(findDeviceByName("FICHERO_5836")?.protocolId).toBe("base-lujiang");
    expect(findDeviceByName("Fichero D11s")).toBeNull();
    expect(findDeviceByName("Fichero 3561")).toBeNull();
    expect(findDeviceByName("P12_123")?.protocolId).toBe("l11");
  });
  test("centers bits across byte boundaries and rejects over-wide jobs", () => {
    const padded = padBitmap(
      { width: 3, height: 1, bytesPerRow: 1, data: Uint8Array.of(0xa0) },
      16,
    );
    expect(Array.from(padded.data)).toEqual([2, 128]);
    expect(() => padBitmap(image, 96)).toThrow(/supports 96/);
  });
  test("rejects blank jobs and never invents a completion acknowledgement", () => {
    expect(() =>
      protocol.buildPrintSequence({ ...image, data: new Uint8Array(48) }),
    ).toThrow(/zwarte/);
    expect(protocol.parseResponse(Uint8Array.of(0xaa))).toBeNull();
  });
});
