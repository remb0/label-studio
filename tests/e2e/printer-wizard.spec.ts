import { test, expect } from "@playwright/test";

test("wizard starts with brands, caps results and only expands on request", async ({
  page,
}) => {
  if (process.env.UPDATE_DOC_SCREENSHOTS) {
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Printer", exact: true }).click();
  const picker = page.getByRole("region", { name: "Printermodel kiezen" });
  await expect(picker.locator("[data-printer-result]")).toHaveCount(0);
  await expect(picker.locator("img")).toHaveCount(3);
  await expect
    .poll(() =>
      picker
        .locator("img")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  if (process.env.UPDATE_DOC_SCREENSHOTS) {
    await page.screenshot({ path: "docs/images/printers.png" });
  }
  await picker.getByRole("button", { name: "Kies merk DYMO" }).click();
  await expect(picker.locator("[data-printer-result]")).toHaveCount(4);
  await expect(picker.getByRole("status")).toHaveText(
    "4 van 8 passende modellen",
  );
  await picker
    .getByRole("button", { name: "Alles tonen (8)", exact: true })
    .click();
  await expect(picker.locator("[data-printer-result]")).toHaveCount(8);
  await picker.getByLabel("Zoek printermodel of Bluetoothnaam").fill("5XL");
  await expect(picker.locator("[data-printer-result]")).toHaveCount(1);
  await picker.getByLabel("Resolutie", { exact: true }).selectOption("203");
  await expect(picker.getByRole("status")).toContainText("Geen passend model");
  await picker.getByRole("button", { name: "Filters wissen" }).click();
  await expect(picker.locator("[data-printer-result]")).toHaveCount(4);
  await picker.getByLabel("Zoek printermodel of Bluetoothnaam").fill("LP90");
  await picker.getByRole("button", { name: /Marklife P12/ }).click();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("label-studio:preferred-printer:v1"),
    ),
  ).toBeNull();
  await picker
    .getByRole("button", { name: "Gebruik dit printerprofiel" })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem("label-studio:preferred-printer:v1"),
      ),
    )
    .toBe("p12");
});

test("Bluetooth search needs no profile and design-only restrictions remain explicit", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Verbinden", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Printer verbinden",
    exact: true,
  });
  const scan = dialog.getByRole("button", {
    name: "Printer zoeken",
    exact: true,
  });
  await expect(scan).toBeEnabled();
  await dialog
    .getByRole("button", { name: "Kies merk DYMO", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: /^DYMO LabelWriter 450 USB/ })
    .click();
  await dialog
    .getByRole("button", { name: "Gebruik dit printerprofiel" })
    .click();
  await expect(
    dialog.getByText(/Alleen ontwerpen: direct printen/),
  ).toBeVisible();
  await expect(scan).toBeEnabled();
  await dialog.getByRole("button", { name: "Andere printer kiezen" }).click();
  await dialog.getByRole("button", { name: /Automatisch herkennen/ }).click();
  await expect(scan).toBeEnabled();
  await dialog
    .getByRole("button", { name: "Gebruik dit printerprofiel" })
    .click();
  await expect(scan).toBeEnabled();
});
