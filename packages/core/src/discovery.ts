import type {
  BleTransport,
  BlePeripheral,
  ScanOptions,
  ScanHandle,
} from "./transport/types.js";
import { findDeviceByName } from "./device/registry.js";

export interface DiscoverOptions extends ScanOptions {
  timeoutMs?: number;
  maxResults?: number;
}

/**
 * Discover a single supported printer.
 * Returns the first peripheral whose name matches a registered device profile.
 */
export async function discover(
  transport: BleTransport,
  options: DiscoverOptions = {},
): Promise<BlePeripheral> {
  const [first] = await discoverAll(transport, { ...options, maxResults: 1 });
  if (!first) throw new Error("Discovery timeout: no supported printer found");
  return first;
}

/**
 * Discover all supported printers within the timeout period.
 */
export async function discoverAll(
  transport: BleTransport,
  options: DiscoverOptions = {},
): Promise<BlePeripheral[]> {
  const { timeoutMs = 10000, maxResults, ...scanOptions } = options;
  const found: BlePeripheral[] = [];
  const seen = new Set<string>();

  return new Promise<BlePeripheral[]>((resolve, reject) => {
    let resolved = false;
    let handle: ScanHandle | undefined;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      void Promise.resolve(handle?.stop()).then(() => resolve(found), reject);
    };
    const timer = setTimeout(finish, timeoutMs);

    void transport
      .scan((peripheral) => {
        if (resolved) return;
        if (seen.has(peripheral.id)) return;
        seen.add(peripheral.id);

        if (findDeviceByName(peripheral.name)) {
          found.push(peripheral);
          if (maxResults && found.length >= maxResults) {
            finish();
          }
        }
      }, scanOptions)
      .then((scanHandle) => {
        handle = scanHandle;
        if (resolved) return handle.stop();
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
