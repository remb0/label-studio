import type { Page } from "@playwright/test";

export interface MockBluetoothState {
  mode: "cancel" | "error" | "success" | "unknown" | "connection-error";
  calls: { options: unknown; active: boolean }[];
  connects: number;
  writes: number;
}

/** Browser API test double only. Never opens a real chooser or sends printer data. */
export async function mockBluetooth(
  page: Page,
  mode: MockBluetoothState["mode"],
) {
  await page.addInitScript((mode) => {
    const state: MockBluetoothState = {
      mode,
      calls: [],
      connects: 0,
      writes: 0,
    };
    Object.assign(window, { __mockBluetooth: state });
    const characteristic = Object.assign(new EventTarget(), {
      properties: { write: true, writeWithoutResponse: true },
      startNotifications: async () => characteristic,
      stopNotifications: async () => characteristic,
      writeValueWithResponse: async () => {
        state.writes++;
      },
      writeValueWithoutResponse: async () => {
        state.writes++;
      },
    });
    const service = { getCharacteristic: async () => characteristic };
    const gatt = {
      connected: false,
      async connect() {
        state.connects++;
        if (state.mode === "connection-error")
          throw new DOMException("Testverbinding verbroken", "NetworkError");
        gatt.connected = true;
        return gatt;
      },
      disconnect() {
        gatt.connected = false;
        device.dispatchEvent(new Event("gattserverdisconnected"));
      },
      getPrimaryService: async () => service,
    };
    const device = Object.assign(new EventTarget(), {
      id: "label-studio-virtual-printer",
      name: "LuckP_D1S_TEST",
      gatt,
    });
    Object.defineProperty(navigator, "bluetooth", {
      configurable: true,
      value: {
        requestDevice: async (options: unknown) => {
          state.calls.push({
            options,
            active: navigator.userActivation.isActive,
          });
          if (state.mode === "cancel")
            throw new DOMException(
              "User cancelled the chooser",
              "NotFoundError",
            );
          if (state.mode === "error")
            throw new DOMException(
              "Bluetooth-toegang geweigerd door de test",
              "SecurityError",
            );
          device.name =
            state.mode === "unknown" ? "Unknown_TEST" : "LuckP_D1S_TEST";
          return device;
        },
        getDevices: async () => [],
      },
    });
  }, mode);
}

export async function bluetoothState(page: Page) {
  return page.evaluate(
    () =>
      (window as unknown as { __mockBluetooth: MockBluetoothState })
        .__mockBluetooth,
  );
}
