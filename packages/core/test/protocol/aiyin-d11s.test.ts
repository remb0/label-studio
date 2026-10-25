import { describe, expect, test } from "vitest";
import { AiYinD11sProtocol } from "../../src/protocol/aiyin-d11s/protocol";

describe("Fichero D11s AiYin protocol", () => {
  const protocol = new AiYinD11sProtocol();
  const image = {
    width: 96,
    height: 1,
    bytesPerRow: 12,
    data: Uint8Array.from([128, ...new Array<number>(11).fill(0)]),
  };

  test("uses the hardware-verified AiYin print sequence", () => {
    const commands = protocol.buildPrintSequence(image, {
      density: 2,
      paperType: "gap",
    });
    expect(commands.map((command) => Array.from(command.data))).toEqual([
      [0x10, 0xff, 0x10, 0, 1],
      [0x10, 0xff, 0x84, 0],
      new Array<number>(12).fill(0),
      [0x10, 0xff, 0xfe, 0x01],
      [0x1d, 0x76, 0x30, 0, 12, 0, 1, 0, ...image.data],
      [0x1d, 0x0c],
      [0x10, 0xff, 0xfe, 0x45],
    ]);
  });

  test("rejects the 384-dot Lujiang raster and unsupported paper", () => {
    expect(() =>
      protocol.buildPrintSequence({
        ...image,
        width: 384,
        bytesPerRow: 48,
        data: new Uint8Array(48),
      }),
    ).toThrow(/96-dot/);
    expect(() =>
      protocol.buildPrintSequence(image, { paperType: "continuous" }),
    ).toThrow(/voorgesneden/);
  });

  test("recognizes documented completion and error responses", () => {
    expect(protocol.parseResponse(Uint8Array.of(0xaa))?.type).toBe("success");
    expect(protocol.parseResponse(Uint8Array.of(0x4f, 0x4b))?.type).toBe(
      "success",
    );
    expect(protocol.parseResponse(Uint8Array.of(0xff, 0x06))).toMatchObject({
      type: "error",
      value: 0x06,
    });
  });
});
