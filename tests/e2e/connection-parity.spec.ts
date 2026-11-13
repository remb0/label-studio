import { test, expect, type Page } from "@playwright/test";
import {
  mockBluetooth,
  bluetoothState,
  type MockBluetoothState,
} from "./helpers/mock-bluetooth";

async function openPrinterPage(page: Page) {
  await page.getByRole("button", { name: "Printer", exact: true }).click();
  return page.getByRole("region", {
    name: "Printer verbinden",
    exact: true,
  });
}

test("automatic printer choice stays scan-first and survives cancellation", async ({
  page,
}) => {
  await mockBluetooth(page, "cancel");
  await page.goto("/");
  const connection = await openPrinterPage(page);
  const picker = connection.getByRole("region", {
    name: "Printermodel kiezen",
  });
  await picker.getByRole("button", { name: /Automatisch herkennen/ }).click();
  await picker
    .getByRole("button", { name: "Gebruik dit printerprofiel" })
    .click();
  const scan = connection.getByRole("button", {
    name: "Printer zoeken",
    exact: true,
  });
  await scan.click();
  await expect(scan).toBeEnabled();
  expect((await bluetoothState(page)).calls).toHaveLength(1);
  await page.reload();
  const reloaded = await openPrinterPage(page);
  await reloaded
    .getByRole("button", { name: "Printer zoeken", exact: true })
    .click();
  expect((await bluetoothState(page)).calls).toHaveLength(1);
});

test("the printer menu and Print both navigate to the same full-page connector", async ({
  page,
}) => {
  await mockBluetooth(page, "cancel");
  await page.goto("/");
  const connection = await openPrinterPage(page);
  await connection
    .getByRole("button", { name: "Printer zoeken", exact: true })
    .click();
  await page.getByRole("button", { name: "Ontwerpen", exact: true }).click();
  await page.getByRole("button", { name: /^Afdrukken\s*⌘P$/ }).click();
  const fromPrint = page.getByRole("region", {
    name: "Printer verbinden",
    exact: true,
  });
  await fromPrint
    .getByRole("button", { name: "Printer zoeken", exact: true })
    .click();
  const state = await bluetoothState(page);
  expect(state.calls).toHaveLength(2);
  expect(state.calls.every((call) => call.active)).toBe(true);
  expect(state.calls[0].options).toEqual(state.calls[1].options);
  expect(state.connects).toBe(0);
  expect(state.writes).toBe(0);
});

test("the printer page reports errors, retries and connects without printing", async ({
  page,
}) => {
  await mockBluetooth(page, "error");
  await page.addInitScript(() =>
    localStorage.setItem("label-studio:preferred-printer:v1", ""),
  );
  await page.goto("/");
  const connection = await openPrinterPage(page);
  await connection
    .getByRole("button", { name: "Printer zoeken", exact: true })
    .click();
  await expect(
    connection.getByText("Verbinding mislukt", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    (
      window as unknown as { __mockBluetooth: MockBluetoothState }
    ).__mockBluetooth.mode = "success";
  });
  await connection.getByRole("button", { name: "Opnieuw proberen" }).click();
  await connection
    .getByRole("button", { name: "Printer zoeken", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Jouw printer", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("LuckP_D1S_TEST", { exact: true }).first(),
  ).toBeVisible();
  const state = await bluetoothState(page);
  expect(state.calls).toHaveLength(2);
  expect(state.connects).toBe(1);
  expect(state.writes).toBe(0);
});

test("an unknown device is rejected instead of forcing the selected protocol", async ({
  page,
}) => {
  await mockBluetooth(page, "unknown");
  await page.addInitScript(() =>
    localStorage.setItem("label-studio:preferred-printer:v1", "luckp-d1s"),
  );
  await page.goto("/");
  const connection = await openPrinterPage(page);
  await connection
    .getByRole("button", { name: "Printer zoeken", exact: true })
    .click();
  await expect(
    connection.getByText(/Geen ondersteund printerprofiel/).last(),
  ).toBeVisible();
  expect((await bluetoothState(page)).connects).toBe(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("label-studio:preferred-printer:v1"),
    ),
  ).toBe("luckp-d1s");
});

for (const preferred of [null, "p12", "niimbot-d11-h"]) {
  test(`scan-first recognizes the real printer with preference ${preferred}`, async ({
    page,
  }) => {
    await mockBluetooth(page, "success");
    if (preferred)
      await page.addInitScript(
        (id) => localStorage.setItem("label-studio:preferred-printer:v1", id),
        preferred,
      );
    await page.goto("/");
    const connection = await openPrinterPage(page);
    await connection
      .getByRole("button", { name: "Printer zoeken", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Jouw printer", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        localStorage.getItem("label-studio:preferred-printer:v1"),
      ),
    ).toBe("luckp-d1s");
    const state = await bluetoothState(page);
    expect(state.calls).toHaveLength(1);
    expect(state.connects).toBe(1);
    expect(state.writes).toBe(0);
  });
}

test("cancelling scan-first keeps the existing preferred model", async ({
  page,
}) => {
  await mockBluetooth(page, "cancel");
  await page.addInitScript(() =>
    localStorage.setItem("label-studio:preferred-printer:v1", "p12"),
  );
  await page.goto("/");
  const connection = await openPrinterPage(page);
  const scan = connection.getByRole("button", {
    name: "Printer zoeken",
    exact: true,
  });
  await scan.click();
  await expect(scan).toBeEnabled();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("label-studio:preferred-printer:v1"),
    ),
  ).toBe("p12");
});

test("a failed Bluetooth connection does not replace the preferred model", async ({
  page,
}) => {
  await mockBluetooth(page, "connection-error");
  await page.addInitScript(() =>
    localStorage.setItem("label-studio:preferred-printer:v1", "p12"),
  );
  await page.goto("/");
  const connection = await openPrinterPage(page);
  await connection
    .getByRole("button", { name: "Printer zoeken", exact: true })
    .click();
  await expect(
    connection.getByText("Verbinding mislukt", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("label-studio:preferred-printer:v1"),
    ),
  ).toBe("p12");
  expect((await bluetoothState(page)).connects).toBe(1);
});
