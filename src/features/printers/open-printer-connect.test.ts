import { afterEach, expect, test } from "vitest";
import { openPrinterConnect } from "./open-printer-connect";
import { useEditorV2Store } from "../../store/editor-store";
import { usePrinterStore } from "../../store/printer-store";
import { acquirePrintSession } from "../../lib/print-session";

afterEach(() => {
  usePrinterStore.setState({
    isConnected: false,
    isPrinting: false,
    isScanning: false,
    isConnecting: false,
    error: null,
    preferredModelId: null,
    hasConfirmedPrinterChoice: false,
  });
  useEditorV2Store.setState((s) => ({
    connectFlow: { ...s.connectFlow, open: false, step: "idle" },
  }));
});

test("shared opener preserves a confirmed automatic choice and clears stale UI errors", () => {
  usePrinterStore.setState({
    preferredModelId: null,
    hasConfirmedPrinterChoice: true,
    error: "Previous attempt failed",
  });
  expect(openPrinterConnect()).toBe(true);
  expect(useEditorV2Store.getState().connectFlow).toMatchObject({
    open: true,
    step: "idle",
  });
  expect(usePrinterStore.getState()).toMatchObject({
    preferredModelId: null,
    hasConfirmedPrinterChoice: true,
    error: null,
  });
});

test("all connection entry points respect active connections and print reservations", () => {
  for (const key of [
    "isConnected",
    "isPrinting",
    "isScanning",
    "isConnecting",
  ] as const) {
    usePrinterStore.setState({ [key]: true });
    expect(openPrinterConnect()).toBe(false);
    expect(useEditorV2Store.getState().connectFlow.open).toBe(false);
    usePrinterStore.setState({ [key]: false });
  }
  const release = acquirePrintSession()!;
  try {
    expect(openPrinterConnect()).toBe(false);
  } finally {
    release();
  }
});
