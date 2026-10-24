import {
  useT,
  useNumberFormatter,
  type UiMessage,
  errorMessage,
  message,
  asMessage,
  messageList,
} from "../../lib/i18n.ts";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type SetStateAction,
} from "react";
import { getPrinter } from "../../hooks/use-web-bluetooth";
import { calibratePrinterImage } from "../calibration/print-calibration.ts";
import {
  acquirePrintSession,
  mayPrintNextLabel,
} from "../../lib/print-session";
import {
  addressFields,
  addressSteps,
  addressStyleLabels,
  detectDelimiter,
  emptyAddress,
  mapAddresses,
  parseCsv,
  parseMappingProfile,
  suggestMapping,
  validateAddress,
  type Address,
  type Mapping,
  type MappingProfile,
} from "./address-model";
import {
  defaultDesign,
  previewPosition,
  renderAddress,
  type AddressDesign,
} from "./render-address";
import "./addresses.css";

type QueueItem = {
  address: Address;
  copy: number;
  status:
    | "Wacht"
    | "Bezig"
    | "Verzonden"
    | "Gecontroleerd"
    | "Onzeker"
    | "Geannuleerd";
  error?: UiMessage;
};
function download(name: string, data: string) {
  const link = document.createElement("a");
  link.download = name;
  link.href = data;
  link.click();
}
function Preview({
  address,
  design,
  logo,
  onOverflow,
  drag,
}: {
  address: Address;
  design: AddressDesign;
  logo: HTMLImageElement | null;
  onOverflow?: (value: boolean) => void;
  drag?: {
    target: "text" | "logo";
    onPosition: (x: number, y: number) => void;
  };
}) {
  const tx = useT();
  const ref = useRef<HTMLCanvasElement>(null);
  const start = useRef<{ x: number; y: number; cx: number; cy: number } | null>(
    null,
  );
  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return previewPosition(
      ((event.clientX - bounds.left) * event.currentTarget.width) /
        bounds.width,
      ((event.clientY - bounds.top) * event.currentTarget.height) /
        bounds.height,
      design.portrait,
      event.currentTarget.width,
      event.currentTarget.height,
    );
  };
  useEffect(() => {
    if (ref.current) {
      const result = renderAddress(ref.current, address, design, logo);
      onOverflow?.(result.overflow);
    }
  }, [address, design, logo, onOverflow]);
  return (
    <canvas
      ref={ref}
      className={`address-label${drag ? " address-draggable" : ""}`}
      aria-label={tx("labelPreview", { name: address.name || address.company })}
      onPointerDown={(event) => {
        if (!drag || (drag.target === "logo" && !logo)) return;
        const p = point(event);
        start.current = {
          ...p,
          cx: drag.target === "text" ? design.textX : design.logoX,
          cy: drag.target === "text" ? design.textY : design.logoY,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
      }}
      onPointerMove={(event) => {
        if (!drag || !start.current) return;
        const p = point(event);
        drag.onPosition(
          Math.min(1, Math.max(0, start.current.cx + p.x - start.current.x)),
          Math.min(1, Math.max(0, start.current.cy + p.y - start.current.y)),
        );
      }}
      onPointerUp={() => {
        start.current = null;
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
    />
  );
}
export function AddressWorkspace({ mode }: { mode: "single" | "bulk" }) {
  const number = useNumberFormatter();
  const tx = useT();
  const [single, setSingle] = useState<Address>(() => emptyAddress());
  const [step, setStep] = useState(0),
    [raw, setRaw] = useState(""),
    [fileName, setFileName] = useState("");
  const [delimiter, setDelimiterState] = useState(";"),
    [header, setHeaderState] = useState(true),
    [mapping, setMappingState] = useState<Mapping>({});
  const [activeOnly, setActiveOnlyState] = useState(false),
    [normalizePostal, setNormalizePostalState] = useState(true),
    [defaultCountry, setDefaultCountryState] = useState("");
  const [addresses, setAddresses] = useState<Address[]>([]),
    [design, setDesign] = useState<AddressDesign>(defaultDesign);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null),
    [overflow, setOverflow] = useState(false);
  const [error, setError] = useState<UiMessage>(""),
    [notice, setNotice] = useState<UiMessage>(""),
    [queue, setQueue] = useState<QueueItem[]>([]),
    [busy, setBusy] = useState(false),
    [paused, setPaused] = useState(false);
  const [profiles, setProfiles] = useState<MappingProfile[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("label-studio-mappings") || "[]",
      ).map(parseMappingProfile);
    } catch {
      return [];
    }
  });
  const [profileName, setProfileName] = useState(() => tx("Mijn CSV-mapping"));
  const [dragTarget, setDragTarget] = useState<"text" | "logo">("text");
  const drag = {
    target: dragTarget,
    onPosition: (x: number, y: number) =>
      setDesign((d) =>
        dragTarget === "text"
          ? { ...d, textX: x, textY: y }
          : { ...d, logoX: x, logoY: y },
      ),
  };
  const invalidateImport = () => {
    setAddresses([]);
    setQueue([]);
  };
  const setDelimiter = (value: string) => {
    invalidateImport();
    setDelimiterState(value);
  };
  const setHeader = (value: boolean) => {
    invalidateImport();
    setHeaderState(value);
  };
  const setMapping = (value: SetStateAction<Mapping>) => {
    invalidateImport();
    setMappingState(value);
  };
  const setActiveOnly = (value: boolean) => {
    invalidateImport();
    setActiveOnlyState(value);
  };
  const setNormalizePostal = (value: boolean) => {
    invalidateImport();
    setNormalizePostalState(value);
  };
  const setDefaultCountry = (value: string) => {
    invalidateImport();
    setDefaultCountryState(value);
  };
  const control = useRef({ pause: false, cancel: false });
  useEffect(() => {
    control.current.cancel = false;
    return () => {
      control.current.cancel = true;
    };
  }, []);
  useEffect(() => {
    if (!design.logoSrc) return;
    const image = new Image();
    let active = true;
    image.onload = () => {
      if (active) setLogo(image);
    };
    image.onerror = () => {
      if (active) {
        setLogo(null);
        setError("Afbeelding kon niet geladen worden.");
      }
    };
    image.src = design.logoSrc;
    return () => {
      active = false;
    };
  }, [design.logoSrc]);
  let rows: string[][] = [],
    parseError: UiMessage = "";
  try {
    rows = raw ? parseCsv(raw, delimiter) : [];
  } catch (e) {
    parseError = errorMessage(e);
  }
  const headers = rows.length
    ? header
      ? rows[0]
      : rows[0].map((_, i) => `Kolom ${i + 1}`)
    : [];
  // Canonical synthetic headers keep existing headerless mapping profiles usable
  // across language changes. Only their display labels are localized.
  const displayHeaders = headers.map((value, index) =>
    header ? value : tx("columnNumber", { number: index + 1 }),
  );
  const data = header ? rows.slice(1) : rows;
  const selected =
    mode === "single" ? [single] : addresses.filter((a) => a.selected);
  const updateDesign = <K extends keyof AddressDesign>(
    key: K,
    value: AddressDesign[K],
  ) => {
    if (key === "logoSrc") setLogo(null);
    setDesign((d) => ({ ...d, [key]: value }));
  };
  const check = () => {
    const next = mapAddresses(data, mapping, {
      activeOnly,
      normalizePostal,
      defaultCountry,
      header,
    });
    setAddresses(next);
    setStep(3);
    if (!next.length)
      setError("Geen adressen na filtering. Pas de filters aan.");
  };
  const saveProfile = () => {
    const profile = parseMappingProfile({
      version: 1,
      name: profileName.trim() || "CSV-mapping",
      headers,
      mapping,
    });
    const next = [...profiles.filter((p) => p.name !== profile.name), profile];
    try {
      localStorage.setItem("label-studio-mappings", JSON.stringify(next));
      setProfiles(next);
      setNotice("Mapping lokaal bewaard. Er zijn geen adressen opgeslagen.");
    } catch {
      setError(
        "Opslaan is niet beschikbaar in deze browser. Exporteer het profiel als JSON.",
      );
    }
  };
  const applyProfile = (profile: MappingProfile) => {
    const next: Mapping = {};
    for (const field of addressFields)
      next[field.key] = (profile.mapping[field.key] || []).flatMap((i) => {
        const found = headers.indexOf(profile.headers[i]);
        return found < 0 ? [] : [found];
      });
    setMapping(next);
    setNotice(message("mappingApplied", { name: profile.name }));
  };
  async function runPrint(test: boolean, retry = false) {
    setError("");
    setNotice("");
    const printer = getPrinter();
    if (!printer?.isConnected) {
      setError("Verbind eerst een printer via het printermenu.");
      return;
    }
    if (printer.isPrinting || busy) {
      setError("Er wordt al een printopdracht uitgevoerd.");
      return;
    }
    if (design.logoSrc && !logo) {
      setError(
        "Wacht totdat de afbeelding geladen is of verwijder de afbeelding.",
      );
      return;
    }
    let jobs: QueueItem[] = retry
      ? queue
          .filter((j) => j.status === "Wacht" || j.status === "Geannuleerd")
          .map((j) => ({ ...j, status: "Wacht" as const }))
      : selected.flatMap((address) =>
          Array.from({ length: test ? 1 : design.copies }, (_, copy) => ({
            address: { ...address },
            copy: copy + 1,
            status: "Wacht" as const,
          })),
        );
    if (test) jobs = jobs.slice(0, 1);
    if (!jobs.length) {
      setError("Selecteer minimaal één adres.");
      return;
    }
    const canvas = document.createElement("canvas");
    for (const job of jobs) {
      const validation = validateAddress(job.address);
      if (validation.length) {
        setError(
          message("rowError", {
            row: job.address.sourceRow,
            error: messageList(validation.map((key) => message(key))),
          }),
        );
        return;
      }
      if (renderAddress(canvas, job.address, design, logo).overflow) {
        setError(message("rowOverflow", { row: job.address.sourceRow }));
        return;
      }
      try {
        calibratePrinterImage(
          canvas
            .getContext("2d")!
            .getImageData(0, 0, canvas.width, canvas.height),
        );
      } catch (error) {
        setError(
          message("rowError", {
            row: job.address.sourceRow,
            error: asMessage(errorMessage(error)),
          }),
        );
        return;
      }
    }
    const release = acquirePrintSession();
    if (!release) {
      setError(
        "Een andere printopdracht is bezig of gepauzeerd. Rond die eerst af.",
      );
      return;
    }
    setQueue(jobs);
    setBusy(true);
    control.current = { pause: false, cancel: false };
    setPaused(false);
    const update = (i: number, change: Partial<QueueItem>) => {
      jobs = jobs.map((j, index) => (index === i ? { ...j, ...change } : j));
      setQueue([...jobs]);
    };
    try {
      for (let i = 0; i < jobs.length; i++) {
        if (!(await mayPrintNextLabel(control.current))) {
          jobs = jobs.map((j) =>
            j.status === "Wacht" ? { ...j, status: "Geannuleerd" } : j,
          );
          setQueue([...jobs]);
          break;
        }
        update(i, { status: "Bezig" });
        renderAddress(canvas, jobs[i].address, design, logo);
        try {
          await printer.print(
            calibratePrinterImage(
              canvas
                .getContext("2d")!
                .getImageData(0, 0, canvas.width, canvas.height),
            ),
            {
              copies: 1,
              density: design.density,
              paperType: design.format,
              dither: "threshold",
              threshold: 150,
            },
          );
          update(i, { status: "Verzonden" });
        } catch (e) {
          update(i, { status: "Onzeker", error: errorMessage(e) });
          setError(message("printStopped", { row: jobs[i].address.sourceRow }));
          break;
        }
      }
      setNotice(
        "Verzonden betekent dat de printaanroep is afgerond. Bevestig zelf of de fysieke afdruk goed is.",
      );
    } finally {
      release();
      setBusy(false);
      setPaused(false);
    }
  }
  const designPanel = (
    <div className="address-panel">
      <h3>{tx("Etiket & opmaak")}</h3>
      <label>
        {tx("Versleep op het voorbeeld")}{" "}
        <select
          value={dragTarget}
          onChange={(e) => setDragTarget(e.target.value as "text" | "logo")}
        >
          <option value="text">{tx("Tekst")}</option>
          <option value="logo">{tx("Logo / afbeelding")}</option>
        </select>
      </label>
      <p className="address-muted">
        {tx(
          "Sleep op een etiket om het gekozen onderdeel te verplaatsen. Afbeeldingen krijgen fotodithering; tekst blijft scherp zwart-wit.",
        )}{" "}
      </p>
      <div className="address-fields">
        <label>
          {tx("Papier")}{" "}
          <select
            value={design.format}
            onChange={(e) =>
              updateDesign("format", e.target.value as AddressDesign["format"])
            }
          >
            <option value="gap">{tx("52 × 30 mm · gap-label")}</option>
            <option value="continuous">
              {tx("52 mm rol · 56 mm ontwerp")}
            </option>
          </select>
        </label>
        <label>
          {tx("Richting")}{" "}
          <select
            value={String(design.portrait)}
            onChange={(e) =>
              updateDesign("portrait", e.target.value === "true")
            }
          >
            <option value="false">{tx("Liggend")}</option>
            <option value="true">{tx("Staand")}</option>
          </select>
        </label>
        <label>
          {tx("Tekstgrootte ·")} {number(design.size)} px
          <input
            type="range"
            min="12"
            max="48"
            value={design.size}
            onChange={(e) => updateDesign("size", +e.target.value)}
          />
        </label>
        <label>
          {tx("Density")}{" "}
          <select
            value={design.density}
            onChange={(e) => updateDesign("density", +e.target.value)}
          >
            <option value="1">{tx("Licht")}</option>
            <option value="2">{tx("Normaal")}</option>
            <option value="3">{tx("Donker")}</option>
          </select>
        </label>
      </div>
      <div className="address-actions">
        {(["bold", "italic", "underline", "border"] as const).map((key, i) => (
          <button
            key={key}
            className={design[key] ? "address-active" : ""}
            aria-pressed={design[key]}
            onClick={() => updateDesign(key, !design[key])}
          >
            {tx(addressStyleLabels[i])}
          </button>
        ))}
      </div>
      <div className="address-fields">
        {(["textX", "textY"] as const).map((key, i) => (
          <label key={key}>
            {tx("Tekst")} {tx(i ? "verticaal" : "horizontaal")} ·{" "}
            {number(Math.round(design[key] * 100))}%
            <input
              type="range"
              min="0"
              max="100"
              value={design[key] * 100}
              onChange={(e) => updateDesign(key, +e.target.value / 100)}
            />
          </label>
        ))}
      </div>
      <h3>{tx("Logo / afbeelding")}</h3>
      <div className="address-actions">
        <button onClick={() => updateDesign("logoSrc", "/boxcare-logo.png")}>
          {tx("BoxCare-logo")}{" "}
        </button>
        <button onClick={() => updateDesign("logoSrc", "/boxcare-box.webp")}>
          {tx("BoxCare-icoon")}{" "}
        </button>
        <button onClick={() => updateDesign("logoSrc", "")}>
          {tx("Verwijderen")}
        </button>
      </div>
      <label>
        {tx("Eigen afbeelding")}{" "}
        <input
          type="file"
          accept="image/*"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 10_000_000) {
              setError("Kies een afbeelding kleiner dan 10 MB.");
              return;
            }
            const reader = new FileReader();
            reader.onload = () =>
              updateDesign("logoSrc", String(reader.result));
            reader.readAsDataURL(file);
          }}
        />
      </label>
      {design.logoSrc && (
        <>
          <div className="address-fields">
            <label>
              {tx("Laag")}{" "}
              <select
                value={design.logoLayer}
                onChange={(e) =>
                  updateDesign("logoLayer", e.target.value as "front" | "back")
                }
              >
                <option value="back">{tx("Achter tekst")}</option>
                <option value="front">{tx("Voor tekst")}</option>
              </select>
            </label>
            <label>
              {tx("Grootte ·")} {number(design.logoScale)}%
              <input
                type="range"
                min="10"
                max="250"
                value={design.logoScale}
                onChange={(e) => updateDesign("logoScale", +e.target.value)}
              />
            </label>
            {(["logoX", "logoY"] as const).map((key, i) => (
              <label key={key}>
                Logo {tx(i ? "verticaal" : "horizontaal")}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={design[key] * 100}
                  onChange={(e) => updateDesign(key, +e.target.value / 100)}
                />
              </label>
            ))}
          </div>
        </>
      )}
      <p className="address-muted">
        {tx(
          "384 afdrukpunten · 203 dpi · 48 mm afdrukbreedte op 52 mm papier. Opmaak geldt voor alle geselecteerde etiketten.",
        )}{" "}
      </p>
    </div>
  );
  const printPanel = (
    <div className="address-panel">
      <h3>{tx("Printopdracht")}</h3>
      <p>
        {number(selected.length)} {tx("geselecteerde adressen ·")}{" "}
        {number(selected.length * design.copies)} {tx("etiketten")}{" "}
      </p>
      <label>
        {tx("Kopieën per adres")}{" "}
        <input
          type="number"
          min="1"
          max="100"
          value={design.copies}
          onChange={(e) =>
            updateDesign(
              "copies",
              Math.min(
                100,
                Math.max(1, Math.trunc(Number(e.target.value)) || 1),
              ),
            )
          }
        />
      </label>
      <div className="address-actions">
        <button
          disabled={busy || !selected.length}
          onClick={() => void runPrint(true)}
        >
          {tx("Eén proefetiket")}{" "}
        </button>
        <button
          className="address-primary"
          disabled={busy || !selected.length}
          onClick={() => void runPrint(false)}
        >
          {tx("Print")} {number(selected.length * design.copies)}{" "}
          {tx("etiketten")}{" "}
        </button>
        {busy && (
          <>
            <button
              onClick={() => {
                control.current.pause = !control.current.pause;
                setPaused(control.current.pause);
              }}
            >
              {paused ? tx("Hervatten") : tx("Pauzeren na huidig etiket")}
            </button>
            <button
              onClick={() => {
                control.current.cancel = true;
                setNotice(
                  "Stop aangevraagd. Het huidige etiket wordt afgewerkt.",
                );
              }}
            >
              {tx("Annuleren na huidig etiket")}{" "}
            </button>
          </>
        )}
      </div>
      <p className="address-muted">
        {tx(
          "Controle vóór verzending: verplichte velden en tekst buiten het etiket. Pauzeren en annuleren werken tussen etiketten.",
        )}{" "}
      </p>
      {queue.length > 0 && (
        <>
          <div className="address-queue-summary">
            {number(
              queue.filter((j) =>
                ["Verzonden", "Gecontroleerd"].includes(j.status),
              ).length,
            )}{" "}
            {tx("verzonden ·")}{" "}
            {number(queue.filter((j) => j.status === "Gecontroleerd").length)}{" "}
            {tx("fysiek gecontroleerd /")} {number(queue.length)}
            <progress
              max={queue.length}
              value={
                queue.filter((j) =>
                  ["Verzonden", "Gecontroleerd"].includes(j.status),
                ).length
              }
            />
          </div>
          <div className="address-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{tx("Rij / kopie")}</th>
                  <th>{tx("Naam")}</th>
                  <th>{tx("Status")}</th>
                  <th>{tx("Controle")}</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((j, i) => (
                  <tr key={i}>
                    <td>
                      {number(j.address.sourceRow)} / {number(j.copy)}
                    </td>
                    <td>{j.address.name || j.address.company}</td>
                    <td title={j.error ? tx(j.error) : undefined}>
                      {tx(j.status)}
                      {j.error && `: ${tx(j.error || "")}`}
                    </td>
                    <td>
                      {j.status === "Verzonden" && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            setQueue((q) =>
                              q.map((v, index) =>
                                index === i
                                  ? { ...v, status: "Gecontroleerd" }
                                  : v,
                              ),
                            )
                          }
                        >
                          {tx("Afdruk is goed")}{" "}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!busy &&
            queue.some((j) => ["Wacht", "Geannuleerd"].includes(j.status)) && (
              <button onClick={() => void runPrint(false, true)}>
                {tx("Alleen niet-verzonden etiketten hervatten")}{" "}
              </button>
            )}
        </>
      )}
    </div>
  );
  return (
    <section className="address-workspace">
      <div className="address-heading">
        <div>
          <span className="address-eyebrow">
            {tx("LABEL STUDIO / ADRESSEN")}
          </span>
          <h1>
            {mode === "single"
              ? tx("Een adres, direct klaar.")
              : tx("Van CSV naar een complete labelrol.")}
          </h1>
          <p>
            {tx(
              "Ontwerp, controleer en print je adreslabels. Je adresgegevens blijven in deze browser.",
            )}{" "}
          </p>
        </div>
        <span className="address-badge">{tx("Lokaal & privé")}</span>
      </div>
      {(error || parseError) && (
        <div role="alert" className="address-error">
          {tx(error || parseError)}
          <button
            onClick={() => setError("")}
            aria-label={tx("Melding sluiten")}
          >
            ×
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className="address-notice">
          {tx(notice)}
        </p>
      )}
      <fieldset className="address-body" disabled={busy}>
        {mode === "single" ? (
          <div className="address-layout">
            <div className="address-panel">
              <h3>{tx("Adresgegevens")}</h3>
              <AddressForm address={single} onChange={setSingle} />
              <div className="address-actions">
                <button onClick={() => setSingle(emptyAddress())}>
                  {tx("Leegmaken")}{" "}
                </button>
                <button
                  onClick={() => {
                    const canvas = document.createElement("canvas");
                    renderAddress(canvas, single, design, logo);
                    download("adreslabel.png", canvas.toDataURL());
                  }}
                >
                  {tx("Download PNG")}{" "}
                </button>
                <button
                  onClick={() => {
                    const canvas = document.createElement("canvas");
                    renderAddress(canvas, single, design, logo);
                    const printWindow = window.open("", "_blank");
                    if (!printWindow) {
                      setError("Sta pop-ups toe voor systeemprint.");
                      return;
                    }
                    const doc = printWindow.document;
                    const style = doc.createElement("style");
                    style.textContent = `@page{size:52mm ${design.format === "gap" ? 30 : 56}mm;margin:0}body{margin:0;width:52mm;display:flex;justify-content:center}img{width:48mm}`;
                    doc.head.append(style);
                    const img = doc.createElement("img");
                    img.onload = () => printWindow.print();
                    img.src = canvas.toDataURL();
                    doc.body.append(img);
                  }}
                >
                  {tx("Systeemprint")}{" "}
                </button>
              </div>
            </div>
            <div className="address-preview-panel">
              <Preview
                address={single}
                design={design}
                logo={logo}
                drag={busy ? undefined : drag}
                onOverflow={setOverflow}
              />
              {overflow && (
                <p className="address-error">
                  {tx(
                    "Tekst valt buiten het etiket. Verklein of verplaats het tekstblok.",
                  )}{" "}
                </p>
              )}
              {validateAddress(single).length > 0 && (
                <p className="address-muted">
                  {validateAddress(single).join(" · ")}
                </p>
              )}
            </div>
            {designPanel}
          </div>
        ) : (
          <>
            <nav className="address-steps" aria-label={tx("Importstappen")}>
              {addressSteps.map((title, i) => (
                <button
                  key={tx(title)}
                  aria-current={step === i ? "step" : undefined}
                  className={step === i ? "address-step-current" : ""}
                  disabled={
                    i > step && (i > 2 ? !addresses.length : !rows.length)
                  }
                  onClick={() => setStep(i)}
                >
                  <span>{number(i + 1)}</span>
                  {tx(title)}
                </button>
              ))}
            </nav>
            {step === 0 && (
              <div className="address-panel">
                <h2>{tx("Kies je CSV-bestand")}</h2>
                <p className="address-muted">
                  {tx(
                    "UTF-8 CSV met komma, puntkomma of tab. Er wordt niets naar een server verstuurd.",
                  )}{" "}
                </p>
                <label className="address-upload">
                  {tx("CSV-bestand kiezen")}{" "}
                  <input
                    type="file"
                    accept=".csv,.tsv,text/csv,text/tab-separated-values"
                    onChange={async (e) => {
                      try {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 10_000_000)
                          throw new Error("CSV is te groot (maximaal 10 MB).");
                        const text = await file.text();
                        const d = detectDelimiter(text);
                        const parsed = parseCsv(text, d);
                        setRaw(text);
                        setDelimiter(d);
                        setFileName(file.name);
                        setMapping(suggestMapping(parsed[0] || []));
                        setActiveOnly(
                          (parsed[0] || []).some(
                            (h) => h.trim().toLowerCase() === "actief",
                          ),
                        );
                        setAddresses([]);
                        setError("");
                      } catch (e) {
                        setError(errorMessage(e));
                      }
                    }}
                  />
                </label>
                {fileName && (
                  <p>
                    {fileName} · {number(data.length)} {tx("gegevensrijen ·")}{" "}
                    {number(headers.length)} {tx("kolommen")}{" "}
                  </p>
                )}
                <div className="address-fields">
                  <label>
                    {tx("Scheidingsteken")}{" "}
                    <select
                      value={delimiter}
                      onChange={(e) => {
                        setDelimiter(e.target.value);
                        setMapping({});
                      }}
                    >
                      <option value=";">{tx("Puntkomma ;")}</option>
                      <option value=",">{tx("Komma ,")}</option>
                      <option value={"\t"}>Tab</option>
                    </select>
                  </label>
                  <label className="address-check">
                    <input
                      type="checkbox"
                      checked={header}
                      onChange={(e) => {
                        setHeader(e.target.checked);
                        setMapping(
                          e.target.checked ? suggestMapping(rows[0] || []) : {},
                        );
                      }}
                    />
                    {tx("Eerste rij bevat kolomnamen")}{" "}
                  </label>
                </div>
                <DataPreview headers={displayHeaders} data={data.slice(0, 5)} />
                <button
                  className="address-primary"
                  disabled={!data.length || Boolean(parseError)}
                  onClick={() => {
                    if (!Object.values(mapping).some((v) => v?.length))
                      setMapping(suggestMapping(headers));
                    setStep(1);
                  }}
                >
                  {tx("Kolommen koppelen →")}{" "}
                </button>
              </div>
            )}
            {step === 1 && (
              <div className="address-panel">
                <h2>{tx("Koppel de kolommen aan je adres")}</h2>
                <p className="address-muted">
                  {tx(
                    "Kies één of meerdere bronkolommen per doelveld. Meerdere kolommen worden met een spatie samengevoegd. De eerste gegevensrij zie je direct als voorbeeld.",
                  )}{" "}
                </p>
                <div className="address-profile">
                  <label>
                    {tx("Bewaarde mapping")}{" "}
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const p = profiles.find(
                          (v) => v.name === e.target.value,
                        );
                        if (p) applyProfile(p);
                      }}
                    >
                      <option value="">{tx("Kies een profiel…")}</option>
                      {profiles.map((p) => (
                        <option key={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={() => {
                      setMapping(suggestMapping(headers));
                      setNotice(
                        "Kolommen automatisch herkend, inclusief BoxCare-velden. Controleer de koppeling hieronder.",
                      );
                    }}
                  >
                    {tx("Automatisch herkennen")}{" "}
                  </button>
                  <label>
                    {tx("Importeer mapping")}{" "}
                    <input
                      type="file"
                      accept=".json"
                      onChange={async (e) => {
                        try {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 10_000_000)
                              throw new Error(
                                "Mappingprofiel is te groot (maximaal 10 MB).",
                              );
                            applyProfile(
                              parseMappingProfile(
                                JSON.parse(await file.text()),
                              ),
                            );
                          }
                        } catch (e) {
                          setError(errorMessage(e));
                        }
                      }}
                    />
                  </label>
                </div>
                <div className="address-mappings">
                  {addressFields.map((field) => (
                    <div className="address-mapping" key={field.key}>
                      <div>
                        <strong>{tx(field.label)}</strong>
                        <small>
                          {(mapping[field.key] || [])
                            .map((i) => data[0]?.[i] || "—")
                            .join(" ") || tx("Niet gekoppeld")}
                        </small>
                      </div>
                      <span aria-hidden="true">←</span>
                      <select
                        multiple
                        aria-label={tx("sourceColumns", {
                          field: tx(field.label),
                        })}
                        value={(mapping[field.key] || []).map(String)}
                        onChange={(e) =>
                          setMapping((m) => ({
                            ...m,
                            [field.key]: Array.from(
                              e.target.selectedOptions,
                              (o) => +o.value,
                            ),
                          }))
                        }
                      >
                        {displayHeaders.map((h, i) => (
                          <option key={i} value={i}>
                            {h} — {data[0]?.[i] || tx("leeg")}
                          </option>
                        ))}
                      </select>
                      <button
                        aria-label={tx("clearMapping", {
                          field: tx(field.label),
                        })}
                        onClick={() =>
                          setMapping((m) => ({ ...m, [field.key]: [] }))
                        }
                      >
                        {tx("Wis")}{" "}
                      </button>
                    </div>
                  ))}
                </div>
                <div className="address-profile">
                  <label>
                    {tx("Profielnaam")}{" "}
                    <input
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                    />
                  </label>
                  <button onClick={saveProfile}>{tx("Bewaar mapping")}</button>
                  <button
                    onClick={() =>
                      download(
                        "label-mapping.json",
                        `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify({ version: 1, name: profileName, headers, mapping }, null, 2))}`,
                      )
                    }
                  >
                    {tx("Exporteer JSON")}{" "}
                  </button>
                </div>
                <button
                  className="address-primary"
                  disabled={
                    !mapping.street?.length ||
                    !mapping.postal?.length ||
                    !mapping.city?.length ||
                    (!mapping.name?.length && !mapping.company?.length)
                  }
                  onClick={() => setStep(2)}
                >
                  {tx("Filters instellen →")}{" "}
                </button>
              </div>
            )}
            {step === 2 && (
              <div className="address-panel">
                <h2>{tx("Filters & opschonen")}</h2>
                <label className="address-check">
                  <input
                    type="checkbox"
                    disabled={!mapping.active?.length}
                    checked={activeOnly}
                    onChange={(e) => setActiveOnly(e.target.checked)}
                  />
                  {tx("Alleen actieve rijen (Ja / Yes / True / 1)")}{" "}
                </label>
                <label className="address-check">
                  <input
                    type="checkbox"
                    checked={normalizePostal}
                    onChange={(e) => setNormalizePostal(e.target.checked)}
                  />
                  {tx("Nederlandse postcodes normaliseren naar 1234 AB")}{" "}
                </label>
                <label>
                  {tx("Standaardland voor lege landvelden")}{" "}
                  <input
                    placeholder={tx("Optioneel, bijvoorbeeld Nederland")}
                    value={defaultCountry}
                    onChange={(e) => setDefaultCountry(e.target.value)}
                  />
                </label>
                <p className="address-muted">
                  {tx(
                    "Overbodige spaties worden opgeschoond. Straat en huisnummer worden samengevoegd. Zakelijke adressen krijgen automatisch ‘T.a.v.’ vóór de contactpersoon.",
                  )}{" "}
                </p>
                <button className="address-primary" onClick={check}>
                  {tx("Adressen controleren →")}{" "}
                </button>
              </div>
            )}
            {step === 3 && (
              <div className="address-panel">
                <h2>{tx("Controleer & verbeter")}</h2>
                <p>
                  {number(addresses.length)} {tx("adressen ·")}{" "}
                  {number(
                    addresses.filter((a) => !validateAddress(a).length).length,
                  )}{" "}
                  {tx("volledig ·")}{" "}
                  {number(addresses.filter((a) => a.selected).length)}{" "}
                  {tx("geselecteerd")}{" "}
                </p>
                <div className="address-actions">
                  <button
                    onClick={() =>
                      setAddresses((a) =>
                        a.map((v) => ({
                          ...v,
                          selected: !validateAddress(v).length,
                        })),
                      )
                    }
                  >
                    {tx("Selecteer geldige adressen")}{" "}
                  </button>
                  <button
                    onClick={() =>
                      setAddresses((a) =>
                        a.map((v) => ({ ...v, selected: false })),
                      )
                    }
                  >
                    {tx("Selectie wissen")}{" "}
                  </button>
                </div>
                <div className="address-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{tx("Selectie")}</th>
                        <th>{tx("CSV-rij")}</th>
                        {[
                          tx("Bedrijf"),
                          tx("Naam"),
                          tx("Straat"),
                          tx("Postcode"),
                          tx("Plaats"),
                          tx("Land"),
                          tx("Extra"),
                          tx("Type"),
                          tx("Controle"),
                        ].map((h) => (
                          <th key={h}>{tx(h)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {addresses.map((a, i) => (
                        <tr
                          key={i}
                          className={
                            validateAddress(a).length ? "address-invalid" : ""
                          }
                        >
                          <td>
                            <input
                              aria-label={tx("selectRow", { row: a.sourceRow })}
                              type="checkbox"
                              checked={a.selected}
                              onChange={(e) =>
                                setAddresses((all) =>
                                  all.map((v, j) =>
                                    j === i
                                      ? { ...v, selected: e.target.checked }
                                      : v,
                                  ),
                                )
                              }
                            />
                          </td>
                          <td>{number(a.sourceRow)}</td>
                          {(
                            [
                              "company",
                              "name",
                              "street",
                              "postal",
                              "city",
                              "country",
                              "extra",
                              "type",
                            ] as const
                          ).map((key) => (
                            <td key={key}>
                              <input
                                aria-label={tx("rowField", {
                                  row: a.sourceRow,
                                  field: tx(
                                    addressFields.find((f) => f.key === key)
                                      ?.label || key,
                                  ),
                                })}
                                value={a[key]}
                                onChange={(e) =>
                                  setAddresses((all) =>
                                    all.map((v, j) =>
                                      j === i
                                        ? { ...v, [key]: e.target.value }
                                        : v,
                                    ),
                                  )
                                }
                              />
                            </td>
                          ))}
                          <td>
                            {validateAddress(a)
                              .map((value) => tx(value))
                              .join(" · ") || tx("✓ Compleet")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  className="address-primary"
                  disabled={
                    !selected.length ||
                    selected.some((a) => validateAddress(a).length)
                  }
                  onClick={() => setStep(4)}
                >
                  {tx("Ontwerp bekijken →")}{" "}
                </button>
              </div>
            )}
            {step === 4 && (
              <div className="address-layout">
                {designPanel}
                <div className="address-preview-gallery">
                  {selected.slice(0, 12).map((a, i) => (
                    <div className="address-preview-panel" key={i}>
                      <Preview
                        address={a}
                        design={design}
                        logo={logo}
                        drag={busy ? undefined : drag}
                      />
                      <span>
                        {tx("Rij")} {number(a.sourceRow)} ·{" "}
                        {a.name || a.company}
                      </span>
                    </div>
                  ))}
                  <p className="address-muted">
                    {selected.length > 12
                      ? tx("firstLabels", { count: selected.length })
                      : ""}
                    {tx(
                      "Alle geselecteerde etiketten worden opnieuw gecontroleerd vóór verzending.",
                    )}{" "}
                  </p>
                  <button
                    className="address-primary"
                    onClick={() => setStep(5)}
                  >
                    {tx("Naar printopdracht →")}{" "}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </fieldset>
      {(mode === "single" || step === 5) && printPanel}
      {mode === "bulk" && step > 0 && !busy && (
        <button className="address-back" onClick={() => setStep((s) => s - 1)}>
          {tx("← Vorige stap")}{" "}
        </button>
      )}
    </section>
  );
}
function AddressForm({
  address,
  onChange,
}: {
  address: Address;
  onChange: (a: Address) => void;
}) {
  const tx = useT();
  return (
    <div className="address-fields">
      <label>
        {tx("Adrestype")}{" "}
        <select
          value={address.type}
          onChange={(e) => onChange({ ...address, type: e.target.value })}
        >
          <option value="particulier">{tx("Particulier")}</option>
          <option value="zakelijk">{tx("Zakelijk")}</option>
        </select>
      </label>
      {(
        [
          "company",
          "name",
          "street",
          "postal",
          "city",
          "country",
          "extra",
        ] as const
      ).map((key) => (
        <label key={key}>
          {tx(addressFields.find((f) => f.key === key)?.label || key)}
          <input
            value={address[key]}
            onChange={(e) => onChange({ ...address, [key]: e.target.value })}
          />
        </label>
      ))}
    </div>
  );
}
function DataPreview({
  headers,
  data,
}: {
  headers: string[];
  data: string[][];
}) {
  return (
    <div className="address-table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={i}>
              {r.map((v, j) => (
                <td key={j}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
