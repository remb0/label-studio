import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Route,
} from "@playwright/test";

// Runs against the second dev server that has the account API enabled.
test.use({ baseURL: "http://127.0.0.1:4174" });
test.skip(
  !!process.env.PRODUCTION_URL,
  "needs the dev server with the account API enabled",
);

type Row = { changedAt: number; payload: unknown };
type FakeAccount = {
  email: string;
  password: string;
  id: string;
  labels: Map<string, Row>;
  settings: { payload: unknown; revision: number } | null;
  sessions: Set<string>;
};

/** In-memory stand-in for server/app.mjs with the same merge rules. */
class FakeAccountApi {
  accounts = new Map<string, FakeAccount>();
  reports = [
    {
      id: "report-1",
      model_id: "p15",
      result: "works",
      browser: "Chrome",
      operating_system: "macOS",
      app_version: "test",
      created_at: "2026-11-01T10:00:00.000Z",
    },
  ];
  private clock = 1_000;
  private sessionOf = new Map<string, string>(); // device -> email

  async attach(context: BrowserContext, device: string) {
    await context.route("**/api/**", (route) => this.handle(route, device));
  }

  private user(device: string) {
    const email = this.sessionOf.get(device);
    const account = email ? this.accounts.get(email) : undefined;
    return account?.sessions.has(device) ? account : null;
  }

  private publicUser(account: FakeAccount) {
    return {
      id: account.id,
      email: account.email,
      is_admin: account.email.startsWith("admin@"),
    };
  }

  private state(account: FakeAccount, since: number | null) {
    return {
      labels: [...account.labels.entries()]
        .filter(([, row]) => since === null || row.changedAt >= 0)
        .map(([id, row]) => ({ id, ...row })),
      settings: account.settings,
      cursor: ++this.clock,
      synced_at: new Date(
        Date.UTC(2026, 10, 13, 9, 0, this.clock % 60),
      ).toISOString(),
    };
  }

  private async handle(route: Route, device: string) {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, "");
    const body = request.postData() ? JSON.parse(request.postData()!) : {};
    const reply = (status: number, json: unknown) =>
      route.fulfill({ status, contentType: "application/json", json });
    const account = this.user(device);

    if (path === "/auth/session")
      return account
        ? reply(200, { user: this.publicUser(account) })
        : reply(401, { error: "Geen actieve sessie." });
    if (path === "/auth/register") {
      const created: FakeAccount = {
        email: body.email,
        password: body.password,
        id: `user-${this.accounts.size + 1}`,
        labels: new Map(),
        settings: null,
        sessions: new Set([device]),
      };
      this.accounts.set(body.email, created);
      this.sessionOf.set(device, body.email);
      return reply(201, { user: this.publicUser(created) });
    }
    if (path === "/auth/login") {
      const found = this.accounts.get(body.email);
      if (!found || found.password !== body.password)
        return reply(401, { error: "E-mailadres of wachtwoord is onjuist." });
      found.sessions.add(device);
      this.sessionOf.set(device, body.email);
      return reply(200, { user: this.publicUser(found) });
    }
    if (path === "/auth/logout") {
      account?.sessions.delete(device);
      return reply(200, { logged_out: true });
    }
    if (!account) return reply(401, { error: "Log eerst in." });

    if (path === "/account/sync") {
      for (const label of body.labels ?? []) {
        const existing = account.labels.get(label.id);
        if (!existing || label.updatedAt > existing.changedAt)
          account.labels.set(label.id, {
            changedAt: label.updatedAt,
            payload: label,
          });
      }
      for (const [id, at] of Object.entries(body.deleted ?? {}) as [
        string,
        number,
      ][]) {
        const existing = account.labels.get(id);
        if (!existing || at >= existing.changedAt)
          account.labels.set(id, { changedAt: at, payload: null });
      }
      let conflict = false;
      if (body.settings) {
        const current = account.settings?.revision ?? null;
        if (current !== null && body.settings.base_revision !== current)
          conflict = true;
        else
          account.settings = {
            payload: body.settings.payload,
            revision: (current ?? 0) + 1,
          };
      }
      return reply(200, {
        ...this.state(account, body.since ?? null),
        settings_conflict: conflict,
      });
    }
    if (path === "/auth/password/change") {
      if (body.current_password !== account.password)
        return reply(403, { error: "Het huidige wachtwoord is onjuist." });
      account.password = body.password;
      account.sessions = new Set([device]);
      return reply(200, { updated: true });
    }
    if (path === "/account/export")
      return reply(200, {
        format: "label-studio-account-export",
        labels: [...account.labels.values()]
          .filter((row) => row.payload)
          .map((row) => row.payload),
      });
    if (path === "/account/delete") {
      if (body.password !== account.password)
        return reply(403, { error: "Het huidige wachtwoord is onjuist." });
      this.accounts.delete(account.email);
      return reply(200, { deleted: true });
    }
    if (path === "/admin/moderation" && request.method() === "GET")
      return reply(200, { reports: this.reports, proposals: [] });
    if (path === "/admin/moderation") {
      this.reports = this.reports.filter((report) => report.id !== body.id);
      return reply(200, { moderation_status: body.status });
    }
    return reply(404, { error: "Niet gevonden." });
  }
}

const seedLabel = (id: string, name: string, updatedAt: number) => ({
  id,
  name,
  label: { widthMm: 40, heightMm: 30, dpi: 203 },
  elements: [],
  createdAt: updatedAt,
  updatedAt,
});

async function device(
  browser: import("@playwright/test").Browser,
  api: FakeAccountApi,
  name: string,
  seed: { labels: ReturnType<typeof seedLabel>[]; theme?: string },
) {
  const context = await browser.newContext();
  await api.attach(context, name);
  await context.addInitScript((data) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem(
      "thermoprint.library.v1",
      JSON.stringify({ labels: data.labels, recent: [], currentLabelId: null }),
    );
    if (data.theme) localStorage.setItem("tp.theme.v1", data.theme);
  }, seed);
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Account", exact: true }).click();
  return { context, page };
}

const libraryNames = (page: Page) =>
  page.evaluate(() =>
    (
      JSON.parse(localStorage.getItem("thermoprint.library.v1") || "{}")
        .labels ?? []
    )
      .map((label: { name: string }) => label.name)
      .sort(),
  );

async function signIn(page: Page, email: string, register: boolean) {
  if (register)
    await page
      .getByRole("button", { name: "Account maken", exact: true })
      .click();
  await page.getByRole("textbox", { name: "E-mailadres" }).fill(email);
  await page.getByLabel("Wachtwoord", { exact: true }).fill("safe-password");
  if (register)
    await page.getByLabel("Herhaal wachtwoord").fill("safe-password");
  await page
    .getByRole("button", {
      name: register ? "Registreren" : "Aanmelden",
      exact: true,
    })
    .last()
    .click();
}

test("labels and preferences follow the account between two devices", async ({
  browser,
}) => {
  const api = new FakeAccountApi();
  const a = await device(browser, api, "A", {
    labels: [seedLabel("label-a", "Van apparaat A", 1000)],
    theme: "amber",
  });
  await signIn(a.page, "user@example.nl", true);
  await expect(a.page.getByText(/Laatst gesynchroniseerd/)).toBeVisible();
  expect(api.accounts.get("user@example.nl")!.labels.has("label-a")).toBe(true);

  const b = await device(browser, api, "B", {
    labels: [seedLabel("label-b", "Van apparaat B", 2000)],
  });
  await signIn(b.page, "user@example.nl", false);
  await expect(b.page.getByText(/Laatst gesynchroniseerd/)).toBeVisible();
  // B keeps its own label, receives A's label and adopts the account theme.
  await expect
    .poll(() => libraryNames(b.page))
    .toEqual(["Van apparaat A", "Van apparaat B"]);
  expect(await b.page.evaluate(() => localStorage.getItem("tp.theme.v1"))).toBe(
    "amber",
  );

  // A pulls B's label with a manual sync.
  await a.page.getByRole("button", { name: "Nu synchroniseren" }).click();
  await expect
    .poll(() => libraryNames(a.page))
    .toEqual(["Van apparaat A", "Van apparaat B"]);

  // Password change signs the other device out.
  await a.page.getByLabel("Huidig wachtwoord").fill("safe-password");
  await a.page
    .getByLabel("Nieuw wachtwoord", { exact: true })
    .fill("new-password-1");
  await a.page.getByLabel("Herhaal nieuw wachtwoord").fill("new-password-1");
  await a.page.getByRole("button", { name: "Wachtwoord opslaan" }).click();
  await expect(
    a.page.getByText("Wachtwoord gewijzigd. Andere apparaten zijn afgemeld."),
  ).toBeVisible();
  expect([...api.accounts.get("user@example.nl")!.sessions]).toEqual(["A"]);

  const download = a.page.waitForEvent("download");
  await a.page.getByRole("button", { name: "Gegevens exporteren" }).click();
  expect((await download).suggestedFilename()).toMatch(
    /^label-studio-account-\d{4}-\d{2}-\d{2}\.json$/,
  );

  a.page.once("dialog", (dialog) => void dialog.accept());
  await a.page.getByLabel("Wachtwoord ter bevestiging").fill("new-password-1");
  await a.page.getByRole("button", { name: "Account verwijderen" }).click();
  await expect(
    a.page.getByText("Je account en alle accountgegevens zijn verwijderd."),
  ).toBeVisible();
  expect(api.accounts.has("user@example.nl")).toBe(false);
  // Local labels stay in the browser.
  expect(await libraryNames(a.page)).toEqual([
    "Van apparaat A",
    "Van apparaat B",
  ]);
  await a.context.close();
  await b.context.close();
});

test("administrators can moderate printer reports", async ({ browser }) => {
  const api = new FakeAccountApi();
  const admin = await device(browser, api, "admin", { labels: [] });
  await signIn(admin.page, "admin@example.nl", true);
  const item = admin.page.getByTestId("moderation-report");
  await expect(item).toHaveCount(1);
  await expect(item).toContainText("p15");
  await item.getByRole("button", { name: "Goedkeuren" }).click();
  await expect(item).toHaveCount(0);
  await expect(admin.page.getByText("Goedgekeurd.")).toBeVisible();
  await admin.context.close();
});
