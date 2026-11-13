import {
  useNumberFormatter,
  type UiMessage,
  errorMessage,
  formatDate,
  message,
  asMessage,
  useLanguage,
  useT,
} from "../../lib/i18n.ts";

import { useEffect, useMemo, useRef, useState } from "react";
import { getDevice } from "@thermoprint/core";
import { usePrinterStore } from "../../store/printer-store.ts";
import { useEditorV2Store } from "../../store/editor-store.ts";
import { getPrinter } from "../../hooks/use-web-bluetooth.ts";
import {
  acquirePrintSession,
  usePrintSession,
} from "../../lib/print-session.ts";
import { toPixels } from "../../label/document.ts";
import { rollAxes } from "../../label/format-presets.ts";
import {
  applyCalibration,
  loadCalibrationStart,
  saveCalibration,
  type Calibration,
} from "./calibration.ts";
import {
  forgetPrinterVerification,
  loadPrinterVerification,
  recordPrinterVerification,
  rulerTicks,
} from "./verification.ts";
import { submitCompatibilityReport } from "../../lib/community-printers.ts";
import "./calibration.css";

const mmToPx = (mm: number, dpi: number) => (mm * dpi) / 25.4;

/**
 * Ruler test label in printer axes: x runs across the head, y along the feed.
 * Ticks every millimetre from the image edge, numbered every 10 mm, so both
 * dimensions can be checked with a real ruler. A centred frame shows alignment.
 */
function pattern(
  widthMm: number,
  heightMm: number,
  dpi: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = toPixels(widthMm, dpi);
  canvas.height = toPixels(heightMm, dpi);
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width,
    h = canvas.height;
  const dot = Math.max(1, Math.round(dpi / 203));
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "black";
  const tickLength = { minor: 1.5, half: 2.5, major: 4 } as const;
  const fontPx = Math.round(mmToPx(2.6, dpi));
  ctx.font = `700 ${fontPx}px Arial, sans-serif`;
  // Across the head, along the top edge.
  for (const tick of rulerTicks(widthMm)) {
    const x = Math.min(w - dot, Math.round(mmToPx(tick.mm, dpi)));
    const thick = tick.kind === "major" ? dot * 2 : dot;
    ctx.fillRect(
      Math.max(0, x - (thick > dot ? dot : 0)),
      0,
      thick,
      mmToPx(tickLength[tick.kind], dpi),
    );
    if (tick.kind === "major" && tick.mm > 0 && x < w - fontPx) {
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(String(tick.mm), x, mmToPx(4.4, dpi));
    }
  }
  // Along the feed, down the left edge.
  for (const tick of rulerTicks(heightMm)) {
    const y = Math.min(h - dot, Math.round(mmToPx(tick.mm, dpi)));
    const thick = tick.kind === "major" ? dot * 2 : dot;
    ctx.fillRect(
      0,
      Math.max(0, y - (thick > dot ? dot : 0)),
      mmToPx(tickLength[tick.kind], dpi),
      thick,
    );
    if (tick.kind === "major" && tick.mm > 0 && y < h - fontPx / 2) {
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(String(tick.mm), mmToPx(4.4, dpi), y);
    }
  }
  // Alignment frame and crosshair, inset from both rulers.
  const mx = Math.min(mmToPx(9, dpi), w * 0.3),
    my = Math.min(mmToPx(9, dpi), h * 0.3);
  ctx.strokeStyle = "black";
  ctx.lineWidth = dot;
  ctx.strokeRect(mx, my, w - mx * 2, h - my * 2);
  ctx.beginPath();
  ctx.moveTo(w / 2, my);
  ctx.lineTo(w / 2, h - my);
  ctx.moveTo(mx, h / 2);
  ctx.lineTo(w - mx, h / 2);
  ctx.stroke();
  const size = Math.min(w - mx * 2, h - my * 2) * 0.16;
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = ["#aaa", "#555", "#000"][i];
    ctx.fillRect(mx + 3 + i * (size + 3), my + 3, size, size);
  }
  return canvas;
}

declare const __APP_VERSION__: string;
declare const __COMMIT_SHA__: string;

export function CalibrationWizard() {
  const number = useNumberFormatter();
  const tx = useT();
  const language = useLanguage((value) => value.language);
  const state = usePrinterStore();
  const busy = usePrintSession();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [width, setWidth] = useState(30);
  const [height, setHeight] = useState(40);
  const [correction, setCorrection] = useState<Calibration>({
    offsetXMm: 0,
    offsetYMm: 0,
  });
  const [density, setDensity] = useState<1 | 2 | 3>(2);
  const [sending, setSending] = useState(false);
  const [printed, setPrinted] = useState(false);
  const [checks, setChecks] = useState<Record<CheckKey, boolean>>(NO_CHECKS);
  const [result, setResult] = useState<"works" | "fails" | null>(null);
  const [shareChecks, setShareChecks] = useState({
    qrScanned: false,
    reconnectChecked: false,
  });
  const [notes, setNotes] = useState("");
  const [shared, setShared] = useState(false);
  const [notice, setMessage] = useState<UiMessage>("");
  const [error, setError] = useState<UiMessage>("");
  // Bumped after a confirmation changes, so the stored status is re-read.
  const [verifiedRevision, setVerifiedRevision] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [target, setTarget] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const profile = state.modelId ? getDevice(state.modelId) : null;
  const dpi = profile?.dpi ?? 203;
  // Chosen in the wizard: the printer's stored paper type falls back to the
  // profile default (gap) on connect, which makes a D1S hunt for a gap mark
  // and feed a long blank strip on a continuous roll.
  const [paper, setPaper] = useState<"gap" | "continuous">("gap");
  const supportedPapers = profile?.labelConfig?.supportedPaperTypes ?? [
    "gap",
    "continuous",
  ];
  const continuous = paper === "continuous";
  const targetId = JSON.stringify([state.peripheral?.id, state.modelId]);
  const changedDevice = open && target !== targetId;
  const verifiedAt = useMemo(
    () =>
      state.modelId
        ? (loadPrinterVerification(state.modelId)?.at ?? null)
        : null,
    // verifiedRevision: re-read storage after this wizard changed it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.modelId, verifiedRevision],
  );
  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open, step]);
  const validSize =
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width >= 2 &&
    height >= 2 &&
    width <= 500 &&
    height <= 500 &&
    toPixels(width, dpi) <= (profile?.printWidth ?? state.settings.printWidth);
  const validCorrection = [correction.offsetXMm, correction.offsetYMm].every(
    (n) => Number.isFinite(n) && Math.abs(n) <= 5,
  );
  const preview = useMemo(() => {
    if (!open || !validSize || !validCorrection)
      return { image: null, error: "Kies geldige maten en correcties." };
    try {
      const raw = pattern(width, height, dpi);
      const image = applyCalibration(
        raw.getContext("2d")!.getImageData(0, 0, raw.width, raw.height),
        correction,
        dpi,
      );
      return { image, error: "" };
    } catch (error) {
      return {
        image: null,
        error:
          error instanceof Error
            ? errorMessage(error)
            : "Kalibratievoorbeeld mislukt.",
      };
    }
  }, [open, width, height, dpi, correction, validSize, validCorrection]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!preview.image) {
      canvas.width = 1;
      canvas.height = 1;
      return;
    }
    const image = preview.image;
    canvas.width = image.width;
    canvas.height = image.height;
    canvas
      .getContext("2d")!
      .putImageData(
        new ImageData(
          new Uint8ClampedArray(image.data),
          image.width,
          image.height,
        ),
        0,
        0,
      );
  }, [preview, step]);

  function start() {
    if (busy) return;
    const editor = useEditorV2Store.getState();
    const { acrossMm, alongMm } = rollAxes(editor.label, editor.rollDirection);
    // The open design knows which paper is loaded better than the printer state.
    const startPaper = supportedPapers.includes(editor.paperType)
      ? editor.paperType
      : state.settings.paperType;
    setPaper(startPaper);
    setWidth(acrossMm);
    // A continuous roll has no fixed length; 40 mm fits a full 10 mm scale.
    setHeight(
      startPaper === "continuous"
        ? Math.max(40, Math.min(alongMm, 80))
        : alongMm,
    );
    const startValue =
      state.peripheral && state.modelId
        ? loadCalibrationStart(state.peripheral.id, state.modelId)
        : { calibration: { offsetXMm: 0, offsetYMm: 0 }, fromModel: false };
    setCorrection(startValue.calibration);
    setDensity(state.settings.density);
    setTarget(targetId);
    setStep(0);
    setPrinted(false);
    setChecks(NO_CHECKS);
    setResult(null);
    setShareChecks({ qrScanned: false, reconnectChecked: false });
    setNotes("");
    setShared(false);
    // A correction from another printer of this model is only a suggestion.
    setMessage(
      startValue.fromModel
        ? "Startwaarde overgenomen van een andere printer van dit model. Controleer met een proefafdruk."
        : "",
    );
    setError("");
    setOpen(true);
  }

  async function testPrint() {
    if (
      busy ||
      sending ||
      !validSize ||
      !validCorrection ||
      changedDevice ||
      preview.error
    )
      return;
    const printer = getPrinter();
    if (!printer || !state.isConnected) {
      setError(
        "Verbind eerst je printer. Sluit daarna deze wizard en open hem opnieuw.",
      );
      return;
    }
    const release = acquirePrintSession();
    if (!release) return;
    setSending(true);
    setError("");
    setMessage("");
    try {
      const raw = pattern(width, height, dpi);
      const image = applyCalibration(
        raw.getContext("2d")!.getImageData(0, 0, raw.width, raw.height),
        correction,
        dpi,
      );
      await printer.print(image, {
        copies: 1,
        density,
        paperType: paper,
        // Pure black ticks stay crisp; the grey swatches show the dot pattern.
        dither: "floyd-steinberg",
      });
      setPrinted(true);
      setMessage(
        "Testlabel verzonden. Controleer de fysieke afdruk; verzonden is geen bevestiging van een geslaagde afdruk.",
      );
    } catch (e) {
      setError(
        message("testPrintWarning", { error: asMessage(errorMessage(e)) }),
      );
    } finally {
      setSending(false);
      release();
    }
  }

  const canConfirm =
    !busy &&
    !changedDevice &&
    state.isConnected &&
    !!state.peripheral &&
    !!state.modelId &&
    validCorrection &&
    !preview.error &&
    printed;

  function confirmWorks() {
    if (!canConfirm || !CHECKS.every(([key]) => checks[key])) return;
    try {
      saveCalibration(state.peripheral!.id, state.modelId!, correction);
      state.updateSettings({ density, paperType: paper });
      useEditorV2Store.setState((s) => ({
        printSettings: { ...s.printSettings, density },
        currentLabelDirty: true,
      }));
      recordPrinterVerification(state.modelId!, {
        paperType: paper,
        widthMm: width,
        lengthMm: height,
      });
      setVerifiedRevision((value) => value + 1);
      setResult("works");
      setMessage(
        "Bevestigd: deze printer werkt. Kalibratie en dichtheid zijn opgeslagen.",
      );
      setError("");
      setStep(3);
    } catch {
      setError(
        "Opslaan mislukt. Browseropslag is mogelijk vol of geblokkeerd. De correctie is niet opgeslagen.",
      );
    }
  }

  function confirmFails() {
    if (!state.modelId) return;
    forgetPrinterVerification(state.modelId);
    setVerifiedRevision((value) => value + 1);
    setResult("fails");
    setMessage(
      "Genoteerd dat de afdruk niet klopt. Er is niets opgeslagen. Deel je ervaring hieronder zodat we het profiel kunnen verbeteren.",
    );
    setError("");
    setStep(3);
  }

  async function share() {
    if (!result || !state.modelId || sending) return;
    setSending(true);
    setError("");
    try {
      await submitCompatibilityReport({
        modelId: state.modelId,
        result,
        connected: state.isConnected,
        testLabelPrinted: printed,
        sizeAlignmentChecked: CHECKS.every(([key]) => checks[key]),
        qrScanned: shareChecks.qrScanned,
        reconnectChecked: shareChecks.reconnectChecked,
        firmware: state.deviceInfo.firmware || undefined,
        notes,
        appVersion: `${__APP_VERSION__} (${__COMMIT_SHA__.slice(0, 12)})`,
      });
      setShared(true);
      setMessage(
        "Bedankt. Je rapport is opgeslagen en wordt eerst beoordeeld voordat het publiek meetelt.",
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  const steps = [
    "Papier controleren",
    "Liniaal printen",
    "Afdruk bevestigen",
    "Delen",
  ] as const;

  return (
    <>
      <article className="studio-card calibration-card">
        <h2>{tx("Printertest & kalibratie")}</h2>
        <p>
          {tx(
            "Print een liniaal, meet breedte en lengte na met een echte liniaal en bevestig dat je printer werkt. Daarna kun je de uitkomst delen met de community.",
          )}
        </p>
        {verifiedAt !== null && (
          <p role="status">
            {tx("verifiedOn", {
              date: formatDate(language, verifiedAt, { dateStyle: "medium" }),
            })}
          </p>
        )}
        <button className="studio-secondary" disabled={busy} onClick={start}>
          {tx("Printertest starten")}
        </button>
      </article>
      {open && (
        <div className="calibration-backdrop">
          <section
            ref={dialogRef}
            tabIndex={-1}
            className="calibration-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={tx("Printertest")}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Escape" && !busy && !sending) {
                setOpen(false);
                return;
              }
              if (event.key !== "Tab") return;
              const controls =
                event.currentTarget.querySelectorAll<HTMLElement>(
                  "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)",
                );
              const first = controls[0],
                last = controls[controls.length - 1];
              if (
                event.shiftKey &&
                (document.activeElement === first ||
                  document.activeElement === dialogRef.current)
              ) {
                event.preventDefault();
                last?.focus();
              } else if (
                !event.shiftKey &&
                (document.activeElement === last ||
                  document.activeElement === dialogRef.current)
              ) {
                event.preventDefault();
                first?.focus();
              }
            }}
          >
            <header>
              <h2>{tx("Printertest")}</h2>
              <button
                aria-label={tx("Printertest sluiten")}
                disabled={sending || busy}
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>
            <p>
              {tx("stepOf", {
                step: number(step + 1),
                total: number(steps.length),
                title: tx(steps[step]),
              })}
            </p>
            {changedDevice && (
              <p role="alert">
                {tx(
                  "De printer is veranderd. Sluit de wizard en begin opnieuw.",
                )}{" "}
              </p>
            )}
            {step === 0 && (
              <>
                <p>
                  {continuous
                    ? tx(
                        "Doorlopende rol: vul de rolbreedte in. De lengte van de testprint kies je zelf; 40 mm of meer laat een volledige schaal zien.",
                      )
                    : tx(
                        "Meet het label in de doorvoerrichting: breedte dwars over de printkop, lengte langs de rol. Dit verandert je ontwerpformaat niet.",
                      )}
                </p>
                <div className="calibration-fields">
                  <label>
                    {tx("Papiersoort")}
                    <select
                      value={paper}
                      onChange={(e) =>
                        setPaper(e.target.value as "gap" | "continuous")
                      }
                    >
                      <option
                        value="gap"
                        disabled={!supportedPapers.includes("gap")}
                      >
                        {tx("Losse labels (gap)")}
                      </option>
                      <option
                        value="continuous"
                        disabled={!supportedPapers.includes("continuous")}
                      >
                        {tx("Doorlopend")}
                      </option>
                    </select>
                  </label>
                  <label>
                    {continuous
                      ? tx("Rolbreedte (mm)")
                      : tx("Testlabel breedte (mm)")}
                    <input
                      type="number"
                      min="2"
                      max="500"
                      step="0.1"
                      value={width}
                      onChange={(e) => setWidth(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    {tx("Testlabel lengte (mm)")}{" "}
                    <input
                      type="number"
                      min="2"
                      max="500"
                      step="0.1"
                      value={height}
                      onChange={(e) => setHeight(Number(e.target.value))}
                    />
                  </label>
                </div>
                <p>
                  {state.isConnected
                    ? `${tx("Printer")}: ${state.peripheral?.name} · ${number(dpi)} dpi · ${continuous ? tx("doorlopende rol") : tx("losse labels")}`
                    : tx(
                        "Nog niet verbonden. Je kunt de wizard bekijken; verbind eerst om te printen of op te slaan.",
                      )}
                </p>
                {!validSize && (
                  <p role="alert">
                    {tx(
                      "Kies een geldige maat die binnen de printkopbreedte past.",
                    )}{" "}
                  </p>
                )}
                <button
                  className="studio-primary"
                  disabled={!validSize || changedDevice || busy}
                  onClick={() => setStep(1)}
                >
                  {tx("Verder naar testlabel")}{" "}
                </button>
              </>
            )}
            {step === 1 && (
              <>
                <p>
                  {tx(
                    "De liniaal begint bij de rand van de afdruk en heeft een streepje per millimeter, met een getal om de 10 mm. Leg er een echte liniaal naast: 10 mm op de afdruk hoort precies 10 mm te zijn. Het kader hoort gecentreerd te staan.",
                  )}
                </p>
                <div className="calibration-preview">
                  <canvas
                    ref={canvasRef}
                    aria-label={tx("Voorbeeld kalibratielabel")}
                  />
                </div>
                {preview.error && (
                  <p role="alert" className="studio-error">
                    {tx(preview.error)}
                  </p>
                )}
                <div className="calibration-fields">
                  <label>
                    {tx("Correctie X (mm)")}{" "}
                    <input
                      disabled={busy}
                      type="number"
                      min="-5"
                      max="5"
                      step="0.1"
                      value={correction.offsetXMm}
                      onChange={(e) =>
                        setCorrection({
                          ...correction,
                          offsetXMm: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    {tx("Correctie Y (mm)")}{" "}
                    <input
                      disabled={busy}
                      type="number"
                      min="-5"
                      max="5"
                      step="0.1"
                      value={correction.offsetYMm}
                      onChange={(e) =>
                        setCorrection({
                          ...correction,
                          offsetYMm: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    {tx("Testdichtheid")}{" "}
                    <select
                      disabled={busy}
                      value={density}
                      onChange={(e) =>
                        setDensity(Number(e.target.value) as 1 | 2 | 3)
                      }
                    >
                      <option value="1">{tx("1 · licht")}</option>
                      <option value="2">{tx("2 · normaal")}</option>
                      <option value="3">{tx("3 · donker")}</option>
                    </select>
                  </label>
                </div>
                <p>
                  {tx(
                    "Het kader hoort gecentreerd te staan. Positief X verschuift rechts; positief Y schuift naar het einde van de rol. Beoordeel dit in de richting waarin het label uit de printer komt.",
                  )}{" "}
                </p>
                <div className="calibration-actions">
                  <button
                    className="studio-secondary"
                    disabled={busy}
                    onClick={() => setStep(0)}
                  >
                    {tx("Terug")}{" "}
                  </button>
                  <button
                    className="studio-secondary"
                    disabled={
                      busy ||
                      !state.isConnected ||
                      !validCorrection ||
                      changedDevice ||
                      !!preview.error
                    }
                    onClick={() => void testPrint()}
                  >
                    {sending ? tx("Verzenden…") : tx("Liniaal printen")}
                  </button>
                  <button
                    className="studio-primary"
                    disabled={!printed || busy || changedDevice}
                    onClick={() => {
                      setMessage("");
                      setStep(2);
                    }}
                  >
                    {tx("Afdruk beoordelen")}
                  </button>
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <p>
                  {tx(
                    "Meet de afdruk na en vink alleen aan wat klopt. Klopt iets niet, ga dan terug en pas de correctie aan, of meld dat de printer niet goed werkt.",
                  )}
                </p>
                <fieldset className="space-y-2">
                  <legend className="sr-only">
                    {tx("Bevestig wat je daadwerkelijk hebt gecontroleerd")}
                  </legend>
                  {CHECKS.map(([key, label]) => (
                    <label key={key} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={checks[key]}
                        onChange={(event) =>
                          setChecks((value) => ({
                            ...value,
                            [key]: event.target.checked,
                          }))
                        }
                      />
                      <span>
                        {tx(label, {
                          width: number(width),
                          length: number(height),
                        })}
                      </span>
                    </label>
                  ))}
                </fieldset>
                <div className="calibration-actions mt-4">
                  <button
                    className="studio-secondary"
                    disabled={busy}
                    onClick={() => setStep(1)}
                  >
                    {tx("Terug")}
                  </button>
                  <button
                    className="studio-secondary"
                    disabled={!state.modelId || busy}
                    onClick={confirmFails}
                  >
                    {tx("Werkt niet")}
                  </button>
                  <button
                    className="studio-primary"
                    disabled={
                      !canConfirm || !CHECKS.every(([key]) => checks[key])
                    }
                    onClick={confirmWorks}
                  >
                    {tx("Printer werkt, opslaan")}
                  </button>
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <h3 className="font-semibold">
                  {tx("Deel je test met de community")}
                </h3>
                <p>
                  {tx(
                    "Optioneel. Je rapport wordt eerst beoordeeld en telt daarna mee in het compatibiliteitsoverzicht. Hiervoor moet je ingelogd zijn.",
                  )}
                </p>
                <fieldset className="space-y-2">
                  {(
                    [
                      ["qrScanned", "QR-code of barcode is scanbaar"],
                      ["reconnectChecked", "Opnieuw verbinden werkt"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        disabled={shared}
                        checked={shareChecks[key]}
                        onChange={(event) =>
                          setShareChecks((value) => ({
                            ...value,
                            [key]: event.target.checked,
                          }))
                        }
                      />
                      <span>{tx(label)}</span>
                    </label>
                  ))}
                </fieldset>
                <label className="block mt-3 text-ui-sm">
                  {tx(
                    "Opmerkingen zonder serienummer, MAC-adres of persoonsgegevens",
                  )}
                  <textarea
                    className="studio-field min-h-20"
                    maxLength={1000}
                    disabled={shared}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </label>
                <div className="calibration-actions mt-3">
                  <button
                    className="studio-secondary"
                    disabled={shared || sending || !result}
                    onClick={() => void share()}
                  >
                    {sending ? tx("Opslaan…") : tx("Delen met de community")}
                  </button>
                  <button
                    className="studio-primary"
                    onClick={() => setOpen(false)}
                  >
                    {tx("Klaar")}
                  </button>
                </div>
              </>
            )}
            {error && (
              <p role="alert" className="studio-error">
                {tx(error)}
              </p>
            )}
            {notice && <p role="status">{tx(notice)}</p>}
          </section>
        </div>
      )}
    </>
  );
}

type CheckKey = "widthOk" | "lengthOk" | "centered";
const CHECKS: readonly (readonly [CheckKey, string])[] = [
  ["widthOk", "rulerWidthOk"],
  ["lengthOk", "rulerLengthOk"],
  ["centered", "Het kader staat gecentreerd (eventueel na correctie)"],
];
const NO_CHECKS: Record<CheckKey, boolean> = {
  widthOk: false,
  lengthOk: false,
  centered: false,
};
