import { afterEach, describe, expect, it, vi } from "vitest";
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
