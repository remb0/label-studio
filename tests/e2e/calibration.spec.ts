import { test, expect } from "@playwright/test";
import { bluetoothState, mockBluetooth } from "./helpers/mock-bluetooth";

test("printer test guides paper and offset choices but cannot print or save without hardware", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Printer", exact: true }).click();
  await page.getByRole("button", { name: "Printertest starten" }).click();
  const dialog = page.getByRole("dialog", { name: "Printertest" });
  await expect(dialog.getByText(/Stap 1 van 4/)).toBeVisible();
  await dialog
    .getByLabel("Testlabel breedte (mm)", { exact: true })
    .fill("200");
  await expect(
    dialog.getByRole("button", { name: "Verder naar testlabel" }),
  ).toBeDisabled();
  await dialog.getByLabel("Testlabel breedte (mm)", { exact: true }).fill("30");
  await dialog.getByRole("button", { name: "Verder naar testlabel" }).click();
  await expect(dialog.getByLabel("Voorbeeld kalibratielabel")).toBeVisible();
  await dialog.getByLabel("Correctie X (mm)", { exact: true }).fill("1.2");
  await dialog.getByLabel("Testdichtheid").selectOption("3");
  await expect(
    dialog.getByRole("button", { name: "Liniaal printen" }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "Afdruk beoordelen" }),
  ).toBeDisabled();
  await dialog.getByLabel("Correctie X (mm)", { exact: true }).fill("5");
  await dialog.getByLabel("Correctie Y (mm)", { exact: true }).fill("5");
  // Small physical labels must not silently show an uncorrected preview.
  await dialog.getByRole("button", { name: "Terug", exact: true }).click();
  await dialog.getByLabel("Testlabel breedte (mm)", { exact: true }).fill("12");
  await dialog.getByLabel("Testlabel lengte (mm)", { exact: true }).fill("12");
  await dialog.getByRole("button", { name: "Verder naar testlabel" }).click();
  await expect(dialog.getByRole("alert")).toContainText("zou inhoud afsnijden");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("label-studio:calibration:v1"),
    ),
  ).toBeNull();
  await dialog.getByRole("button", { name: "Terug", exact: true }).click();
  await expect(
    dialog.getByLabel("Testlabel breedte (mm)", { exact: true }),
  ).toHaveValue("12");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("calibration is usable within a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await page.goto("/");
  await page.getByRole("button", { name: "Printer", exact: true }).click();
  await page.getByRole("button", { name: "Printertest starten" }).click();
  const dialog = page.getByRole("dialog", { name: "Printertest" });
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await dialog.getByRole("button", { name: "Verder naar testlabel" }).click();
  await dialog
    .getByRole("button", { name: "Afdruk beoordelen" })
    .scrollIntoViewIfNeeded();
  await expect(
    dialog.getByRole("button", { name: "Afdruk beoordelen" }),
  ).toBeInViewport();
});

test("the D1S ruler test on a continuous roll does not hunt for a gap", async ({
  page,
}) => {
  await mockBluetooth(page, "success");
  await page.goto("/");
  await page.getByRole("button", { name: "Printer", exact: true }).click();
  const scan = page.getByRole("button", {
    name: "Printer zoeken",
    exact: true,
  });
  const openDialog = page.getByRole("button", {
    name: "Printer verbinden",
    exact: true,
  });
  await expect(scan.or(openDialog).first()).toBeVisible();
  if (await scan.isVisible()) await scan.click();
  else {
    await openDialog.click();
    await scan.click();
  }
  await page.getByRole("button", { name: "Printertest starten" }).click();
  const dialog = page.getByRole("dialog", { name: "Printertest" });
  // Connecting resets the printer to gap labels; the wizard must not.
  await dialog.getByLabel("Papiersoort").selectOption("continuous");
  await dialog.getByLabel("Rolbreedte (mm)").fill("48");
  await dialog.getByRole("button", { name: "Verder naar testlabel" }).click();
  await dialog.getByRole("button", { name: "Liniaal printen" }).click();
  await expect(
    dialog.getByRole("button", { name: "Afdruk beoordelen" }),
  ).toBeEnabled({ timeout: 15_000 });

  const { packets } = await bluetoothState(page);
  const joined = packets.map((bytes) => bytes.join(","));
  expect(joined).toContain("16,255,132,2"); // continuous paper
  expect(joined).not.toContain("29,12"); // no form feed to the next gap
  expect(joined.filter((bytes) => bytes === "27,74,80")).toHaveLength(1);
});
