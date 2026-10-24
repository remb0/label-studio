import { useT } from "../../lib/i18n.ts";
import { useState } from "react";
import { usePrinterStore } from "../../store/printer-store.ts";

const repo = "https://github.com/remb0/label-studio";
type FormData = {
  brand: string;
  model: string;
  connection: string;
  bluetooth: string;
  maxWidth: string;
  dpi: string;
  media: string;
  productUrl: string;
  operatingSystem: string;
  testResult: string;
  observations: string;
};
const blank: FormData = {
  brand: "",
  model: "",
  connection: "Bluetooth LE",
  bluetooth: "",
  maxWidth: "",
  dpi: "",
  media: "",
  productUrl: "",
  operatingSystem: "",
  testResult: "not-tested",
  observations: "",
};
type Key = keyof FormData;
const words = {
  title: "Help jouw printer toevoegen",
  intro:
    "Beantwoord een paar eenvoudige vragen. Wat je niet weet mag je overslaan. Geen technische kennis nodig.",
  step1: "1. Welke printer?",
  step2: "2. Labels en verbinding",
  step3: "3. Jouw ervaring",
  brand: "Merk *",
  model: "Modelnummer *",
  connection: "Hoe sluit je de printer aan?",
  bluetooth: "Bluetoothnaam (optioneel)",
  maxWidth: "Maximale labelbreedte in mm",
  dpi: "Resolutie (dpi, als bekend)",
  media: "Gebruikte labelformaten",
  productUrl: "Link naar product of handleiding",
  operatingSystem: "Telefoon, tablet of computer",
  testResult: "Heb je geprobeerd te printen?",
  observations: "Wat gebeurde er?",
  next: "Volgende",
  back: "Vorige",
  copy: "Kopieer aanvraag",
  download: "Download aanvraag",
  github: "Open GitHub-aanvraag",
  privacy:
    "Privacy: noteer geen serienummer, MAC-adres, woonadres of persoonlijke informatie. Controleer ook foto's.",
  notice:
    "Deel je aanvraag rechtstreeks via GitHub Issues. Hiervoor is een gratis GitHub-account nodig. Zonder account kun je de aanvraag kopiëren of downloaden.",
  autofill: "Neem gegevens van verbonden printer over",
  examples: "Voorbeeld",
  finish: "Controleer en verstuur",
  success: "Aanvraag gekopieerd. Je kunt deze met de beheerder delen.",
  failure: "Kopiëren is mislukt. Gebruik Download aanvraag.",
  notTested: "Nog niet getest",
  connected: "Bluetooth verbonden, nog niet geprint",
  printed: "Proeflabel werkt",
  failed: "Printen mislukt",
  tipModel: "Kijk op de onderkant, verpakking of in de originele printerapp.",
  tipBle:
    "Dit is de naam die je telefoon of computer toont tijdens het zoeken naar Bluetooth-apparaten. We slaan geen Bluetooth-ID op.",
  tipWidth:
    "Meet het label met een liniaal. Geef bijvoorbeeld 14, 40 of 48 mm op.",
  tipMedia: "Bijvoorbeeld 40 × 30 mm, rond 30 mm of doorlopende rol.",
  tipDpi:
    "Staat vaak als 203 of 300 dpi in de handleiding. Weet je het niet? Laat leeg.",
  tipTest:
    "Een geslaagde melding bewijst nog geen Studio Certified-compatibiliteit. Daarvoor is een gecontroleerde hardwaretest nodig.",
  addDetails: "Extra informatie helpt ons het juiste printprotocol te vinden.",
  summary: "Samenvatting aanvraag",
  required: "Vul merk en model in om door te gaan.",
} as const;
const labels: [
  Key,
  (
    | "brand"
    | "model"
    | "connection"
    | "bluetooth"
    | "maxWidth"
    | "dpi"
    | "media"
    | "productUrl"
    | "operatingSystem"
    | "testResult"
    | "observations"
  ),
][] = [
  ["brand", "brand"],
  ["model", "model"],
  ["connection", "connection"],
  ["bluetooth", "bluetooth"],
  ["maxWidth", "maxWidth"],
  ["dpi", "dpi"],
  ["media", "media"],
  ["productUrl", "productUrl"],
  ["operatingSystem", "operatingSystem"],
  ["testResult", "testResult"],
  ["observations", "observations"],
];
function sanitize(value: string) {
  return value.replace(/[<>]/g, "").trim();
}
function report(data: FormData, tx: ReturnType<typeof useT>): string {
  return [
    tx("## Printer profile request"),
    ...labels.map(
      ([field]) =>
        "- **" +
        tx(words[field]) +
        ":** " +
        (sanitize(data[field]) || tx("Unknown")),
    ),
    "",
    tx("## Verification"),
    tx("- [ ] Printer connected"),
    tx("- [ ] Test label printed correctly"),
    tx("- [ ] Paper size and alignment checked"),
    "",
    tx(
      "Community reports are unverified and never automatically confer Studio Certified status.",
    ),
    tx(
      "Please remove serial numbers, MAC addresses, and other private information.",
    ),
  ].join("\n");
}
export function PrinterSubmission() {
  const tx = useT();
  const w = Object.fromEntries(
    Object.entries(words).map(([key, value]) => [key, tx(value)]),
  ) as Record<keyof typeof words, string>;
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>(blank);
  const [feedback, setFeedback] = useState("");
  const [showReview, setShowReview] = useState(false);
  const peripheral = usePrinterStore((s) => s.peripheral);
  const deviceModel = usePrinterStore((s) => s.deviceModel);
  const set = (key: Key, value: string) =>
    setData((state) => ({ ...state, [key]: value.slice(0, 1000) }));
  const valid = Boolean(data.brand.trim() && data.model.trim());
  const field = (key: Key, tip?: string, placeholder?: string) => (
    <label key={key} className="block text-ui-sm text-ink-300">
      <span className="font-semibold">{w[key]}</span>
      {tip && <span className="block text-ui-xs text-ink-400 my-1">{tip}</span>}
      <input
        className="studio-field"
        type={key === "productUrl" ? "url" : "text"}
        placeholder={placeholder}
        value={data[key]}
        onChange={(e) => set(key, e.target.value)}
        maxLength={1000}
      />
    </label>
  );
  const text = report(data, tx);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback(words.success);
    } catch {
      setFeedback(words.failure);
    }
  };
  const download = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          { schemaVersion: 1, submittedAt: new Date().toISOString(), ...data },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "label-studio-printer-profile.json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const issue = () => {
    if (!valid) return;
    const params = new URLSearchParams({
      title: `Printer profile: ${sanitize(data.brand)} ${sanitize(data.model)}`,
      body: text,
    });
    window.open(
      repo + "/issues/new?" + params,
      "_blank",
      "noopener,noreferrer",
    );
  };
  return (
    <section className="studio-card mt-5" aria-label={w.title}>
      <h2>{w.title}</h2>
      <p>{w.intro}</p>
      <div className="flex flex-wrap gap-2 mt-3" aria-label={tx("Steps")}>
        {[w.step1, w.step2, w.step3].map((title, index) => (
          <button
            key={title}
            type="button"
            onClick={() => setStep(index)}
            aria-current={step === index ? "step" : undefined}
            className={`studio-secondary ${step === index ? "border-accent text-accent" : ""}`}
          >
            {title}
          </button>
        ))}
      </div>
      {step === 0 && (
        <div className="studio-form-grid">
          {field("brand", w.tipModel, "Fichero / DYMO / Marklife")}
          {field("model", w.tipModel, "D11s / D1S / 550")}
          <label className="text-ui-sm text-ink-300 font-semibold">
            {w.connection}
            <select
              className="studio-field"
              value={data.connection}
              onChange={(e) => set("connection", e.target.value)}
            >
              {[
                "Bluetooth LE",
                "Bluetooth Classic",
                "USB",
                "Wi-Fi / LAN",
                tx("Unknown"),
              ].map((x) => (
                <option key={x} value={x}>
                  {tx(x)}
                </option>
              ))}
            </select>
          </label>
          {field("productUrl", undefined, "https://...")}
          {peripheral && (
            <button
              type="button"
              className="studio-secondary"
              onClick={() =>
                setData((d) => ({
                  ...d,
                  model: d.model || deviceModel || "",
                  bluetooth: peripheral.name,
                  connection: "Bluetooth LE",
                }))
              }
            >
              {w.autofill}
            </button>
          )}
        </div>
      )}
      {step === 1 && (
        <div className="studio-form-grid">
          {field("bluetooth", w.tipBle, "LuckP_D1S")}
          {field("maxWidth", w.tipWidth, "48")}
          {field("media", w.tipMedia, "48 × 30 mm")}
          {field("dpi", w.tipDpi, "203")}
        </div>
      )}
      {step === 2 && (
        <div className="studio-form-grid">
          {field(
            "operatingSystem",
            undefined,
            "Android / iPhone / Windows / macOS",
          )}
          <label className="text-ui-sm text-ink-300 font-semibold">
            {w.testResult}
            <select
              className="studio-field"
              value={data.testResult}
              onChange={(e) => set("testResult", e.target.value)}
            >
              {[
                ["not-tested", w.notTested],
                ["connected", w.connected],
                ["printed", w.printed],
                ["failed", w.failed],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <span className="block text-ui-xs text-ink-400">{w.tipTest}</span>
          </label>
          {field("observations", w.addDetails, w.observations)}
        </div>
      )}
      <p className="text-ui-xs my-3">{w.privacy}</p>
      <div className="flex flex-wrap gap-2 items-center">
        {step > 0 && (
          <button
            className="studio-secondary"
            onClick={() => {
              setStep(step - 1);
              setShowReview(false);
            }}
          >
            {w.back}
          </button>
        )}
        {step < 2 ? (
          <button
            className="studio-primary"
            onClick={() => {
              if (step === 0 && !valid) {
                setFeedback(words.required);
                return;
              }
              setFeedback("");
              setStep(step + 1);
            }}
          >
            {w.next}
          </button>
        ) : (
          <button
            className="studio-primary"
            disabled={!valid}
            onClick={() => setShowReview((v) => !v)}
          >
            {w.finish}
          </button>
        )}
      </div>
      {feedback && (
        <p role="status" className="my-2">
          {tx(feedback)}
        </p>
      )}
      {step === 2 && showReview && valid && (
        <div className="mt-4 border-t border-white/10 pt-3">
          <h3 className="font-semibold">{w.summary}</h3>
          <pre className="text-ui-xs whitespace-pre-wrap overflow-wrap-anywhere max-h-72 overflow-auto my-2">
            {text}
          </pre>
          <p className="text-ui-xs">{w.notice}</p>
          <div className="flex flex-wrap gap-2">
            <button className="studio-primary" onClick={issue}>
              {w.github}
            </button>
            <button className="studio-secondary" onClick={() => void copy()}>
              {w.copy}
            </button>
            <button className="studio-secondary" onClick={download}>
              {w.download}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
