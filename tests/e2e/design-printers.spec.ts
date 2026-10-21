import { expect, test } from "@playwright/test";

test("design-only printer models keep their label formats selectable", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Hoofdnavigatie" })
    .getByRole("button", { name: "Printer", exact: true })
    .click();
  await page.getByRole("button", { name: /^DYMO LabelWriter 450 USB/ }).click();
  await page
    .getByRole("navigation", { name: "Hoofdnavigatie" })
    .getByRole("button", { name: "Instellingen", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Label- en printinstellingen",
  });
  const format = dialog.getByRole("button", {
    name: "Printerformaat, 57 × 32 mm, los label",
    exact: true,
  });
  await expect(format).toBeEnabled();
  await format.click();
  await expect(format).toHaveAttribute("aria-pressed", "true");
});
