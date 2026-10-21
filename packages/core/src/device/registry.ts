import type { DeviceProfile } from "./types.js";
import { p15Profile } from "./profiles/p15.js";
import { p12Profile } from "./profiles/p12.js";
import { m60Profile } from "./profiles/m60.js";
import { luckpD1sProfile } from "./profiles/luckp-d1s.js";

const devices: DeviceProfile[] = [];

export function registerDevice(profile: DeviceProfile): void {
  devices.push(profile);
}

export function findDeviceByName(name: string): DeviceProfile | null {
  for (const profile of devices) {
    if (profile.namePattern && !new RegExp(profile.namePattern, "i").test(name))
      continue;
    for (const prefix of profile.namePrefixes) {
      if (name.toLowerCase().startsWith(prefix.toLowerCase())) {
        return profile;
      }
    }
  }
  return null;
}

export function getDevice(modelId: string): DeviceProfile | null {
  return devices.find((d) => d.modelId === modelId) ?? null;
}

export function getRegisteredDevices(): DeviceProfile[] {
  return [...devices];
}

// Register built-in devices
registerDevice(p15Profile);
registerDevice(p12Profile);
registerDevice(m60Profile);
registerDevice(luckpD1sProfile);
