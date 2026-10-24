import {
  useNumberFormatter,
  useT,
  useLanguage,
  t,
  LANGUAGES,
  type Language,
  type UiMessage,
  errorMessage,
  asMessage,
} from "./lib/i18n.ts";

import { useEffect, useState } from "react";
import {
  Bluetooth,
  LayoutTemplate,
  Mail,
  Rows3,
  Settings,
  Printer as PrinterIcon,
  PenTool,
  Info,
  UserRound,
  Languages,
} from "lucide-react";
import { Editor } from "./editor/editor.tsx";
import { ConnectFlow } from "./editor/connect-flow/connect-flow.tsx";
import { LibraryFlyout } from "./editor/dock/flyouts/library-flyout.tsx";
import { PrintSettingsFlyout } from "./editor/dock/flyouts/print-settings-flyout.tsx";
import { AddressWorkspace } from "./features/addresses/AddressWorkspace.tsx";
import { usePrinterStore } from "./store/printer-store.ts";
import { useWebBluetooth, getPrinter } from "./hooks/use-web-bluetooth.ts";
import { getDevice } from "@thermoprint/core";
import { PrinterModelPicker } from "./features/printers/PrinterModelPicker.tsx";
import { openPrinterConnect } from "./features/printers/open-printer-connect.ts";
import { CalibrationWizard } from "./features/calibration/CalibrationWizard.tsx";
import { DraftRecovery } from "./features/drafts/DraftRecovery.tsx";
import {
  acquirePrintSession,
  isPrintSessionBusy,
  usePrintSession,
} from "./lib/print-session.ts";

import { AboutPage } from "./features/about/AboutPage.tsx";
import { AccountPage } from "./features/account/AccountPage.tsx";
import { PrinterSubmission } from "./features/printers/PrinterSubmission.tsx";
import { BluetoothBrowserHelp } from "./features/printers/BluetoothBrowserHelp.tsx";
import { PrinterCompatibility } from "./features/printers/PrinterCompatibility.tsx";
import "./studio.css";

declare const __APP_VERSION__: string;
declare const __COMMIT_SHA__: string;

type Page = "editor" | "single" | "bulk" | "printer" | "about" | "account";

function PrinterWorkspace() {
  const number = useNumberFormatter();
  const tx = useT();
  const state = usePrinterStore();
  const { disconnect, reconnect } = useWebBluetooth();
  const [diagnostic, setDiagnostic] = useState<
    { label: string; value: UiMessage }[]
  >([]);
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
      const lines: { label: string; value: UiMessage }[] = [
        {
          label: "Printer",
          value: state.peripheral?.name || asMessage("Onbekend"),
        },
      ];
      for (const [label, read] of [
        ["Model", () => printer.getModel()],
        ["Batterij", () => printer.getBattery()],
        ["Status", () => printer.getStatus()],
        ["Firmware", () => printer.getInfo("firmware")],
      ] as const) {
        try {
          lines.push({ label, value: JSON.stringify(await read()) });
        } catch (error) {
          lines.push({ label, value: asMessage(errorMessage(error)) });
        }
        setDiagnostic([...lines]);
      }
    } finally {
      setReading(false);
      release();
    }
  };
  return (
    <section className="studio-page">
      <div className="studio-page-title">
        <span className="studio-eyebrow">{tx("VERBINDEN & CONTROLEREN")}</span>
        <h1>{tx("Jouw printer")}</h1>
        <p>
          {tx("Verbind een Bluetooth-printer en bekijk het herkende profiel.")}
        </p>
      </div>
      <PrinterModelPicker className="studio-printer-picker" />
      <div className="studio-cards">
        <article className="studio-card">
          <Bluetooth size={28} />
          <h2>
            {state.isConnected
              ? state.peripheral?.name
              : tx("Klaar om te verbinden")}
          </h2>
          <p>
            {state.isConnected
              ? tx("Verbonden via de Bluetooth-adapter van dit apparaat.")
              : tx(
                  "Zet de printer aan en kies hem in het Bluetooth-venster van je browser.",
                )}
          </p>
          <button
            className="studio-primary"
            disabled={busy || state.isConnecting || state.isPrinting || reading}
            onClick={
              state.isConnected ? () => void disconnect() : openPrinterConnect
            }
          >
            {state.isConnecting
              ? tx("Verbinden…")
              : state.isConnected
                ? tx("Verbinding verbreken")
                : tx("Printer verbinden")}
          </button>
          {!state.isConnected && (
            <button
              className="studio-secondary"
              disabled={busy || state.isConnecting}
              onClick={() => void reconnect()}
            >
              {tx("Eerder toegestane printer verbinden")}{" "}
            </button>
          )}
          {state.error && (
            <p role="alert" className="studio-error">
              {tx(state.error)}
            </p>
          )}
        </article>
        <article className="studio-card">
          <h2>{tx("Herkend profiel")}</h2>
          <dl>
            <dt>{tx("Model")}</dt>
            <dd>{state.modelId || tx("Nog geen printer geselecteerd")}</dd>
            <dt>{tx("Printbreedte")}</dt>
            <dd>
              {profile?.printWidth
                ? `${number(profile.printWidth)} px`
                : tx("Niet uitgelezen")}
            </dd>
            <dt>{tx("Batterij")}</dt>
            <dd>
              {state.battery >= 0 ? `${state.battery}%` : tx("Niet uitgelezen")}
            </dd>
            <dt>{tx("Firmware")}</dt>
            <dd>{state.deviceInfo.firmware || tx("Niet uitgelezen")}</dd>
          </dl>
          <p>
            {tx(
              "Een onbekende printer krijgt geen willekeurige protocolinstellingen.",
            )}{" "}
          </p>
        </article>
        <article className="studio-card">
          <h2>{tx("Diagnose")}</h2>
          <p>
            {tx(
              "Lees model, batterij en status. Niet iedere firmware beantwoordt alle informatievragen.",
            )}{" "}
          </p>
          <button
            className="studio-secondary"
            disabled={busy || !state.isConnected || reading || state.isPrinting}
            onClick={() => void diagnose()}
          >
            {reading ? tx("Bezig met uitlezen…") : tx("Printerdiagnose lezen")}
          </button>
          {diagnostic.length > 0 && (
            <pre aria-live="polite">
              {diagnostic
                .map(
                  ({ label, value }) =>
                    `${tx(label)}: ${typeof value === "string" ? value : tx(value)}`,
                )
                .join("\n")}
            </pre>
          )}
        </article>
      </div>
      <BluetoothBrowserHelp />
      <PrinterCompatibility />
      <PrinterSubmission />
      <CalibrationWizard />
      <p className="studio-footnote">
        Label Studio {__APP_VERSION__} · commit {__COMMIT_SHA__.slice(0, 12)}{" "}
        {tx("· Adressen worden lokaal verwerkt.")}{" "}
      </p>
    </section>
  );
}

export function App() {
  const tx = useT();
  const [page, setPage] = useState<Page>("editor");
  const language = useLanguage((s) => s.language);
  const setLanguage = useLanguage((s) => s.setLanguage);
  const [panel, setPanel] = useState<"library" | "settings" | null>(null);
  const connected = usePrinterStore((s) => s.isConnected);
  const busy = usePrintSession();
  const navigation = [
    ["editor", "editor", PenTool],
    ["single", "single", Mail],
    ["bulk", "bulk", Rows3],
    ["printer", "printer", PrinterIcon],
    ["about", "about", Info],
    ["account", "account", UserRound],
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
      <nav className="studio-nav" aria-label={tx("Hoofdnavigatie")}>
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
              <span>{t(language, name)}</span>
            </button>
          ))}
          <button disabled={busy} onClick={() => setPanel("library")}>
            <LayoutTemplate size={15} />
            <span>{t(language, "templates")}</span>
          </button>
          <button disabled={busy} onClick={() => setPanel("settings")}>
            <Settings size={15} />
            <span>{t(language, "settings")}</span>
          </button>
        </div>
        <label className="studio-language" title={t(language, "language")}>
          <Languages size={14} />
          <select
            aria-label={t(language, "language")}
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <button
          className="studio-connection"
          disabled={busy}
          onClick={() =>
            connected ? setPage("printer") : openPrinterConnect()
          }
        >
          <span className={connected ? "connected" : ""} />
          {t(language, connected ? "connected" : "connect")}
        </button>
      </nav>
      {!window.isSecureContext && (
        <div className="studio-banner">
          {tx(
            "Bluetooth vereist HTTPS of localhost. Open de app via https://labels.remb0.nl of de lokale ontwikkelserver.",
          )}{" "}
        </div>
      )}
      {!("bluetooth" in navigator) && (
        <div className="studio-banner">
          {tx(
            "Ontwerpen en importeren kan in deze browser. Gebruik Chrome of Edge met Web Bluetooth om rechtstreeks te printen.",
          )}{" "}
        </div>
      )}
      <main className="studio-main">
        {page === "editor" ? (
          <Editor />
        ) : page === "printer" ? (
          <PrinterWorkspace />
        ) : page === "about" ? (
          <AboutPage />
        ) : page === "account" ? (
          <AccountPage />
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
            aria-label={tx("Paneel sluiten")}
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
