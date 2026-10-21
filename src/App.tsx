import { useEffect, useState } from "react";
import {
  Bluetooth,
  LayoutTemplate,
  Mail,
  Rows3,
  Settings,
  Printer as PrinterIcon,
  PenTool,
} from "lucide-react";
import { Editor } from "./editor/editor.tsx";
import { ConnectFlow } from "./editor/connect-flow/connect-flow.tsx";
import { LibraryFlyout } from "./editor/dock/flyouts/library-flyout.tsx";
import { PrintSettingsFlyout } from "./editor/dock/flyouts/print-settings-flyout.tsx";
import { AddressWorkspace } from "./features/addresses/AddressWorkspace.tsx";
import { usePrinterStore } from "./store/printer-store.ts";
import { useEditorV2Store } from "./store/editor-store.ts";
import { useWebBluetooth, getPrinter } from "./hooks/use-web-bluetooth.ts";
import { getDevice } from "@thermoprint/core";
import { PrinterModelPicker } from "./features/printers/PrinterModelPicker.tsx";
import { CalibrationWizard } from "./features/calibration/CalibrationWizard.tsx";
import { DraftRecovery } from "./features/drafts/DraftRecovery.tsx";
import {
  acquirePrintSession,
  isPrintSessionBusy,
  usePrintSession,
} from "./lib/print-session.ts";
import "./studio.css";

declare const __APP_VERSION__: string;
declare const __COMMIT_SHA__: string;

type Page = "editor" | "single" | "bulk" | "printer";

function openConnect() {
  if (isPrintSessionBusy()) return;
  useEditorV2Store.setState((s) => ({
    connectFlow: { ...s.connectFlow, open: true, step: "idle" },
  }));
}

function PrinterWorkspace() {
  const state = usePrinterStore();
  const { disconnect, reconnect } = useWebBluetooth();
  const [diagnostic, setDiagnostic] = useState("");
  const [reading, setReading] = useState(false);
  const busy = usePrintSession();
  const profile = state.modelId ? getDevice(state.modelId) : null;
  const diagnose = async () => {
    const printer = getPrinter();
    if (!printer) return;
    const release = acquirePrintSession();
    if (!release) return;
    setReading(true);
    try {
      const lines = [`Printer: ${state.peripheral?.name || "Onbekend"}`];
      for (const [label, read] of [
        ["Model", () => printer.getModel()],
        ["Batterij", () => printer.getBattery()],
        ["Status", () => printer.getStatus()],
        ["Firmware", () => printer.getInfo("firmware")],
      ] as const) {
        try {
          lines.push(`${label}: ${JSON.stringify(await read())}`);
        } catch (error) {
          lines.push(
            `${label}: ${error instanceof Error ? error.message : "Niet beschikbaar"}`,
          );
        }
        setDiagnostic(lines.join("\n"));
      }
    } finally {
      setReading(false);
      release();
    }
  };
  return (
    <section className="studio-page">
      <div className="studio-page-title">
        <span className="studio-eyebrow">VERBINDEN & CONTROLEREN</span>
        <h1>Jouw printer</h1>
        <p>Verbind een Bluetooth-printer en bekijk het herkende profiel.</p>
      </div>
      <PrinterModelPicker className="studio-printer-picker" />
      <div className="studio-cards">
        <article className="studio-card">
          <Bluetooth size={28} />
          <h2>
            {state.isConnected
              ? state.peripheral?.name
              : "Klaar om te verbinden"}
          </h2>
          <p>
            {state.isConnected
              ? "Verbonden via de Bluetooth-adapter van dit apparaat."
              : "Zet de printer aan en kies hem in het Bluetooth-venster van je browser."}
          </p>
          <button
            className="studio-primary"
            disabled={busy || state.isConnecting || state.isPrinting || reading}
            onClick={state.isConnected ? () => void disconnect() : openConnect}
          >
            {state.isConnecting
              ? "Verbinden…"
              : state.isConnected
                ? "Verbinding verbreken"
                : "Printer verbinden"}
          </button>
          {!state.isConnected && (
            <button
              className="studio-secondary"
              disabled={busy || state.isConnecting}
              onClick={() => void reconnect()}
            >
              Eerder toegestane printer verbinden
            </button>
          )}
          {state.error && (
            <p role="alert" className="studio-error">
              {state.error}
            </p>
          )}
        </article>
        <article className="studio-card">
          <h2>Herkend profiel</h2>
          <dl>
            <dt>Model</dt>
            <dd>{state.modelId || "Nog geen printer geselecteerd"}</dd>
            <dt>Printbreedte</dt>
            <dd>
              {profile?.printWidth
                ? `${profile.printWidth} pixels`
                : "Niet uitgelezen"}
            </dd>
            <dt>Batterij</dt>
            <dd>
              {state.battery >= 0 ? `${state.battery}%` : "Niet uitgelezen"}
            </dd>
            <dt>Firmware</dt>
            <dd>{state.deviceInfo.firmware || "Niet uitgelezen"}</dd>
          </dl>
          <p>
            Een onbekende printer krijgt geen willekeurige protocolinstellingen.
          </p>
        </article>
        <article className="studio-card">
          <h2>Diagnose</h2>
          <p>
            Lees model, batterij en status. Niet iedere firmware beantwoordt
            alle informatievragen.
          </p>
          <button
            className="studio-secondary"
            disabled={busy || !state.isConnected || reading || state.isPrinting}
            onClick={() => void diagnose()}
          >
            {reading ? "Bezig met uitlezen…" : "Printerdiagnose lezen"}
          </button>
          {diagnostic && <pre aria-live="polite">{diagnostic}</pre>}
        </article>
      </div>
      <CalibrationWizard />
      <p className="studio-footnote">
        Label Studio {__APP_VERSION__} · commit {__COMMIT_SHA__.slice(0, 12)} ·
        Adressen worden lokaal verwerkt.
      </p>
    </section>
  );
}

export function App() {
  const [page, setPage] = useState<Page>("editor");
  const [panel, setPanel] = useState<"library" | "settings" | null>(null);
  const connected = usePrinterStore((s) => s.isConnected);
  const busy = usePrintSession();
  const navigation = [
    ["editor", "Ontwerpen", PenTool],
    ["single", "Adreslabels", Mail],
    ["bulk", "Bulklabels", Rows3],
    ["printer", "Printer", PrinterIcon],
  ] as const;
  useEffect(() => {
    const formats = () => {
      if (!isPrintSessionBusy()) {
        setPage("editor");
        setPanel("settings");
      }
    };
    const templates = () => {
      if (!isPrintSessionBusy()) {
        setPage("editor");
        setPanel("library");
      }
    };
    window.addEventListener("label-studio:open-formats", formats);
    window.addEventListener("label-studio:open-templates", templates);
    return () => {
      window.removeEventListener("label-studio:open-formats", formats);
      window.removeEventListener("label-studio:open-templates", templates);
    };
  }, []);
  return (
    <div className="studio-shell">
      <nav className="studio-nav" aria-label="Hoofdnavigatie">
        <a
          href="#"
          className="studio-brand"
          onClick={(e) => {
            e.preventDefault();
            if (!busy) setPage("editor");
          }}
        >
          LABEL<span>STUDIO</span>
        </a>
        <div className="studio-tabs">
          {navigation.map(([id, name, Icon]) => (
            <button
              key={id}
              disabled={busy}
              aria-current={page === id ? "page" : undefined}
              onClick={() => {
                setPage(id);
                setPanel(null);
              }}
            >
              <Icon size={15} />
              <span>{name}</span>
            </button>
          ))}
          <button disabled={busy} onClick={() => setPanel("library")}>
            <LayoutTemplate size={15} />
            <span>Sjablonen</span>
          </button>
          <button disabled={busy} onClick={() => setPanel("settings")}>
            <Settings size={15} />
            <span>Instellingen</span>
          </button>
        </div>
        <button
          className="studio-connection"
          disabled={busy}
          onClick={() => (connected ? setPage("printer") : openConnect())}
        >
          <span className={connected ? "connected" : ""} />
          {connected ? "Verbonden" : "Verbinden"}
        </button>
      </nav>
      {!window.isSecureContext && (
        <div className="studio-banner">
          Bluetooth vereist HTTPS of localhost. Open de app via
          https://labels.remb0.nl of de lokale ontwikkelserver.
        </div>
      )}
      {!("bluetooth" in navigator) && (
        <div className="studio-banner">
          Ontwerpen en importeren kan in deze browser. Gebruik Chrome of Edge
          met Web Bluetooth om rechtstreeks te printen.
        </div>
      )}
      <main className="studio-main">
        {page === "editor" ? (
          <Editor />
        ) : page === "printer" ? (
          <PrinterWorkspace />
        ) : null}
        <div
          style={{
            height: "100%",
            display: page === "single" || page === "bulk" ? "block" : "none",
          }}
        >
          <AddressWorkspace mode={page === "bulk" ? "bulk" : "single"} />
        </div>
      </main>
      {panel && (
        <>
          <button
            className="studio-backdrop"
            aria-label="Paneel sluiten"
            onClick={() => setPanel(null)}
          />
          {panel === "library" ? (
            <LibraryFlyout
              onClose={() => {
                setPanel(null);
                setPage("editor");
              }}
            />
          ) : (
            <PrintSettingsFlyout onClose={() => setPanel(null)} />
          )}
        </>
      )}
      <ConnectFlow />
      <DraftRecovery />
    </div>
  );
}
