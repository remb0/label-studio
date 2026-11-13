import {
  type UiMessage,
  errorMessage,
  useT,
  useLanguage,
  t,
  message,
  formatDate,
} from "../../lib/i18n.ts";
import { useEffect, useState } from "react";
import {
  cloudConfigured,
  restoreCloudSession,
  registerCloudAccount,
  loginCloudAccount,
  requestPasswordReset,
  updateCloudPassword,
  uploadCloudData,
  downloadCloudData,
  syncCloudData,
  syncAfterSignIn,
  logoutCloud,
  useAccountSync,
  type CloudSession,
  type SyncResult,
} from "../../lib/cloud-account.ts";
import { AccountManagement, ModerationPanel } from "./AccountManagement.tsx";

function syncMessage(key: string, result: SyncResult): UiMessage {
  const main = message(key, { count: result.labels });
  return result.skipped
    ? {
        key: "",
        items: [main, message("accountSkipped", { count: result.skipped })],
      }
    : main;
}

type AccountMode = "login" | "register" | "forgot" | "recovery";

function recoveryFromUrl(): boolean {
  const url = new URL(window.location.href);
  return Boolean(url.searchParams.get("reset_token"));
}

export function AccountPage() {
  const tx = useT();
  const language = useLanguage((state) => state.language);
  const [session, setSession] = useState<CloudSession | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState<AccountMode>(() =>
    recoveryFromUrl() ? "recovery" : "login",
  );
  const [status, setStatus] = useState<UiMessage>("");
  const [busy, setBusy] = useState(false);
  const autoSync = useAccountSync((state) => state.autoSync);
  const setAutoSync = useAccountSync((state) => state.setAutoSync);
  const syncing = useAccountSync((state) => state.status === "syncing");

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const recovered = recoveryFromUrl();
        const found = await restoreCloudSession();
        if (!alive) return;
        setSession(found);
        if (recovered && found) setMode("recovery");
      } catch (error) {
        if (alive) setStatus(errorMessage(error));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function work(fn: () => Promise<void>) {
    setBusy(true);
    setStatus("");
    try {
      await fn();
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const authForm = () => {
    if (!cloudConfigured) return <p>{t(language, "cloudNotConfigured")}</p>;

    if (mode === "forgot") {
      return (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void work(async () => {
              await requestPasswordReset(email);
              setStatus("Herstellink verstuurd. Controleer je e-mail.");
            });
          }}
        >
          <p>{tx("Vul je e-mailadres in om een herstellink te ontvangen.")}</p>
          <label htmlFor="account-email-reset" className="block my-3 text-sm">
            {tx("E-mailadres")}
          </label>
          <input
            id="account-email-reset"
            className="studio-field"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button disabled={busy} className="studio-primary" type="submit">
            {tx("Herstellink versturen")}
          </button>
          <button
            className="studio-secondary ml-2"
            type="button"
            onClick={() => setMode("login")}
          >
            {tx("Terug naar aanmelden")}
          </button>
        </form>
      );
    }

    if (mode === "recovery") {
      return (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void work(async () => {
              if (password !== confirmPassword)
                throw new Error("De wachtwoorden zijn niet gelijk.");
              const url = new URL(window.location.href);
              await updateCloudPassword(
                password,
                url.searchParams.get("reset_token") || "",
              );
              url.searchParams.delete("reset_token");
              window.history.replaceState(null, "", url.pathname + url.search);
              setPassword("");
              setConfirmPassword("");
              setMode("login");
              setStatus("Je wachtwoord is gewijzigd.");
            });
          }}
        >
          <p>{tx("Kies een nieuw wachtwoord van minimaal 8 tekens.")}</p>
          <input
            aria-label={tx("Nieuw wachtwoord")}
            className="studio-field"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <input
            aria-label={tx("Herhaal nieuw wachtwoord")}
            className="studio-field"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          <button disabled={busy} className="studio-primary" type="submit">
            {tx("Wachtwoord opslaan")}
          </button>
        </form>
      );
    }

    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void work(async () => {
            if (mode === "register") {
              if (password !== confirmPassword)
                throw new Error("De wachtwoorden zijn niet gelijk.");
              const found = await registerCloudAccount(email, password);
              setSession(found);
              setStatus("Account aangemaakt en aangemeld.");
              await syncAfterSignIn().catch(() => undefined);
            } else {
              setSession(await loginCloudAccount(email, password));
              setStatus(
                "Aangemeld. Je kunt nu je persoonlijke gegevens synchroniseren.",
              );
              if (useAccountSync.getState().autoSync)
                await syncAfterSignIn().catch(() => undefined);
            }
          });
        }}
      >
        <div className="flex gap-2 mb-4">
          <button
            className={mode === "login" ? "studio-primary" : "studio-secondary"}
            type="button"
            onClick={() => setMode("login")}
          >
            {tx("Aanmelden")}
          </button>
          <button
            className={
              mode === "register" ? "studio-primary" : "studio-secondary"
            }
            type="button"
            onClick={() => setMode("register")}
          >
            {tx("Account maken")}
          </button>
        </div>
        <label htmlFor="account-email" className="block my-3 text-sm">
          {tx("E-mailadres")}
        </label>
        <input
          id="account-email"
          className="studio-field"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label htmlFor="account-password" className="block my-3 text-sm">
          {tx("Wachtwoord")}
        </label>
        <input
          id="account-password"
          className="studio-field"
          type="password"
          autoComplete={
            mode === "register" ? "new-password" : "current-password"
          }
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {mode === "register" && (
          <input
            aria-label={tx("Herhaal wachtwoord")}
            className="studio-field"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        )}
        <button disabled={busy} className="studio-primary" type="submit">
          {mode === "register" ? tx("Registreren") : tx("Aanmelden")}
        </button>
        {mode === "login" && (
          <button
            className="studio-secondary ml-2"
            type="button"
            onClick={() => setMode("forgot")}
          >
            {tx("Wachtwoord vergeten")}
          </button>
        )}
      </form>
    );
  };

  return (
    <section className="studio-page">
      <div className="studio-page-title">
        <span className="studio-eyebrow">{tx("PERSOONLIJKE OPSLAG")}</span>
        <h1>{tx("Account")}</h1>
        <p>
          {tx(
            "Bewaar je labels, sjablonen en persoonlijke instellingen bij je eigen account.",
          )}
        </p>
      </div>
      <div className="studio-cards">
        <article className="studio-card">
          <h2>
            {session
              ? `${tx("Aangemeld als")} ${session.user.email || "—"}`
              : tx("Aanmelden of registreren")}
          </h2>
          {session ? (
            <button
              className="studio-secondary"
              disabled={busy}
              onClick={() =>
                void work(async () => {
                  await logoutCloud();
                  setSession(null);
                })
              }
            >
              {tx("Afmelden")}
            </button>
          ) : (
            authForm()
          )}
          {status && (
            <p role="status" className="mt-3">
              {tx(status)}
            </p>
          )}
        </article>
        {session && (
          <article className="studio-card">
            <h2>{tx("Persoonlijke gegevens")}</h2>
            <p>
              {tx(
                "Bewaar labels, sjablonen, favorieten, mappingprofielen, voorkeuren en printerinstellingen per model in je account. Labels worden samengevoegd: de nieuwste versie wint en verwijderde labels blijven verwijderd.",
              )}
            </p>
            <SyncStatus />
            <label className="flex items-center gap-2 my-3 text-sm">
              <input
                type="checkbox"
                checked={autoSync}
                onChange={(event) => setAutoSync(event.target.checked)}
              />
              {tx("Automatisch synchroniseren op dit apparaat")}
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                className="studio-primary"
                disabled={busy || syncing}
                onClick={() =>
                  void work(async () => {
                    setStatus(
                      syncMessage("accountSynced", await syncCloudData("auto")),
                    );
                  })
                }
              >
                {tx("Nu synchroniseren")}
              </button>
              <button
                className="studio-secondary"
                disabled={busy || syncing}
                onClick={() =>
                  void work(async () => {
                    setStatus(
                      syncMessage("accountSaved", await uploadCloudData()),
                    );
                  })
                }
              >
                {tx("Opslaan in account")}
              </button>
              <button
                className="studio-secondary"
                disabled={busy || syncing}
                onClick={() => {
                  if (
                    window.confirm(
                      tx(
                        "Accountgegevens laden voegt labels samen en vervangt je voorkeuren en instellingen op dit apparaat. Wil je doorgaan?",
                      ),
                    )
                  )
                    void work(async () => {
                      const found = await downloadCloudData();
                      setStatus(
                        found
                          ? syncMessage("accountLoaded", found)
                          : "Er zijn nog geen accountgegevens opgeslagen.",
                      );
                    });
                }}
              >
                {tx("Laden uit account")}
              </button>
            </div>
          </article>
        )}
        {session && (
          <AccountManagement
            onDeleted={() => {
              setSession(null);
              setStatus("Je account en alle accountgegevens zijn verwijderd.");
            }}
          />
        )}
        {session?.user.isAdmin && <ModerationPanel />}
        <article className="studio-card">
          <h2>{tx("Gastmodus blijft beschikbaar")}</h2>
          <p>
            {tx(
              "Zonder account blijven labels en instellingen uitsluitend in deze browser. Bluetoothtoestemmingen, printer-ID's, CSV-rijen en actieve printopdrachten worden nooit naar het account gestuurd.",
            )}
          </p>
        </article>
      </div>
    </section>
  );
}

function SyncStatus() {
  const tx = useT();
  const language = useLanguage((state) => state.language);
  const { status, error, lastSyncedAt } = useAccountSync();
  if (status === "syncing")
    return <p role="status">{tx("Bezig met synchroniseren…")}</p>;
  if (status === "error")
    return (
      <p role="alert">
        {tx("Synchroniseren mislukt")}: {tx(error)}
      </p>
    );
  return (
    <p>
      {lastSyncedAt
        ? tx(
            message("lastSyncedAt", {
              time: formatDate(language, lastSyncedAt),
            }),
          )
        : tx("Nog niet gesynchroniseerd op dit apparaat.")}
    </p>
  );
}
