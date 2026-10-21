import { useCallback } from "react";
import {
  Printer,
  findDeviceByName,
  type BlePeripheral,
} from "@thermoprint/core";
import { WebBluetoothTransport } from "../transport/web-bluetooth.ts";
import { usePrinterStore, applyModelDefaults } from "../store/printer-store.ts";
import {
  loadPrinterProfiles,
  savePrinterProfile,
} from "../lib/printer-profiles.ts";
import { useEditorV2Store } from "../store/editor-store.ts";

// Module-level singletons so all callers share the same transport + printer instance
const transport = new WebBluetoothTransport();
let printer: Printer | null = null;

export function getPrinter(): Printer | null {
  return printer;
}

export function useWebBluetooth() {
  const store = usePrinterStore;

  const scan = useCallback(async () => {
    if (
      printer?.isPrinting ||
      store.getState().isConnecting ||
      store.getState().isScanning
    )
      return;
    store.getState().setPeripheral(null);
    store.getState().setScanning(true);
    store.getState().setError(null);
    try {
      await transport.scan((peripheral) => {
        store.getState().setPeripheral(peripheral);
        store.getState().setScanning(false);
      });
    } catch (err) {
      store
        .getState()
        .setError(err instanceof Error ? err.message : "Scan failed");
      store.getState().setScanning(false);
    }
  }, [store]);

  const connect = useCallback(
    async (peripheral: BlePeripheral) => {
      if (store.getState().isConnecting || printer?.isPrinting) return;
      store.getState().setConnecting(true);
      store.getState().setError(null);
      try {
        if (printer) await printer.disconnect();
        printer = await Printer.connect(transport, peripheral);
        const connectedPrinter = printer;
        store.getState().setPeripheral(peripheral);
        store.setState({
          battery: -1,
          deviceModel: null,
          printerStatus: null,
          status: null,
          printProgress: null,
          deviceInfo: {
            firmware: null,
            serial: null,
            mac: null,
            btVersion: null,
            btName: null,
            speed: null,
          },
        });

        printer.on("disconnected", () => {
          if (printer !== connectedPrinter) return;
          store.getState().setConnected(false);
          printer = null;
        });

        printer.on("progress", (p) => {
          store.getState().setPrintProgress(p);
        });

        printer.on("printing", ({ isPrinting }) =>
          store.getState().setPrinting(isPrinting),
        );

        printer.on("status", (s) => {
          store.setState({ printerStatus: s.status });
        });

        const profile = findDeviceByName(peripheral.name);
        if (profile) {
          const saved = loadPrinterProfiles().find(
            (item) =>
              item.peripheral.id === peripheral.id &&
              item.modelId === profile.modelId,
          );
          store.getState().setModelId(profile.modelId);
          store.setState({ autoDetectedModelId: profile.modelId });
          applyModelDefaults(profile.modelId);
          if (saved)
            store.getState().updateSettings({
              ...saved.settings,
              printWidth: profile.printWidth ?? saved.settings.printWidth,
            });
          const restored = store.getState().settings;
          useEditorV2Store.setState({
            printSettings: {
              density: restored.density,
              ditherMode: restored.ditherMode,
              threshold: restored.threshold,
            },
          });
          savePrinterProfile({
            peripheral,
            modelId: profile.modelId,
            settings: store.getState().settings,
          });
        }

        // Undocumented legacy replies cannot safely be interpreted as model/battery
        // values automatically; keep diagnostics explicit until verified on hardware.
        if (profile?.completionMode === "transmitted") {
          store.getState().setConnected(true);
          store.getState().setConnecting(false);
          return;
        }

        try {
          const battery = await connectedPrinter.getBattery();
          store.getState().setBattery(battery);
        } catch (err) {
          console.warn("[thermoprint] battery query failed:", err);
        }

        try {
          const model = await connectedPrinter.getModel();
          if (model) {
            store.setState({ deviceModel: model });
          }
        } catch (err) {
          console.warn("[thermoprint] model query failed:", err);
        }

        // Query device info — non-critical, skip any that fail or if a print starts
        const infoQueries = [
          ["firmware", "firmware"],
          ["serial", "serial"],
        ] as const;
        for (const [key, type] of infoQueries) {
          try {
            if (!connectedPrinter.isConnected) break;
            const val = await connectedPrinter.getInfo(
              type as
                | "firmware"
                | "serial"
                | "mac"
                | "bt-version"
                | "bt-name"
                | "speed",
            );
            if (val) {
              store.setState((s) => ({
                deviceInfo: { ...s.deviceInfo, [key]: val },
              }));
            }
          } catch {
            // Non-critical — stop querying on first failure (printer may not support it)
            break;
          }
        }
        store.getState().setConnected(connectedPrinter.isConnected);
        store.getState().setConnecting(false);
      } catch (err) {
        if (printer) {
          try {
            await printer.disconnect();
          } catch {
            /* Link already lost */
          }
          printer = null;
        }
        store.getState().setConnected(false);
        store
          .getState()
          .setError(err instanceof Error ? err.message : "Connection failed");
        store.getState().setConnecting(false);
      }
    },
    [store],
  );

  const disconnect = useCallback(async () => {
    if (printer) {
      await printer.disconnect();
      printer = null;
    }
    store.getState().setConnected(false);
  }, [store]);

  const reconnect = useCallback(async () => {
    try {
      const allowed = await transport.getPermittedDevices();
      const saved = loadPrinterProfiles().at(-1);
      const peripheral =
        allowed.find((item) => item.id === saved?.peripheral.id) ?? allowed[0];
      if (peripheral) await connect(peripheral);
      else
        store
          .getState()
          .setError(
            "Geen eerder toegestane printer beschikbaar. Kies Printer verbinden.",
          );
    } catch (error) {
      store
        .getState()
        .setError(
          error instanceof Error ? error.message : "Opnieuw verbinden mislukt",
        );
    }
  }, [connect, store]);

  return { scan, connect, disconnect, reconnect };
}
