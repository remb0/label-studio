import { usePrinterStore } from "../../store/printer-store.ts";
import { useEditorV2Store } from "../../store/editor-store.ts";
import { isPrintSessionBusy } from "../../lib/print-session.ts";

/** Every entry point navigates to the single printer workspace. */
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
  useEditorV2Store.setState((editor) => ({
    connectFlow: { ...editor.connectFlow, open: true, step: "idle" },
  }));
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("label-studio:open-printer"));
  return true;
}
