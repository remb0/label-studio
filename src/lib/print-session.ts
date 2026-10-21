import { useSyncExternalStore } from "react";

// A reservation covers the whole job, including pauses between individual labels.
// Printer.isPrinting alone only covers one physical transmission at a time.
let owner: symbol | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
export function isPrintSessionBusy(): boolean {
  return owner !== null;
}
export function acquirePrintSession(): (() => void) | null {
  if (owner !== null) return null;
  const token = Symbol("print-session");
  owner = token;
  notify();
  return () => {
    if (owner === token) {
      owner = null;
      notify();
    }
  };
}
export function usePrintSession(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    isPrintSessionBusy,
    () => false,
  );
}

export interface BatchControl {
  pause: boolean;
  cancel: boolean;
}
/** Wait only between labels; cancelling a pause returns immediately at next tick. */
export async function mayPrintNextLabel(
  control: BatchControl,
): Promise<boolean> {
  while (control.pause && !control.cancel)
    await new Promise((resolve) => setTimeout(resolve, 100));
  return !control.cancel;
}
