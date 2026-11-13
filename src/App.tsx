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
import { CalibrationWizard } from "./features/calibration/CalibrationWizard.tsx";
import { DraftRecovery } from "./features/drafts/DraftRecovery.tsx";
import {
  acquirePrintSession,
  isPrintSessionBusy,
  usePrintSession,
} from "./lib/print-session.ts";

import { AboutPage } from "./features/about/AboutPage.tsx";
import { AccountPage } from "./features/account/AccountPage.tsx";
import { startAccountAutoSync } from "./lib/cloud-account.ts";
import { PrinterSubmission } from "./features/printers/PrinterSubmission.tsx";
import { BluetoothBrowserHelp } from "./features/printers/BluetoothBrowserHelp.tsx";
import { PrinterCompatibility } from "./features/printers/PrinterCompatibility.tsx";
import "./studio.css";

declare const __APP_VERSION__: string;
declare const __COMMIT_SHA__: string;

type Page =
  | "editor"
  | "single"
  | "bulk"
  | "printer"
  | "templates"
  | "settings"
  | "about"
  | "account";

function PrinterWorkspace() {
  const number = useNumberFormatter();
  const tx = useT();
  const state = usePrinterStore();
  const { disconnect } = useWebBluetooth();
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
  if (!state.isConnected) {
    return (
      <section className="studio-page">
        <div className="studio-page-title">
          <span className="studio-eyebrow">{tx("VERBINDEN & INSTELLEN")}</span>
          <h1>{tx("Printer verbinden")}</h1>
          <p>
            {tx(
              "Kies je printer in het Bluetoothvenster van je browser. Daarna herkennen we het ondersteunde model en laden we de juiste instellingen.",
            )}
          </p>
        </div>
        <div className="studio-page-panel">
          <ConnectFlow inline />
        </div>
        <BluetoothBrowserHelp />
        <PrinterCompatibility />
        <PrinterSubmission />
        <CalibrationWizard />
      </section>
    );
  }
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
            onClick={() => void disconnect()}
          >
            {state.isConnecting
              ? tx("Verbinden…")
              : state.isConnected
                ? tx("Verbinding verbreken")
                : tx("Printer verbinden")}
          </button>
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
  const [page, setPage] = useState<Page>(() => {
    const url = new URL(window.location.href);
    return url.searchParams.has("reset_token") ? "account" : "editor";
  });
  const language = useLanguage((s) => s.language);
  const setLanguage = useLanguage((s) => s.setLanguage);
  const connected = usePrinterStore((s) => s.isConnected);
  const printerName = usePrinterStore((s) => s.peripheral?.name);
  const printerStatus = usePrinterStore((s) => s.printerStatus);
  const busy = usePrintSession();
  const navigation = [
    ["editor", "editor", PenTool],
    ["single", "single", Mail],
    ["bulk", "bulk", Rows3],
    ["about", "about", Info],
    ["account", "account", UserRound],
  ] as const;
  useEffect(() => startAccountAutoSync(), []);
  useEffect(() => {
    const formats = () => {
      if (!isPrintSessionBusy()) setPage("settings");
    };
    const templates = () => {
      if (!isPrintSessionBusy()) setPage("templates");
    };
    const printer = () => {
      if (!isPrintSessionBusy()) setPage("printer");
    };
    window.addEventListener("label-studio:open-formats", formats);
    window.addEventListener("label-studio:open-templates", templates);
    window.addEventListener("label-studio:open-printer", printer);
    return () => {
      window.removeEventListener("label-studio:open-formats", formats);
      window.removeEventListener("label-studio:open-templates", templates);
      window.removeEventListener("label-studio:open-printer", printer);
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
              onClick={() => setPage(id)}
            >
              <Icon size={15} />
              <span>{t(language, name)}</span>
            </button>
          ))}
          <button
            disabled={busy}
            aria-label={t(language, "printer")}
            aria-current={page === "printer" ? "page" : undefined}
            onClick={() => setPage("printer")}
          >
            <PrinterIcon size={15} />
            <span>
              {connected
                ? `${t(language, "printer")} · ${printerStatus ? tx(printerStatus) : printerName || t(language, "connected")}`
                : tx("Printer verbinden")}
            </span>
            <span
              aria-hidden="true"
              className={`studio-status-dot ${connected ? "connected" : ""}`}
            />
          </button>
          <button
            disabled={busy}
            aria-current={page === "templates" ? "page" : undefined}
            onClick={() => setPage("templates")}
          >
            <LayoutTemplate size={15} />
            <span>{t(language, "templates")}</span>
          </button>
          <button
            disabled={busy}
            aria-current={page === "settings" ? "page" : undefined}
            onClick={() => setPage("settings")}
          >
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
        ) : page === "templates" ? (
          <section className="studio-page studio-library-page">
            <div className="studio-page-title">
              <span className="studio-eyebrow">{tx("BIBLIOTHEEK")}</span>
              <h1>{tx("Sjablonen")}</h1>
              <p>
                {tx("Beheer startsjablonen en je eigen opgeslagen labels.")}
              </p>
            </div>
            <LibraryFlyout embedded onClose={() => setPage("editor")} />
          </section>
        ) : page === "settings" ? (
          <section className="studio-page studio-settings-page">
            <div className="studio-page-title">
              <span className="studio-eyebrow">{tx("CENTRAAL BEHEER")}</span>
              <h1>{tx("Papier, label en interface")}</h1>
              <p>
                {tx(
                  "Beheer hier alle label-, papier-, afdruk- en interface-instellingen.",
                )}
              </p>
            </div>
            <PrintSettingsFlyout embedded />
          </section>
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
      <DraftRecovery />
    </div>
  );
}
