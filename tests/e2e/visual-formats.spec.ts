import { test, expect } from "@playwright/test";

test("visual sizes apply geometry and retain artwork; custom dimensions remain editable", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tekst T", exact: true }).click();
  await page
    .getByRole("button", { name: "Instellingen", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Label- en printinstellingen",
  });
  await expect(
    dialog.getByLabel("Breedte (mm)", { exact: true }),
  ).not.toBeVisible();
  const round = dialog.getByRole("button", {
    name: "Rond, 30 × 30 mm, los label",
    exact: true,
  });
  await round.click();
  await expect(round).toHaveAttribute("aria-pressed", "true");
  await dialog.getByText("Formaat aanpassen", { exact: true }).click();
  await expect(dialog.getByLabel("Breedte (mm)", { exact: true })).toHaveValue(
    "30",
  );
  await expect(dialog.getByLabel("Labelvorm", { exact: true })).toHaveValue(
    "circle",
  );
  await dialog.getByLabel("Breedte (mm)", { exact: true }).fill("35");
  await dialog.getByRole("button", { name: "Instellingen sluiten" }).click();
  await page.keyboard.press("ControlOrMeta+s");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem("thermoprint.library.v1") ?? '{"labels":[]}',
          ).labels[0]?.label.widthMm,
      ),
    )
    .toBe(35);
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("thermoprint.library.v1")!).labels[0],
  );
  expect(saved.label).toMatchObject({
    widthMm: 35,
    heightMm: 30,
    shape: "circle",
    widthPx: 280,
    heightPx: 240,
  });
  expect(saved.elements).toHaveLength(1);
});

test("canvas format chooser applies continuous roll size with correct feed direction", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^40 × 12 mm/ }).click();
  const dialog = page.getByRole("dialog", { name: "Labelformaat kiezen" });
  await dialog
    .getByRole("button", {
      name: "Doorlopende rol, 48 × 56 mm, doorlopend",
      exact: true,
    })
    .click();
  await page.keyboard.press("ControlOrMeta+s");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem("thermoprint.library.v1") ?? '{"labels":[]}',
          ).labels[0]?.label.widthMm,
      ),
    )
    .toBe(48);
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("thermoprint.library.v1")!).labels[0],
  );
  expect(saved.label).toMatchObject({ widthMm: 48, heightMm: 56 });
  expect(saved.settings).toMatchObject({
    paperType: "continuous",
    rollDirection: "vertical",
  });
});
