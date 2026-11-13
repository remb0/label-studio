import type { DeviceProfile } from "./types.js";
import { p15Profile } from "./profiles/p15.js";
import { p12Profile } from "./profiles/p12.js";
import { m60Profile } from "./profiles/m60.js";
import { luckpD1sProfile } from "./profiles/luckp-d1s.js";
import { ficheroD11sProfile } from "./profiles/fichero-d11s.js";

const devices: DeviceProfile[] = [];
const patterns = new WeakMap<DeviceProfile, RegExp>();

export function registerDevice(profile: DeviceProfile): void {
  if (devices.some((d) => d.modelId === profile.modelId))
    throw new Error(
      `Device profile "${profile.modelId}" is already registered`,
    );
  // Compile once so an invalid pattern fails at registration, not mid-scan.
  if (profile.namePattern)
    patterns.set(profile, new RegExp(profile.namePattern, "i"));
  devices.push(profile);
}

export function findDeviceByName(name: string): DeviceProfile | null {
  for (const profile of devices) {
    const pattern = patterns.get(profile);
    if (pattern && !pattern.test(name)) continue;
    for (const prefix of profile.namePrefixes) {
      const suffix = name.slice(prefix.length);
      if (
        name.toLowerCase().startsWith(prefix.toLowerCase()) &&
        (profile.namePattern || !suffix || /^[ _-]/.test(suffix))
      ) {
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
registerDevice(ficheroD11sProfile);
registerDevice(luckpD1sProfile);
