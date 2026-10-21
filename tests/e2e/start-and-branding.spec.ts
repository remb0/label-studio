import { test, expect } from "@playwright/test";

test("blank document offers visual starting choices and project GitHub link", async ({
  page,
}) => {
  await page.goto("/");
  const hint = page.getByRole("complementary", { name: "Start je label" });
  await expect(hint).toBeVisible();
  const github = page.getByRole("link", { name: "Label Studio op GitHub" });
  await expect(github).toHaveAttribute(
    "href",
    "https://github.com/remb0/label-studio",
  );
  expect(await page.locator('a[href*="tomLadder"]').count()).toBe(0);
  await hint
    .getByRole("button", { name: "Kies een formaat", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Label- en printinstellingen" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Instellingen sluiten" }).click();
  await hint
    .getByRole("button", { name: "Kies een sjabloon", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "Sjablonen" })).toBeVisible();
});
