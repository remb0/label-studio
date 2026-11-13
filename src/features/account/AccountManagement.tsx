import { useCallback, useEffect, useState } from "react";
import {
  type UiMessage,
  errorMessage,
  formatDate,
  useLanguage,
  useT,
} from "../../lib/i18n.ts";
import {
  changeCloudPassword,
  deleteCloudAccount,
  exportCloudAccount,
  loadModerationQueue,
  moderate,
  type ModerationQueue,
} from "../../lib/cloud-account.ts";

function useWork() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<UiMessage>("");
  const work = useCallback(async (fn: () => Promise<UiMessage | void>) => {
    setBusy(true);
    setStatus("");
    try {
      const result = await fn();
      if (result) setStatus(result);
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, status, work };
}

/** Password change, data export and account deletion for a signed-in user. */
export function AccountManagement({ onDeleted }: { onDeleted: () => void }) {
  const tx = useT();
  const password = useWork();
  const data = useWork();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  return (
    <>
      <article className="studio-card">
        <h2>{tx("Wachtwoord wijzigen")}</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void password.work(async () => {
              if (next !== repeat)
                throw new Error("De wachtwoorden zijn niet gelijk.");
              await changeCloudPassword(current, next);
              setCurrent("");
              setNext("");
              setRepeat("");
              return "Wachtwoord gewijzigd. Andere apparaten zijn afgemeld.";
            });
          }}
        >
          <input
            aria-label={tx("Huidig wachtwoord")}
            placeholder={tx("Huidig wachtwoord")}
            className="studio-field"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
          <input
            aria-label={tx("Nieuw wachtwoord")}
            placeholder={tx("Nieuw wachtwoord")}
            className="studio-field"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={next}
            onChange={(event) => setNext(event.target.value)}
          />
          <input
            aria-label={tx("Herhaal nieuw wachtwoord")}
            placeholder={tx("Herhaal nieuw wachtwoord")}
            className="studio-field"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={repeat}
            onChange={(event) => setRepeat(event.target.value)}
          />
          <button
            className="studio-primary"
            type="submit"
            disabled={password.busy}
          >
            {tx("Wachtwoord opslaan")}
          </button>
        </form>
        {password.status && (
          <p role="status" className="mt-3">
            {tx(password.status)}
          </p>
        )}
      </article>

      <article className="studio-card">
        <h2>{tx("Je gegevens")}</h2>
        <p>
          {tx(
            "Download alles wat je account bewaart, of verwijder je account definitief. Labels in deze browser blijven staan.",
          )}
        </p>
        <button
          className="studio-secondary"
          disabled={data.busy}
          onClick={() =>
            void data.work(async () => {
              await exportCloudAccount();
              return "Export gedownload.";
            })
          }
        >
          {tx("Gegevens exporteren")}
        </button>
        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (
              !window.confirm(
                tx(
                  "Je account, opgeslagen labels, instellingen en printerrapporten worden definitief verwijderd. Dit kan niet ongedaan worden gemaakt. Doorgaan?",
                ),
              )
            )
              return;
            void data.work(async () => {
              await deleteCloudAccount(deletePassword);
              setDeletePassword("");
              onDeleted();
            });
          }}
        >
          <input
            aria-label={tx("Wachtwoord ter bevestiging")}
            placeholder={tx("Wachtwoord ter bevestiging")}
            className="studio-field"
            type="password"
            autoComplete="current-password"
            required
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
          />
          <button
            className="studio-secondary"
            type="submit"
            disabled={data.busy}
          >
            {tx("Account verwijderen")}
          </button>
        </form>
        {data.status && (
          <p role="status" className="mt-3">
            {tx(data.status)}
          </p>
        )}
      </article>
    </>
  );
}

const REPORT_FIELDS = [
  "model_id",
  "result",
  "browser",
  "operating_system",
  "firmware",
  "app_version",
  "notes",
] as const;
const PROPOSAL_FIELDS = [
  "brand",
  "model",
  "connection_type",
  "bluetooth_name",
  "max_width_mm",
  "dpi",
  "media",
  "product_url",
  "test_result",
  "observations",
] as const;

const FIELD_LABELS: Record<string, string> = {
  model_id: "Model",
  result: "Resultaat",
  browser: "Browser",
  operating_system: "Besturingssysteem",
  firmware: "Firmware",
  app_version: "Appversie",
  notes: "Notities",
  brand: "Merk",
  model: "Model",
  connection_type: "Verbinding",
  bluetooth_name: "Bluetooth-naam",
  max_width_mm: "Max. breedte (mm)",
  dpi: "Resolutie (dpi)",
  media: "Media",
  product_url: "Productlink",
  test_result: "Testresultaat",
  observations: "Waarnemingen",
};

/** Review queue for community printer reports and model proposals. */
export function ModerationPanel() {
  const tx = useT();
  const language = useLanguage((state) => state.language);
  const { busy, status, work } = useWork();
  const [queue, setQueue] = useState<ModerationQueue | null>(null);

  const refresh = useCallback(
    () =>
      work(async () => {
        setQueue(await loadModerationQueue());
      }),
    [work],
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const decide = (
    kind: "report" | "proposal",
    id: string,
    decision: "approved" | "rejected",
  ) =>
    void work(async () => {
      await moderate(kind, id, decision);
      setQueue(await loadModerationQueue());
      return decision === "approved" ? "Goedgekeurd." : "Afgewezen.";
    });

  const section = (
    kind: "report" | "proposal",
    title: string,
    items: ModerationQueue["reports"],
    fields: readonly string[],
  ) => (
    <>
      <h3 className="mt-4">
        {tx(title)} ({items.length})
      </h3>
      {!items.length && <p>{tx("Niets te beoordelen.")}</p>}
      {items.map((item) => (
        <div
          key={item.id}
          className="studio-moderation-item"
          data-testid={`moderation-${kind}`}
        >
          <dl>
            {fields
              .filter((field) => item[field] !== null && item[field] !== "")
              .map((field) => (
                <div key={field}>
                  <dt>{tx(FIELD_LABELS[field] ?? field)}</dt>
                  <dd>{String(item[field])}</dd>
                </div>
              ))}
            <div>
              <dt>{tx("Ingediend")}</dt>
              <dd>{formatDate(language, String(item.created_at))}</dd>
            </div>
          </dl>
          <div className="flex gap-2">
            <button
              className="studio-primary"
              disabled={busy}
              onClick={() => decide(kind, item.id, "approved")}
            >
              {tx("Goedkeuren")}
            </button>
            <button
              className="studio-secondary"
              disabled={busy}
              onClick={() => decide(kind, item.id, "rejected")}
            >
              {tx("Afwijzen")}
            </button>
          </div>
        </div>
      ))}
    </>
  );

  return (
    <article className="studio-card">
      <h2>{tx("Moderatie")}</h2>
      <p>
        {tx(
          "Alleen goedgekeurde rapporten tellen mee in het openbare compatibiliteitsoverzicht. Voorstellen activeren nooit drivercode.",
        )}
      </p>
      <button
        className="studio-secondary"
        disabled={busy}
        onClick={() => void refresh()}
      >
        {tx("Vernieuwen")}
      </button>
      {queue &&
        section("report", "Printerrapporten", queue.reports, REPORT_FIELDS)}
      {queue &&
        section(
          "proposal",
          "Modelvoorstellen",
          queue.proposals,
          PROPOSAL_FIELDS,
        )}
      {status && (
        <p role="status" className="mt-3">
          {tx(status)}
        </p>
      )}
    </article>
  );
}
