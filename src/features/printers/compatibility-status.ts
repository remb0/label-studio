export type CompatibilityLevel =
  "untested" | "community-reported" | "studio-certified";

/** Only maintainer-reviewed, physically tested printers should be added here. */
const CERTIFIED_IDS: ReadonlySet<string> = new Set();
export function getCompatibilityLevel(modelId: string): CompatibilityLevel {
  if (CERTIFIED_IDS.has(modelId)) return "studio-certified";
  return "untested";
}
