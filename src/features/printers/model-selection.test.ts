import { afterEach, expect, test, vi } from "vitest";
import { usePrinterStore } from "../../store/printer-store";
import { acquirePrintSession } from "../../lib/print-session";

afterEach(() => {
  usePrinterStore.setState({
    preferredModelId: null,
    modelId: null,
    isConnected: false,
    isConnecting: false,
    isScanning: false,
  });
  vi.unstubAllGlobals();
});

test("selects model defaults without claiming a Bluetooth connection", () => {
  usePrinterStore
    .getState()
    .updateSettings({ density: 3, paperType: "continuous" });
  usePrinterStore.getState().selectPreferredModel("p15");
  const state = usePrinterStore.getState();
  expect(state.preferredModelId).toBe("p15");
  expect(state.modelId).toBeNull();
  expect(state.isConnected).toBe(false);
  expect(state.settings.density).toBe(2);
  expect(state.settings.paperType).toBe("gap");
});

test("keeps selected model stable while a connected or paused print job owns the printer", () => {
  usePrinterStore.setState({ preferredModelId: "p15", isConnected: true });
  usePrinterStore.getState().selectPreferredModel("m60");
  expect(usePrinterStore.getState().preferredModelId).toBe("p15");
  usePrinterStore.setState({ isConnected: false });
  const release = acquirePrintSession()!;
  try {
    usePrinterStore.getState().selectPreferredModel("m60");
    expect(usePrinterStore.getState().preferredModelId).toBe("p15");
  } finally {
    release();
  }
  usePrinterStore.getState().selectPreferredModel("m60");
  expect(usePrinterStore.getState().preferredModelId).toBe("m60");
});
