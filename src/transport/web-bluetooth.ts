import type {
  BleTransport,
  BleConnection,
  BleService,
  BleCharacteristic,
  BlePeripheral,
  ScanOptions,
  ScanHandle,
} from "@thermoprint/core";
import { getRegisteredDevices, findDeviceByName } from "@thermoprint/core";

/** Expand a short UUID to full 128-bit form for Web Bluetooth */
function expandUuid(uuid: string): string {
  const stripped = uuid.replace(/-/g, "").toLowerCase();
  if (stripped.length === 4) {
    return `0000${stripped}-0000-1000-8000-00805f9b34fb`;
  }
  if (stripped.length === 32) {
    return `${stripped.slice(0, 8)}-${stripped.slice(8, 12)}-${stripped.slice(12, 16)}-${stripped.slice(16, 20)}-${stripped.slice(20)}`;
  }
  return uuid.toLowerCase();
}

class WebBluetoothCharacteristic implements BleCharacteristic {
  private listener: ((data: Uint8Array) => void) | null = null;
  private handler: ((e: Event) => void) | null = null;

  constructor(private readonly char: BluetoothRemoteGATTCharacteristic) {}

  async write(data: Uint8Array, withoutResponse: boolean): Promise<void> {
    const buffer = new Uint8Array(data).buffer as ArrayBuffer;
    const properties = this.char.properties;
    if (
      (withoutResponse && properties.writeWithoutResponse) ||
      (!properties.write && properties.writeWithoutResponse)
    ) {
      await this.char.writeValueWithoutResponse(buffer);
      // Legacy UART firmware requires paced unacknowledged writes.
      if (!withoutResponse)
        await new Promise((resolve) =>
          setTimeout(resolve, data.length > 20 ? 50 : 35),
        );
    } else {
      await this.char.writeValueWithResponse(buffer);
    }
  }

  async subscribe(listener: (data: Uint8Array) => void): Promise<void> {
    this.listener = listener;
    this.handler = (e: Event) => {
      const target = e.target as BluetoothRemoteGATTCharacteristic;
      if (target.value) {
        this.listener?.(
          new Uint8Array(
            target.value.buffer,
            target.value.byteOffset,
            target.value.byteLength,
          ).slice(),
        );
      }
    };
    this.char.addEventListener("characteristicvaluechanged", this.handler);
    await this.char.startNotifications();
  }

  async unsubscribe(): Promise<void> {
    await this.char.stopNotifications();
    if (this.handler) {
      this.char.removeEventListener("characteristicvaluechanged", this.handler);
    }
    this.listener = null;
    this.handler = null;
  }
}

class WebBluetoothService implements BleService {
  constructor(private readonly service: BluetoothRemoteGATTService) {}

  async getCharacteristic(uuid: string): Promise<BleCharacteristic | null> {
    try {
      const char = await this.service.getCharacteristic(expandUuid(uuid));
      return new WebBluetoothCharacteristic(char);
    } catch {
      return null;
    }
  }
}

class WebBluetoothConnection implements BleConnection {
  private connected = true;
  private disconnectCallback: (() => void) | null = null;

  constructor(private readonly device: BluetoothDevice) {
    device.addEventListener("gattserverdisconnected", () => {
      this.connected = false;
      this.disconnectCallback?.();
    });
  }

  onDisconnect(callback: () => void): void {
    this.disconnectCallback = callback;
  }

  async discoverService(uuid: string): Promise<BleService | null> {
    try {
      const server = this.device.gatt;
      if (!server) return null;
      const service = await server.getPrimaryService(expandUuid(uuid));
      return new WebBluetoothService(service);
    } catch {
      return null;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      this.device.gatt?.disconnect();
      this.connected = false;
    }
  }

  get isConnected(): boolean {
    return this.connected;
  }
}

const deviceMap = new Map<string, BluetoothDevice>();

export class WebBluetoothTransport implements BleTransport {
  async getPermittedDevices(): Promise<BlePeripheral[]> {
    if (!navigator.bluetooth?.getDevices) return [];
    const devices = await navigator.bluetooth.getDevices();
    return devices.flatMap((device) => {
      if (!findDeviceByName(device.name ?? "")) return [];
      deviceMap.set(device.id, device);
      return [{ id: device.id, name: device.name ?? "", rssi: 0 }];
    });
  }

  async scan(
    onDiscover: (peripheral: BlePeripheral) => void,
    options?: ScanOptions,
  ): Promise<ScanHandle> {
    if (!globalThis.isSecureContext || !navigator.bluetooth)
      throw new Error(
        "Web Bluetooth requires HTTPS or localhost in Chrome/Edge with Bluetooth support.",
      );
    const devices = getRegisteredDevices();
    const filters: BluetoothLEScanFilter[] = options?.namePrefix
      ? [{ namePrefix: options.namePrefix }]
      : devices.flatMap((d) =>
          d.namePrefixes.map((prefix) => ({ namePrefix: prefix })),
        );

    const serviceUuids = [
      ...new Set(
        devices.flatMap((d) => [
          expandUuid(d.serviceUuid),
          ...(d.alternateServices ?? []).map((service) =>
            expandUuid(service.serviceUuid),
          ),
        ]),
      ),
    ];

    const device = await navigator.bluetooth.requestDevice({
      filters,
      optionalServices: serviceUuids,
    });

    const id = device.id;
    deviceMap.set(id, device);

    onDiscover({
      id,
      name: device.name ?? "",
      rssi: 0,
    });

    return { stop: async () => {} };
  }

  async connect(peripheral: BlePeripheral): Promise<BleConnection> {
    if (!deviceMap.has(peripheral.id)) await this.getPermittedDevices();
    const device = deviceMap.get(peripheral.id);
    if (!device) {
      throw new Error(
        `Device "${peripheral.name}" (${peripheral.id}) not found — was it discovered?`,
      );
    }

    const server = device.gatt;
    if (!server) {
      throw new Error("GATT server not available on this device");
    }

    await server.connect();
    return new WebBluetoothConnection(device);
  }
}
