import { test, expect } from "@playwright/test";

test("blank document offers visual starting choices and project GitHub link", async ({
  page,
}) => {
  await page.goto("/");
  const hint = page.getByRole("complementary", { name: "Start je label" });
  await expect(hint).toBeVisible();
  const github = page.getByRole("link", {
    name: "Steun Label Studio via GitHub Sponsors",
  });
  await expect(github).toHaveAttribute(
    "href",
    "https://github.com/sponsors/remb0",
  );
  expect(await page.locator('a[href*="tomLadder"]').count()).toBe(0);
  await hint
    .getByRole("button", { name: "Kies een formaat", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Label- en printinstellingen" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ontwerpen", exact: true }).click();
  await hint
    .getByRole("button", { name: "Kies een sjabloon", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Sjablonen", exact: true }),
  ).toBeVisible();
});
