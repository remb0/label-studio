import { useEditorV2Store } from "../../store/editor-store.ts";
import { usePrinterStore } from "../../store/printer-store.ts";
import { isPrintSessionBusy } from "../../lib/print-session.ts";

/** Every entry point opens the same dialog without losing the confirmed choice. */
export function openPrinterConnect(): boolean {
  const state = usePrinterStore.getState();
  if (
    isPrintSessionBusy() ||
    state.isConnected ||
    state.isPrinting ||
    state.isScanning ||
    state.isConnecting
  )
    return false;
  state.setError(null);
  useEditorV2Store.setState((s) => ({
    printFlyoutOpen: false,
    connectFlow: { ...s.connectFlow, open: true, step: "idle" },
  }));
  return true;
}
