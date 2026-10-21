import { test, expect } from "@playwright/test";

test("format favorites reorder without changing format and survive reload", async ({
  page,
}) => {
  await page.goto("/");
  const openSettings = async () =>
    page
      .getByRole("navigation", { name: "Hoofdnavigatie" })
      .getByRole("button", { name: "Instellingen", exact: true })
      .click();
  await openSettings();
  await page.getByRole("button", { name: /^Mini, / }).click();
  const current = page
    .getByRole("button", { pressed: true })
    .filter({ hasText: /mm/ });
  const initial = await current.first().getAttribute("aria-label");
  await page
    .getByRole("button", {
      name: "Formaat Rond aan favorieten toevoegen",
      exact: true,
    })
    .click();
  await expect(page.locator("[data-format-card]").first()).toHaveAttribute(
    "data-format-card",
    "round",
  );
  expect(await current.first().getAttribute("aria-label")).toBe(initial);
  await page.reload();
  await page
    .getByRole("button", { name: "Concept herstellen", exact: true })
    .click();
  await openSettings();
  await expect(page.locator("[data-format-card]").first()).toHaveAttribute(
    "data-format-card",
    "round",
  );
  await expect(
    page.getByRole("button", {
      name: "Formaat Rond uit favorieten verwijderen",
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Formaat Rond uit favorieten verwijderen" })
    .click();
  await expect(page.locator("[data-format-card]").first()).toHaveAttribute(
    "data-format-card",
    "mini",
  );
});

test("starter and saved favorites stay in their groups and do not open artwork", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tekst T", exact: true }).click();
  await page.keyboard.press("ControlOrMeta+s");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem("thermoprint.library.v1") ?? '{"labels":[]}',
          ).labels.length,
      ),
    )
    .toBe(1);
  const openGallery = async () =>
    page
      .getByRole("navigation", { name: "Hoofdnavigatie" })
      .getByRole("button", { name: "Sjablonen", exact: true })
      .click();
  await openGallery();
  await page
    .getByRole("button", {
      name: "Gebruik sjabloon Product & prijs",
      exact: true,
    })
    .click();
  await page.keyboard.press("ControlOrMeta+s");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem("thermoprint.library.v1") ?? '{"labels":[]}',
          ).labels.length,
      ),
    )
    .toBe(2);
  await openGallery();
  await page
    .getByRole("button", {
      name: "Sjabloon Rond datumlabel aan favorieten toevoegen",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog", { name: "Sjablonen" })).toBeVisible();
  await expect(
    page
      .locator("[data-starter-card]")
      .first()
      .getByRole("button", { name: "Gebruik sjabloon Rond datumlabel" }),
  ).toBeVisible();
  const saved = page.getByRole("region", { name: "Mijn sjablonen" });
  await expect(
    saved.locator("[data-saved-card]").first().getByRole("button", {
      name: "Open sjabloon Product & prijs",
      exact: true,
    }),
  ).toBeVisible();
  await saved
    .getByRole("button", {
      name: "Eigen sjabloon Nieuw label aan favorieten toevoegen",
      exact: true,
    })
    .click();
  await expect(
    saved
      .locator("[data-saved-card]")
      .first()
      .getByRole("button", { name: "Open sjabloon Nieuw label", exact: true }),
  ).toBeVisible();
  await expect(
    saved.getByRole("button", {
      name: /Eigen sjabloon .* uit favorieten verwijderen/,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await openGallery();
  await expect(
    page
      .locator("[data-starter-card]")
      .first()
      .getByRole("button", { name: "Gebruik sjabloon Rond datumlabel" }),
  ).toBeVisible();
  await expect(
    saved.getByRole("button", {
      name: /Eigen sjabloon .* uit favorieten verwijderen/,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByPlaceholder("Zoek sjablonen...")
    .fill("niet-bestaand-ontwerp");
  await expect(
    page.getByText("Geen resultaten", { exact: true }),
  ).toBeVisible();
});
