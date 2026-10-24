import { expect, test } from "@playwright/test";

test("recover unsaved artwork after reload, retain across navigation, discard explicitly", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tekst T", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Concept automatisch bewaard" }),
  ).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Hoofdnavigatie" });
  await nav.getByRole("button", { name: "Printer", exact: true }).click();
  await nav.getByRole("button", { name: "Ontwerpen", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Niet-opgeslagen concept gevonden" }),
  ).not.toBeVisible();
  page.on("dialog", (dialog) => dialog.accept());
  await page.reload();
  const recovery = page.getByRole("dialog", {
    name: "Niet-opgeslagen concept gevonden",
  });
  await expect(recovery).toBeVisible();
  await recovery.getByRole("button", { name: "Concept herstellen" }).click();
  await expect(page.getByText("1 elementen", { exact: true })).toBeVisible();
  await page.reload();
  await recovery.getByRole("button", { name: "Concept verwijderen" }).click();
  await page.reload();
  await expect(recovery).not.toBeVisible();
  await expect(page.getByText("0 elementen", { exact: true })).toBeVisible();
});

test("saving a named template invalidates its recovery slot", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tekst T", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("label-studio.draft.v1")),
    )
    .not.toBeNull();
  await page.keyboard.press("ControlOrMeta+s");
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("label-studio.draft.v1")),
    )
    .toBeNull();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem("thermoprint.library.v1") || '{"labels":[]}',
          ).labels.length,
      ),
    )
    .toBe(1);
  await page.reload();
  await expect(
    page.getByRole("dialog", { name: "Niet-opgeslagen concept gevonden" }),
  ).not.toBeVisible();
});
