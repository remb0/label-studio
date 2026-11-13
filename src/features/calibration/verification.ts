// "This printer model works for me": the result of the user's own ruler test.
// Device-independent, so it can follow a signed-in account.

export interface PrinterVerification {
  /** When the user confirmed the test print (epoch ms). */
  at: number;
  paperType: "gap" | "continuous";
  /** Measured test label, across the head and along the feed. */
  widthMm: number;
  lengthMm: number;
}
export type PrinterVerifications = Record<string, PrinterVerification>;

const KEY = "label-studio:printer-verified:v1";

function validMm(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 2 &&
    value <= 500
  );
}

export function sanitizePrinterVerifications(
  value: unknown,
): PrinterVerifications {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: PrinterVerifications = {};
  for (const [modelId, entry] of Object.entries(value).slice(0, 100)) {
    const data = entry as Partial<PrinterVerification> | null;
    if (
      !modelId ||
      modelId.length > 120 ||
      !data ||
      !Number.isSafeInteger(data.at) ||
      (data.at as number) <= 0 ||
      (data.paperType !== "gap" && data.paperType !== "continuous") ||
      !validMm(data.widthMm) ||
      !validMm(data.lengthMm)
    )
      continue;
    result[modelId] = {
      at: data.at as number,
      paperType: data.paperType,
      widthMm: data.widthMm,
      lengthMm: data.lengthMm,
    };
  }
  return result;
}

export function loadPrinterVerifications(): PrinterVerifications {
  try {
    return sanitizePrinterVerifications(
      JSON.parse(localStorage.getItem(KEY) ?? "{}"),
    );
  } catch {
    return {};
  }
}

export function loadPrinterVerification(
  modelId: string,
): PrinterVerification | null {
  return loadPrinterVerifications()[modelId] ?? null;
}

export function savePrinterVerifications(value: PrinterVerifications): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify(sanitizePrinterVerifications(value)),
    );
  } catch {
    /* optional */
  }
}

/** Newest confirmation per model wins, so devices can be merged in any order. */
export function mergePrinterVerifications(
  local: PrinterVerifications,
  remote: PrinterVerifications,
): PrinterVerifications {
  const result = { ...local };
  for (const [modelId, entry] of Object.entries(remote))
    if (!result[modelId] || entry.at > result[modelId].at)
      result[modelId] = entry;
  return result;
}

export function recordPrinterVerification(
  modelId: string,
  entry: Omit<PrinterVerification, "at">,
  at = Date.now(),
): void {
  savePrinterVerifications({
    ...loadPrinterVerifications(),
    [modelId]: { ...entry, at },
  });
}

export function forgetPrinterVerification(modelId: string): void {
  const all = loadPrinterVerifications();
  delete all[modelId];
  savePrinterVerifications(all);
}

export type RulerTick = { mm: number; kind: "minor" | "half" | "major" };

/** Ruler marks from 0 to `lengthMm`: every mm, longer at 5, numbered at 10. */
export function rulerTicks(lengthMm: number): RulerTick[] {
  const ticks: RulerTick[] = [];
  for (let mm = 0; mm <= Math.floor(lengthMm + 1e-9); mm++)
    ticks.push({
      mm,
      kind: mm % 10 === 0 ? "major" : mm % 5 === 0 ? "half" : "minor",
    });
  return ticks;
}
