import { test, expect } from "@playwright/test";

test("built-in templates create independent editable copies and preserve saved originals", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tekst T", exact: true }).click();
  await page.keyboard.press("ControlOrMeta+s");
  const library = () =>
    page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem("thermoprint.library.v1") || '{"labels":[]}',
        ).labels,
    );
  await expect.poll(async () => (await library()).length).toBe(1);
  const original = (await library())[0];
  const navigation = page.getByRole("navigation", { name: "Hoofdnavigatie" });
  await navigation
    .getByRole("button", { name: "Sjablonen", exact: true })
    .click();
  const starters = page.getByRole("region", { name: "Start met een sjabloon" });
  await expect(
    starters.getByRole("button", { name: /^Gebruik sjabloon/ }),
  ).toHaveCount(8);
  await starters
    .getByRole("button", { name: "Gebruik sjabloon Product & prijs" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Sjablonen" }),
  ).not.toBeVisible();
  await expect(page.getByText("4 elementen", { exact: true })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+s");
  await expect.poll(async () => (await library()).length).toBe(2);
  const updated = await library();
  expect(
    updated.find((item: { id: string }) => item.id === original.id),
  ).toEqual(original);
  expect(
    updated.find((item: { name: string }) => item.name === "Product & prijs"),
  ).toMatchObject({
    label: { widthMm: 48, heightMm: 35, dpi: 203 },
    settings: { rollDirection: "vertical" },
  });
});

test("canceling a starter template keeps unsaved artwork", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tekst T", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Hoofdnavigatie" })
    .getByRole("button", { name: "Sjablonen", exact: true })
    .click();
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("niet-opgeslagen wijzigingen");
    await dialog.dismiss();
  });
  await page
    .getByRole("button", { name: "Gebruik sjabloon Adres", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "Sjablonen" })).toBeVisible();
  await expect(page.getByText("1 elementen", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Gebruik sjabloon Adres", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Sjablonen" }),
  ).not.toBeVisible();
  await expect(page.getByText("2 elementen", { exact: true })).toBeVisible();
});
