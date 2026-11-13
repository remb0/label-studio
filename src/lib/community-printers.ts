import { accountApi, cloudConfigured, ensureSession } from "./cloud-account.ts";

export interface CompatibilitySummary {
  model_id: string;
  successful_reports: number;
  failed_reports: number;
  approved_reports: number;
  last_tested_at: string | null;
}

export interface CompatibilityReportInput {
  modelId: string;
  result: "works" | "fails";
  connected: boolean;
  testLabelPrinted: boolean;
  sizeAlignmentChecked: boolean;
  qrScanned: boolean;
  reconnectChecked: boolean;
  firmware?: string;
  notes?: string;
  appVersion: string;
}

function clientPlatform(): { browser: string; operatingSystem: string } {
  const value = navigator.userAgent;
  const browser = /Edg\//.test(value)
    ? "Edge"
    : /Chrome\//.test(value)
      ? "Chrome"
      : /Firefox\//.test(value)
        ? "Firefox"
        : /Safari\//.test(value)
          ? "Safari"
          : "Other";
  const operatingSystem = /Android/.test(value)
    ? "Android"
    : /iPhone|iPad/.test(value)
      ? "iOS/iPadOS"
      : /Windows/.test(value)
        ? "Windows"
        : /Mac OS X/.test(value)
          ? "macOS"
          : /Linux/.test(value)
            ? "Linux"
            : "Other";
  return { browser, operatingSystem };
}

export async function loadCompatibilitySummaries(): Promise<
  CompatibilitySummary[]
> {
  if (!cloudConfigured) return [];
  const value = await accountApi("/printers/compatibility");
  return Array.isArray(value) ? (value as CompatibilitySummary[]) : [];
}

export async function submitCompatibilityReport(
  input: CompatibilityReportInput,
): Promise<void> {
  const session = await ensureSession();
  if (!session) throw new Error("Log eerst in om een printertest te delen.");
  const platform = clientPlatform();
  await accountApi("/printers/reports", {
    method: "POST",
    body: JSON.stringify({
      model_id: input.modelId,
      result: input.result,
      connected: input.connected,
      test_label_printed: input.testLabelPrinted,
      size_alignment_checked: input.sizeAlignmentChecked,
      qr_scanned: input.qrScanned,
      reconnect_checked: input.reconnectChecked,
      browser: platform.browser,
      operating_system: platform.operatingSystem,
      firmware: input.firmware?.slice(0, 120) || null,
      notes: input.notes?.slice(0, 1000) || null,
      app_version: input.appVersion.slice(0, 80),
    }),
  });
}

export interface PrinterModelProposalInput {
  brand: string;
  model: string;
  connection: string;
  bluetooth: string;
  maxWidth: string;
  dpi: string;
  media: string;
  productUrl: string;
  operatingSystem: string;
  testResult: "not-tested" | "connected" | "printed" | "failed";
  observations: string;
}

export async function submitPrinterModelProposal(
  input: PrinterModelProposalInput,
): Promise<void> {
  const session = await ensureSession();
  if (!session)
    throw new Error("Log eerst in om een printervoorstel te delen.");
  const width = input.maxWidth.trim() ? Number(input.maxWidth) : null;
  const dpi = input.dpi.trim() ? Number(input.dpi) : null;
  if (width !== null && (!Number.isFinite(width) || width < 1 || width > 500))
    throw new Error("Vul een geldige maximale labelbreedte in.");
  if (dpi !== null && (!Number.isInteger(dpi) || dpi < 100 || dpi > 1200))
    throw new Error("Vul een geldige resolutie in.");
  if (input.productUrl) {
    const url = new URL(input.productUrl);
    if (!/^https?:$/.test(url.protocol))
      throw new Error("Ongeldige productlink.");
  }
  await accountApi("/printers/proposals", {
    method: "POST",
    body: JSON.stringify({
      brand: input.brand.slice(0, 120),
      model: input.model.slice(0, 120),
      connection_type: input.connection.slice(0, 60),
      bluetooth_name: input.bluetooth.slice(0, 160) || null,
      max_width_mm: width,
      dpi,
      media: input.media.slice(0, 500) || null,
      product_url: input.productUrl.slice(0, 1000) || null,
      operating_system: input.operatingSystem.slice(0, 120) || null,
      test_result: input.testResult,
      observations: input.observations.slice(0, 1000) || null,
    }),
  });
}
