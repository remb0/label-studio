import { afterEach, describe, expect, it, vi } from "vitest";
import { Printer } from "@thermoprint/core";
import { WebBluetoothTransport } from "./web-bluetooth.ts";

describe("Web Bluetooth printer selection", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("offers FICHERO_5836 in the native browser picker", async () => {
    let requestOptions: RequestDeviceOptions | undefined;
    const requestDevice = vi.fn(async (options: RequestDeviceOptions) => {
      requestOptions = options;
      return {
        id: "fichero-5836",
        name: "FICHERO_5836",
      };
    });
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", { bluetooth: { requestDevice } });

    const discovered: string[] = [];
    await new WebBluetoothTransport().scan((peripheral) => {
      discovered.push(peripheral.name);
    });

    expect(requestDevice).toHaveBeenCalledOnce();
    if (!requestOptions || !("filters" in requestOptions)) {
      throw new Error("Expected filtered Bluetooth device selection");
    }
    expect(requestOptions.filters).toContainEqual({
      namePrefix: "FICHERO_5836",
    });
    expect(discovered).toEqual(["FICHERO_5836"]);
  });
});

describe("LuckP D1S raster transfer", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each([
    { withResponse: true, packetIntervalMs: 0 },
    { withResponse: false, packetIntervalMs: 50 },
  ])(
    "paces writes withResponse=$withResponse by $packetIntervalMs ms",
    async ({ withResponse, packetIntervalMs }) => {
      vi.useFakeTimers();
      const rasterWrites: number[] = [];
      const write = async (data: ArrayBuffer) => {
        if (data.byteLength >= 48) rasterWrites.push(Date.now());
      };
      const writeValueWithResponse = vi.fn(write);
      const writeValueWithoutResponse = vi.fn(write);
      const device = {
        id: `luckp-timing-${withResponse}`,
        name: "LuckP_D1S_F828_BLE",
        addEventListener: vi.fn(),
        gatt: {
          connect: vi.fn(async () => {}),
          getPrimaryService: async () => ({
            getCharacteristic: async () => ({
              properties: { write: withResponse, writeWithoutResponse: true },
              writeValueWithResponse,
              writeValueWithoutResponse,
            }),
          }),
        },
      };
      vi.stubGlobal("navigator", {
        bluetooth: { getDevices: async () => [device] },
      });
      const printer = await Printer.connect(new WebBluetoothTransport(), {
        id: device.id,
        name: device.name,
        rssi: 0,
      });

      const printing = printer.printBitmap({
        width: 384,
        height: 3,
        bytesPerRow: 48,
        data: new Uint8Array(144).fill(0xff),
      });
      await vi.runAllTimersAsync();
      await printing;

      expect(rasterWrites).toHaveLength(2);
      expect(rasterWrites[1] - rasterWrites[0]).toBe(packetIntervalMs);
      expect(
        withResponse ? writeValueWithoutResponse : writeValueWithResponse,
      ).not.toHaveBeenCalled();
    },
  );
});
