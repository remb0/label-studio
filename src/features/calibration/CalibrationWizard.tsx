import {
  useNumberFormatter,
  type UiMessage,
  errorMessage,
  message,
  asMessage,
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
import {
  applyCalibration,
  loadCalibration,
  saveCalibration,
  type Calibration,
} from "./calibration.ts";
import "./calibration.css";

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
  const mx = Math.min(toPixels(6, dpi), w * 0.25),
    my = Math.min(toPixels(6, dpi), h * 0.25);
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "black";
  ctx.lineWidth = Math.max(1, Math.round(dpi / 203));
  ctx.strokeRect(mx, my, w - mx * 2, h - my * 2);
  ctx.beginPath();
  ctx.moveTo(w / 2, my);
  ctx.lineTo(w / 2, h - my);
  ctx.moveTo(mx, h / 2);
  ctx.lineTo(w - mx, h / 2);
  ctx.stroke();
  const size = Math.min(w - mx * 2, h - my * 2) * 0.18;
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = ["#aaa", "#555", "#000"][i];
    ctx.fillRect(mx + 3 + i * (size + 3), my + 3, size, size);
  }
  return canvas;
}

export function CalibrationWizard() {
  const number = useNumberFormatter();
  const tx = useT();
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
  const [notice, setMessage] = useState<UiMessage>("");
  const [error, setError] = useState<UiMessage>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [target, setTarget] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const profile = state.modelId ? getDevice(state.modelId) : null;
  const dpi = profile?.dpi ?? 203;
  const targetId = JSON.stringify([state.peripheral?.id, state.modelId]);
  const changedDevice = open && target !== targetId;
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
    const horizontal = editor.rollDirection === "horizontal";
    setWidth(horizontal ? editor.label.heightMm : editor.label.widthMm);
    setHeight(horizontal ? editor.label.widthMm : editor.label.heightMm);
    setCorrection(
      state.peripheral && state.modelId
        ? loadCalibration(state.peripheral.id, state.modelId)
        : { offsetXMm: 0, offsetYMm: 0 },
    );
    setDensity(state.settings.density);
    setTarget(targetId);
    setStep(0);
    setMessage("");
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
        paperType: state.settings.paperType,
        dither: "floyd-steinberg",
      });
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

  function save() {
    if (
      busy ||
      changedDevice ||
      !state.isConnected ||
      !state.peripheral ||
      !state.modelId ||
      !validCorrection ||
      preview.error
    )
      return;
    try {
      saveCalibration(state.peripheral.id, state.modelId, correction);
      state.updateSettings({ density });
      useEditorV2Store.setState((s) => ({
        printSettings: { ...s.printSettings, density },
        currentLabelDirty: true,
      }));
      setMessage(
        "Kalibratie lokaal opgeslagen voor deze printer. Uitlijning geldt voor ontwerpen én adres-/bulklabels. Dichtheid is de nieuwe editorbasis; adreslabels houden hun eigen dichtheidskeuze.",
      );
      setError("");
      setStep(2);
    } catch {
      setError(
        "Opslaan mislukt. Browseropslag is mogelijk vol of geblokkeerd. De correctie is niet opgeslagen.",
      );
    }
  }

  return (
    <>
      <article className="studio-card calibration-card">
        <h2>{tx("Kalibratie & testlabel")}</h2>
        <p>
          {tx(
            "Controleer uitlijning en donkerte. Bewaar een correctie per fysieke printer, zonder je ontwerp te verplaatsen.",
          )}{" "}
        </p>
        <button className="studio-secondary" disabled={busy} onClick={start}>
          {tx("Kalibratie starten")}{" "}
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
            aria-label={tx("Printer kalibreren")}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Escape" && !busy && !sending) {
                setOpen(false);
                return;
              }
              if (event.key !== "Tab") return;
              const controls =
                event.currentTarget.querySelectorAll<HTMLElement>(
                  "button:not(:disabled), input:not(:disabled), select:not(:disabled)",
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
              <h2>{tx("Printer kalibreren")}</h2>
              <button
                aria-label={tx("Kalibratie sluiten")}
                disabled={sending || busy}
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>
            <p>
              {tx("Stap")} {number(step + 1)} {tx("van 3 ·")}{" "}
              {step === 0
                ? tx("Papier controleren")
                : step === 1
                  ? tx("Testen & corrigeren")
                  : tx("Opgeslagen")}
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
                  {tx(
                    "Meet het label in de doorvoerrichting: breedte dwars over de printkop, lengte langs de rol. Dit verandert je ontwerpformaat niet.",
                  )}{" "}
                </p>
                <div className="calibration-fields">
                  <label>
                    {tx("Testlabel breedte (mm)")}{" "}
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
                    ? `${tx("Printer")}: ${state.peripheral?.name} · ${number(dpi)} dpi · ${state.settings.paperType === "gap" ? tx("losse labels") : tx("doorlopende rol")}`
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
                    "Het kader hoort gecentreerd te staan. Positief X verschuift rechts; positief Y schuift naar het einde van de rol. Beoordeel dit in de richting waarin het label uit de printer komt.",
                  )}{" "}
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
                    "Correctie geldt na rotatie voor alle Bluetooth-afdrukken. PNG-export blijft je ongewijzigde ontwerp. Inhoud die door correctie zou worden afgesneden wordt geblokkeerd.",
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
                    {sending ? tx("Verzenden…") : tx("Eén testlabel printen")}
                  </button>
                  <button
                    className="studio-primary"
                    disabled={
                      busy ||
                      !state.isConnected ||
                      !validCorrection ||
                      changedDevice ||
                      !!preview.error
                    }
                    onClick={save}
                  >
                    {tx("Kalibratie opslaan")}{" "}
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
            {step === 2 && (
              <button className="studio-primary" onClick={() => setOpen(false)}>
                {tx("Klaar")}{" "}
              </button>
            )}
          </section>
        </div>
      )}
    </>
  );
}
