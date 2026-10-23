import { test, expect } from "@playwright/test";

test("new catalog models expose sourced specs without enabling direct printing", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Connect printer", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Printer verbinden",
    exact: true,
  });
  await dialog.getByRole("button", { name: "Kies merk NIIMBOT" }).click();
  await expect(dialog.locator("[data-printer-result]")).toHaveCount(4);
  await dialog.getByRole("button", { name: /^NIIMBOT D11-H/ }).click();
  await dialog.getByText("Specificaties en bronnen", { exact: true }).click();
  await expect(dialog.locator(".printer-specifications")).toContainText(
    "300 dpi",
  );
  await expect(dialog.locator(".printer-specifications")).toContainText(
    "142 dots",
  );
  await expect(dialog.getByRole("link", { name: /NiimBlue/ })).toHaveAttribute(
    "href",
    /a9bc3f5/,
  );
  await dialog
    .getByRole("button", { name: "Gebruik dit printerprofiel" })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Printer zoeken", exact: true }),
  ).toBeEnabled();
  await expect(
    dialog.getByText(/Alleen ontwerpen: direct printen/),
  ).toBeVisible();
});

test("uncertain head widths and wired LAN are not presented as verified specs or wifi", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Printer", exact: true }).click();
  const picker = page.getByRole("region", { name: "Printermodel kiezen" });
  await picker.getByRole("button", { name: "Kies merk Phomemo" }).click();
  await picker.getByRole("button", { name: /^Phomemo M110/ }).click();
  await expect(picker.locator(".printer-specifications")).toHaveAttribute(
    "open",
    "",
  );
  await expect(picker.locator(".printer-specifications")).toContainText(
    "Niet bevestigd / betwist",
  );
  await expect(picker.locator(".printer-specifications")).toContainText(
    "344 tegenover 384",
  );
  await picker.getByRole("button", { name: "Andere printer kiezen" }).click();
  await picker.getByRole("button", { name: "Ik weet het merk niet" }).click();
  await picker.getByLabel("Verbinding", { exact: true }).selectOption("wifi");
  await expect(picker.locator("[data-printer-result]")).toHaveCount(0);
  await picker.getByLabel("Verbinding", { exact: true }).selectOption("lan");
  await expect(picker.locator("[data-printer-result]")).toHaveCount(2);
});
