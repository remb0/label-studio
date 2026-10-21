import { test, expect } from "@playwright/test";

test("editor boots and navigation reaches local address workflows", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveTitle("Label Studio");
  await expect(
    page.getByRole("navigation", { name: "Hoofdnavigatie" }),
  ).toBeVisible();
  await expect(page.locator("canvas").first()).toBeVisible();
  await page.getByRole("button", { name: "Adreslabels", exact: true }).click();
  await expect(page.getByRole("textbox").first()).toBeVisible();
  await page.getByRole("button", { name: "Bulklabels", exact: true }).click();
  await expect(page.locator("input[type=file]").first()).toBeAttached();
  await page.getByRole("button", { name: "Printer", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Jouw printer" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("mobile navigation stays within viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Adreslabels", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("editor can start without the HTTPS-only randomUUID helper", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(crypto, "randomUUID", { value: undefined });
  });
  await page.goto("/");
  await expect(page.locator("canvas").first()).toBeVisible();
  await page.getByRole("button", { name: "Tekst T", exact: true }).click();
  await expect(page.getByText("1 elements", { exact: false })).toBeVisible();
});
