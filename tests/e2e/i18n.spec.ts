import { expect, test } from "@playwright/test";
import { t, type Language } from "../../src/lib/i18n";
import { mockBluetooth, bluetoothState } from "./helpers/mock-bluetooth";

const languages: [Language, string, string][] = [
  ["nl", "Wat wil je maken?", "Grootte"],
  ["en", "What would you like to create?", "Size"],
  ["de", "Was möchtest du erstellen?", "Größe"],
  ["fr", "Que souhaitez-vous créer ?", "Taille"],
  ["es", "¿Qué quieres crear?", "Tamaño"],
];

for (const [language, welcome, size] of languages) {
  test(`${language}: guest editor, settings, address CSV, calibration and printer help`, async ({
    page,
  }) => {
    const errors: string[] = [];
    const remote: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (/supabase/.test(request.url())) remote.push(request.url());
    });
    await page.addInitScript(
      (language) => localStorage.setItem("label-studio:lang", language),
      language,
    );
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await expect(page.getByText(welcome, { exact: true })).toBeVisible();
    const nav = page.getByRole("navigation", {
      name: t(language, "Hoofdnavigatie"),
    });
    await page
      .getByRole("button", { name: `${t(language, "Tekst")} T`, exact: true })
      .click();
    await expect(page.getByText(size, { exact: true })).toBeVisible();
    const before = await page.evaluate(async () => {
      const { useEditorV2Store } = await import("/src/store/editor-store.ts");
      const s = useEditorV2Store.getState();
      return JSON.stringify({ label: s.label, elements: s.elements });
    });
    await nav
      .getByRole("button", { name: t(language, "settings"), exact: true })
      .click();
    const settings = page.getByRole("dialog", {
      name: t(language, "Label- en printinstellingen"),
    });
    await expect(settings).toBeVisible();
    await settings
      .getByRole("button", { name: t(language, "Instellingen sluiten") })
      .click();
    await nav
      .getByRole("button", { name: t(language, "single"), exact: true })
      .click();
    await page
      .getByRole("textbox", {
        name: t(language, "Naam / contactpersoon"),
        exact: true,
      })
      .fill("Mila User");
    await nav
      .getByRole("button", { name: t(language, "bulk"), exact: true })
      .click();
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles({
        name: "private.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(
          "name;street;postal;city\nMila;Example 1;1234 AB;Utrecht",
        ),
      });
    await page
      .getByRole("button", { name: t(language, "Kolommen koppelen →") })
      .click();
    await expect(
      page.getByLabel(
        t(language, "sourceColumns", {
          field: t(language, "Straat / volledig adres"),
        }),
      ),
    ).toHaveValues(["1"]);
    await page
      .getByRole("button", { name: t(language, "Filters instellen →") })
      .click();
    await page
      .getByRole("button", { name: t(language, "Adressen controleren →") })
      .click();
    await expect(
      page.getByLabel(
        t(language, "rowField", { row: 2, field: t(language, "Postcode") }),
      ),
    ).toHaveValue("1234 AB");
    await page
      .getByRole("button", { name: t(language, "Ontwerp bekijken →") })
      .click();
    await page
      .getByRole("button", { name: t(language, "Naar printopdracht →") })
      .click();
    await page
      .getByRole("button", {
        name: `${t(language, "Print")} 1 ${t(language, "etiketten")}`,
        exact: true,
      })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      t(language, "Verbind eerst een printer via het printermenu."),
    );
    await nav
      .getByRole("button", { name: t(language, "printer"), exact: true })
      .click();
    await page
      .getByRole("button", { name: t(language, "Kalibratie starten") })
      .click();
    const calibration = page.getByRole("dialog", {
      name: t(language, "Printer kalibreren"),
    });
    await expect(
      calibration.getByLabel(t(language, "Testlabel breedte (mm)")),
    ).toBeVisible();
    await calibration
      .getByRole("button", { name: t(language, "Verder naar testlabel") })
      .click();
    await expect(
      calibration.getByRole("button", {
        name: t(language, "Eén testlabel printen"),
      }),
    ).toBeDisabled();
    await calibration
      .getByRole("button", { name: t(language, "Kalibratie sluiten") })
      .click();
    await page
      .getByRole("button", {
        name: t(language, "Printer verbinden"),
        exact: true,
      })
      .click();
    const connection = page.getByRole("dialog", {
      name: t(language, "Printer verbinden"),
      exact: true,
    });
    await expect(
      connection.getByText(t(language, "Voor je begint"), { exact: true }),
    ).toBeVisible();
    await connection
      .getByRole("button", { name: t(language, "Verbindingsvenster sluiten") })
      .click();
    await nav
      .getByRole("button", { name: t(language, "account"), exact: true })
      .click();
    await expect(
      page.getByText(t(language, "cloudNotConfigured")),
    ).toBeVisible();
    expect(remote).toEqual([]);
    const after = await page.evaluate(async () => {
      const { useEditorV2Store } = await import("/src/store/editor-store.ts");
      const s = useEditorV2Store.getState();
      return JSON.stringify({ label: s.label, elements: s.elements });
    });
    expect(after).toBe(before);
    expect(errors).toEqual([]);
  });
}

test("live language changes update dialogs, errors and dates while keeping design, printer and guest preferences", async ({
  page,
}) => {
  await mockBluetooth(page, "cancel");
  await page.goto("/");
  await page.getByRole("button", { name: "Tekst T", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("label-studio.draft.v1")),
    )
    .not.toBeNull();
  const before = await page.evaluate(() =>
    localStorage.getItem("label-studio.draft.v1"),
  );
  await page.getByRole("combobox", { name: "Taal" }).selectOption("de");
  await page.getByRole("button", { name: "Verbinden", exact: true }).click();
  const connection = page.getByRole("dialog", {
    name: "Drucker verbinden",
    exact: true,
  });
  await expect(connection).toBeVisible();
  await page.getByRole("combobox", { name: "Sprache" }).selectOption("fr");
  await expect(
    page.getByRole("dialog", { name: "Connecter l’imprimante", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: t("fr", "Verbindingsvenster sluiten") })
    .click();
  expect((await bluetoothState(page)).calls).toHaveLength(0);
  expect((await bluetoothState(page)).writes).toBe(0);
  expect(
    await page.evaluate(() => localStorage.getItem("label-studio.draft.v1")),
  ).toBe(before);
  await page.reload();
  const draft = page.getByRole("dialog", {
    name: "Brouillon non enregistré trouvé",
  });
  await expect(draft).toBeVisible();
  const date = await page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem("label-studio.draft.v1")!);
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(draft.savedAt);
  });
  await expect(draft).toContainText(date);
  await draft.getByRole("button", { name: "Restaurer le brouillon" }).click();
  await expect(page.getByText("1 éléments", { exact: true })).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: t("fr", "single"), exact: true })
    .click();
  await page
    .getByRole("button", {
      name: `${t("fr", "Print")} 1 ${t("fr", "etiketten")}`,
      exact: true,
    })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    t("fr", "Verbind eerst een printer via het printermenu."),
  );
  await page.getByRole("combobox", { name: "Langue" }).selectOption("es");
  await expect(page.getByRole("alert")).toContainText(
    t("es", "Verbind eerst een printer via het printermenu."),
  );
});

test("unsupported browser/stored language falls back and blocked storage still allows switching", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "language", { value: "ja-JP" });
    localStorage.setItem("label-studio:lang", "invalid");
    Storage.prototype.setItem = () => {
      throw new DOMException("blocked", "SecurityError");
    };
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("combobox", { name: "Language" }).selectOption("es");
  await expect(
    page.getByText("¿Qué quieres crear?", { exact: true }),
  ).toBeVisible();
});

test("translated navigation and calibration stay usable on a phone in all five languages", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  for (const [language] of languages) {
    await page.locator(".studio-language select").selectOption(language);
    const nav = page.getByRole("navigation", {
      name: t(language, "Hoofdnavigatie"),
    });
    await nav
      .getByRole("button", { name: t(language, "printer"), exact: true })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: t(language, "Kalibratie starten") })
      .click();
    const calibration = page.getByRole("dialog", {
      name: t(language, "Printer kalibreren"),
    });
    const bounds = await calibration.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    await calibration
      .getByRole("button", { name: t(language, "Kalibratie sluiten") })
      .click();
  }
});

test("saved headerless CSV mappings remain valid across language changes", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Bulklabels", exact: true }).click();
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "no-headers.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "Mila;Street 1;1234 AB;Utrecht\nOther;Street 2;2345 BC;Rotterdam",
      ),
    });
  await page.getByLabel("Eerste rij bevat kolomnamen").uncheck();
  await page.getByRole("button", { name: "Kolommen koppelen →" }).click();
  for (const [field, column] of [
    ["Naam / contactpersoon", "0"],
    ["Straat / volledig adres", "1"],
    ["Postcode", "2"],
    ["Plaats", "3"],
  ]) {
    await page
      .getByLabel(`Bronkolommen voor ${field}`, { exact: true })
      .selectOption([column]);
  }
  await page
    .getByLabel("Profielnaam", { exact: true })
    .fill("Headerless user profile");
  await page
    .getByRole("button", { name: "Bewaar mapping", exact: true })
    .click();
  const saved = await page.evaluate(() =>
    localStorage.getItem("label-studio-mappings"),
  );
  expect(JSON.parse(saved!)[0].headers).toEqual([
    "Kolom 1",
    "Kolom 2",
    "Kolom 3",
    "Kolom 4",
  ]);
  await page.getByRole("combobox", { name: "Taal" }).selectOption("en");
  await page
    .getByRole("combobox", { name: "Saved mapping", exact: true })
    .selectOption("Headerless user profile");
  await expect(
    page.getByLabel("Source columns for Street / full address", {
      exact: true,
    }),
  ).toHaveValues(["1"]);
  await expect(
    page.getByRole("option", { name: "Column 2 — Street 1" }).first(),
  ).toBeAttached();
  expect(
    await page.evaluate(() => localStorage.getItem("label-studio-mappings")),
  ).toBe(saved);
});
