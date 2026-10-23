import { test, expect } from "@playwright/test";
import {
  mockBluetooth,
  bluetoothState,
  type MockBluetoothState,
} from "./helpers/mock-bluetooth";

test("automatic printer choice is shared with Connect printer and survives cancellation", async ({
  page,
}) => {
  await mockBluetooth(page, "cancel");
  await page.goto("/");
  await page.getByRole("button", { name: "Printer", exact: true }).click();
  const picker = page.getByRole("region", { name: "Printermodel kiezen" });
  await picker.getByRole("button", { name: /Automatisch herkennen/ }).click();
  await picker
    .getByRole("button", { name: "Gebruik dit printerprofiel" })
    .click();
  await page.getByRole("button", { name: "Ontwerpen", exact: true }).click();
  await page
    .getByRole("button", { name: "Connect printer", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Printer verbinden",
    exact: true,
  });
  const scan = dialog.getByRole("button", {
    name: "Printer zoeken",
    exact: true,
  });
  await expect(scan).toBeEnabled({ timeout: 2000 });
  await scan.click();
  await expect(scan).toBeEnabled({ timeout: 2000 });
  await scan.click();
  const { calls } = await bluetoothState(page);
  expect(calls).toHaveLength(2);
  expect(calls.every((call) => call.active)).toBe(true);
  expect(calls[0].options).toEqual(calls[1].options);
  await page.reload();
  await page
    .getByRole("button", { name: "Connect printer", exact: true })
    .click();
  await expect(scan).toBeEnabled();
  await scan.click();
  expect((await bluetoothState(page)).calls).toHaveLength(1);
});

test("printer page, editor, navbar and Print call the same Bluetooth picker on a user gesture", async ({
  page,
}) => {
  await mockBluetooth(page, "cancel");
  await page.goto("/");
  const dialog = page.getByRole("dialog", {
    name: "Printer verbinden",
    exact: true,
  });
  const scan = dialog.getByRole("button", {
    name: "Printer zoeken",
    exact: true,
  });
  await page.getByRole("button", { name: "Printer", exact: true }).click();
  await page
    .getByRole("button", { name: "Printer verbinden", exact: true })
    .click();
  await scan.click();
  await expect(scan).toBeEnabled();
  await dialog
    .getByRole("button", { name: "Verbindingsvenster sluiten" })
    .click();
  await page.getByRole("button", { name: "Ontwerpen", exact: true }).click();
  await page
    .getByRole("button", { name: "Connect printer", exact: true })
    .click();
  await scan.click();
  await expect(scan).toBeEnabled();
  await dialog
    .getByRole("button", { name: "Verbindingsvenster sluiten" })
    .click();
  await page.getByRole("button", { name: "Verbinden", exact: true }).click();
  await scan.click();
  await expect(scan).toBeEnabled();
  await dialog
    .getByRole("button", { name: "Verbindingsvenster sluiten" })
    .click();
  await page.getByRole("button", { name: /^Print\s*⌘P$/ }).click();
  await scan.click();
  await expect(scan).toBeEnabled();
  const state = await bluetoothState(page);
  expect(state.calls).toHaveLength(4);
  expect(state.calls.every((call) => call.active)).toBe(true);
  for (const call of state.calls)
    expect(call.options).toEqual(state.calls[0].options);
  expect(state.connects).toBe(0);
  expect(state.writes).toBe(0);
});

for (const entry of ["printer page", "Connect printer"]) {
  test(`${entry} reports errors, retries and connects a simulated BLE printer without printing`, async ({
    page,
  }) => {
    await mockBluetooth(page, "error");
    await page.addInitScript(() =>
      localStorage.setItem("label-studio:preferred-printer:v1", ""),
    );
    await page.goto("/");
    if (entry === "printer page") {
      await page.getByRole("button", { name: "Printer", exact: true }).click();
      await page
        .getByRole("button", { name: "Printer verbinden", exact: true })
        .click();
    } else {
      await page
        .getByRole("button", { name: "Connect printer", exact: true })
        .click();
    }
    const dialog = page.getByRole("dialog", {
      name: "Printer verbinden",
      exact: true,
    });
    await dialog
      .getByRole("button", { name: "Printer zoeken", exact: true })
      .click();
    await expect(
      dialog.getByText("Verbinding mislukt", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog
        .getByText("Bluetooth-toegang geweigerd door de test", { exact: true })
        .last(),
    ).toBeVisible();
    await page.evaluate(() => {
      (
        window as unknown as { __mockBluetooth: MockBluetoothState }
      ).__mockBluetooth.mode = "success";
    });
    await dialog.getByRole("button", { name: "Opnieuw proberen" }).click();
    await dialog
      .getByRole("button", { name: "Printer zoeken", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Verbonden", exact: true }),
    ).toBeVisible();
    const state = await bluetoothState(page);
    expect(state.calls).toHaveLength(2);
    expect(state.calls.every((call) => call.active)).toBe(true);
    expect(state.connects).toBe(1);
    expect(state.writes).toBe(0);
  });
}

test("an unknown device is rejected instead of forcing the selected printer protocol", async ({
  page,
}) => {
  await mockBluetooth(page, "unknown");
  await page.addInitScript(() =>
    localStorage.setItem("label-studio:preferred-printer:v1", "luckp-d1s"),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Connect printer", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Printer verbinden",
    exact: true,
  });
  await dialog
    .getByRole("button", { name: "Printer zoeken", exact: true })
    .click();
  await expect(
    dialog.getByText("Verbinding mislukt", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText(/Geen ondersteund printerprofiel/).last(),
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
    await page
      .getByRole("button", { name: "Connect printer", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Printer verbinden", exact: true })
      .getByRole("button", { name: "Printer zoeken", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Verbonden", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        localStorage.getItem("label-studio:preferred-printer:v1"),
      ),
    ).toBe("luckp-d1s");
    const state = await bluetoothState(page);
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0].active).toBe(true);
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
  await page
    .getByRole("button", { name: "Connect printer", exact: true })
    .click();
  const scan = page
    .getByRole("dialog", { name: "Printer verbinden", exact: true })
    .getByRole("button", { name: "Printer zoeken", exact: true });
  await scan.click();
  await expect(scan).toBeEnabled();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("label-studio:preferred-printer:v1"),
    ),
  ).toBe("p12");
  expect((await bluetoothState(page)).connects).toBe(0);
});

test("a failed Bluetooth connection does not replace the preferred model", async ({
  page,
}) => {
  await mockBluetooth(page, "connection-error");
  await page.addInitScript(() =>
    localStorage.setItem("label-studio:preferred-printer:v1", "p12"),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Connect printer", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Printer verbinden",
    exact: true,
  });
  await dialog
    .getByRole("button", { name: "Printer zoeken", exact: true })
    .click();
  await expect(
    dialog.getByText("Verbinding mislukt", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("label-studio:preferred-printer:v1"),
    ),
  ).toBe("p12");
  const state = await bluetoothState(page);
  expect(state.connects).toBe(1);
  expect(state.writes).toBe(0);
});
