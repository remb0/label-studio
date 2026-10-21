import { afterEach, describe, expect, test, vi } from "vitest";
import { Printer } from "../src/printer";
import type {
  BleConnection,
  BleTransport,
  BleCharacteristic,
} from "../src/transport/types";

function mockPrinter(failLargePackets = false) {
  let connected = true;
  let disconnected: (() => void) | undefined;
  const written: Uint8Array[] = [];
  const tx: BleCharacteristic = {
    write: vi.fn(async (bytes: Uint8Array) => {
      if (failLargePackets && bytes.length > 20)
        throw new Error("MTU too small");
      written.push(bytes.slice());
    }),
    subscribe: vi.fn(async () => {}),
    unsubscribe: vi.fn(async () => {}),
  };
  const connection: BleConnection = {
    get isConnected() {
      return connected;
    },
    onDisconnect(callback) {
      disconnected = callback;
    },
    discoverService: vi.fn(async (uuid) =>
      uuid === "18f0"
        ? { getCharacteristic: async (id) => (id === "2af1" ? tx : null) }
        : null,
    ),
    disconnect: async () => {
      connected = false;
      disconnected?.();
    },
  };
  const transport: BleTransport = {
    scan: vi.fn(),
    connect: async () => connection,
  };
  return { transport, connection, written, tx };
}

describe("printer orchestration on real legacy contract", () => {
  afterEach(() => vi.useRealTimers());
  test("uses the alternative UART without mandatory notifications and centers raster data", async () => {
    vi.useFakeTimers();
    const mock = mockPrinter(true);
    const printer = await Printer.connect(mock.transport, {
      id: "test",
      name: "LuckP_D1S_F828_BLE",
      rssi: 0,
    });
    expect(printer.completionMode).toBe("transmitted");
    const status = vi.fn();
    printer.on("status", status);
    const printing = printer.printBitmap({
      width: 8,
      height: 1,
      bytesPerRow: 1,
      data: Uint8Array.of(0x80),
    });
    await vi.runAllTimersAsync();
    await printing;
    expect(mock.tx.write).toHaveBeenCalledWith(expect.any(Uint8Array), false);
    expect(mock.written.every((bytes) => bytes.length <= 20)).toBe(true);
    expect(
      mock.written.some(
        (bytes) => bytes[0] === 0x1d && bytes[1] === 0x76 && bytes[4] === 48,
      ),
    ).toBe(true);
    expect(status).toHaveBeenCalledWith({
      status: "transmitted_unconfirmed",
      raw: new Uint8Array(),
    });
    expect(printer.isPrinting).toBe(false);
  });
  test("stops on disconnect and never reports transfer success", async () => {
    vi.useFakeTimers();
    const mock = mockPrinter();
    const printer = await Printer.connect(mock.transport, {
      id: "test",
      name: "LuckP_D1S_F828_BLE",
      rssi: 0,
    });
    const printing = printer.printBitmap({
      width: 8,
      height: 1,
      bytesPerRow: 1,
      data: Uint8Array.of(0x80),
    });
    const rejected = expect(printing).rejects.toThrow(/Connection lost/);
    await mock.connection.disconnect();
    await vi.runAllTimersAsync();
    await rejected;
    expect(printer.isPrinting).toBe(false);
  });
  test("rejects concurrent jobs and over-wide labels before transmission", async () => {
    vi.useFakeTimers();
    const mock = mockPrinter();
    const printer = await Printer.connect(mock.transport, {
      id: "test",
      name: "LuckP_D1S_F828_BLE",
      rssi: 0,
    });
    await expect(
      printer.printBitmap({
        width: 400,
        height: 1,
        bytesPerRow: 50,
        data: new Uint8Array(50),
      }),
    ).rejects.toThrow(/supports 384/);
    expect(mock.written).toHaveLength(0);
    const printing = printer.printBitmap({
      width: 8,
      height: 1,
      bytesPerRow: 1,
      data: Uint8Array.of(0x80),
    });
    await expect(
      printer.printBitmap({
        width: 8,
        height: 1,
        bytesPerRow: 1,
        data: Uint8Array.of(0x80),
      }),
    ).rejects.toThrow(/already running/);
    await vi.runAllTimersAsync();
    await printing;
  });
  test("does not interleave diagnostics with bitmap commands", async () => {
    vi.useFakeTimers();
    const mock = mockPrinter();
    const printer = await Printer.connect(mock.transport, {
      id: "test",
      name: "LuckP_D1S_F828_BLE",
      rssi: 0,
    });
    const query = printer.getStatus(100);
    const rejected = expect(query).rejects.toThrow(/Timeout waiting/);
    await expect(
      printer.printBitmap({
        width: 8,
        height: 1,
        bytesPerRow: 1,
        data: Uint8Array.of(128),
      }),
    ).rejects.toThrow(/Printerdiagnose/);
    await vi.runAllTimersAsync();
    await rejected;
    const printing = printer.printBitmap({
      width: 8,
      height: 1,
      bytesPerRow: 1,
      data: Uint8Array.of(128),
    });
    await vi.runAllTimersAsync();
    await printing;
  });
});
