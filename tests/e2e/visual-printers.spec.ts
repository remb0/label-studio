import { test, expect } from "@playwright/test";

test("visual printer choice is remembered without claiming a connection", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tekst T", exact: true }).click();
  await page.keyboard.press("ControlOrMeta+s");
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("thermoprint.library.v1")),
    )
    .not.toBeNull();
  const before = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("thermoprint.library.v1")!)
      .labels[0];
    return { elements: saved.elements, label: saved.label };
  });
  const navigation = page.getByRole("navigation", { name: "Hoofdnavigatie" });
  await navigation
    .getByRole("button", { name: "Printer", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Kies merk Marklife", exact: true })
    .click();
  await page.getByRole("button", { name: /Marklife P15/ }).click();
  await page
    .getByRole("button", { name: "Gebruik dit printerprofiel" })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem("label-studio:preferred-printer:v1"),
      ),
    )
    .toBe("p15");
  await expect(
    page.getByRole("button", { name: "Printer verbinden", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Ontwerppreset: 40 × 12 mm/)).toBeVisible();
  await page.getByRole("button", { name: "Andere printer kiezen" }).click();
  await page
    .getByRole("button", { name: "Kies merk LuckP", exact: true })
    .click();
  await page.getByRole("button", { name: /LuckP D1S/ }).click();
  await page
    .getByRole("button", { name: "Gebruik dit printerprofiel" })
    .click();
  await navigation
    .getByRole("button", { name: "Ontwerpen", exact: true })
    .click();
  await page.keyboard.press("ControlOrMeta+s");
  const after = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("thermoprint.library.v1")!)
      .labels[0];
    return { elements: saved.elements, label: saved.label };
  });
  expect(after).toEqual(before);
  await navigation
    .getByRole("button", { name: "Printer", exact: true })
    .click();
  await expect(page.getByText(/Ontwerppreset: 48 × 30 mm/)).toBeVisible();
  await page.reload();
  await navigation
    .getByRole("button", { name: "Printer", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Printerkeuze bewaard" }),
  ).toBeVisible();
  await expect(page.getByText(/Ontwerppreset: 48 × 30 mm/)).toBeVisible();
  await page.getByRole("button", { name: "Andere printer kiezen" }).click();
  await page.getByRole("button", { name: /Automatisch herkennen/ }).click();
  await page
    .getByRole("button", { name: "Gebruik dit printerprofiel" })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem("label-studio:preferred-printer:v1"),
      ),
    )
    .toBe("");
});

test("printer model modal remains scrollable on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Hoofdnavigatie" })
    .getByRole("button", { name: "Printer", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Printer verbinden", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Printer verbinden",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Kies merk LuckP", exact: true })
    .click();
  await dialog.getByRole("button", { name: /LuckP D1S/ }).click();
  await dialog
    .getByRole("button", { name: "Gebruik dit printerprofiel" })
    .click();
  const scan = dialog.getByRole("button", {
    name: "Printer zoeken",
    exact: true,
  });
  await scan.scrollIntoViewIfNeeded();
  const bounds = await scan.boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  const dialogBounds = await dialog.boundingBox();
  expect(dialogBounds!.width).toBeLessThanOrEqual(390);
  expect(dialogBounds!.height).toBeLessThanOrEqual(812);
  await dialog.getByRole("button", { name: "Annuleren", exact: true }).click();
  await expect(dialog).not.toBeVisible();
});
