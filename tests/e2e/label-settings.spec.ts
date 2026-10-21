import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("custom label settings save and export a clean bitmap without selection or paper shadows", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "Instellingen", exact: true })
    .first()
    .click();
  const settings = page.getByRole("dialog", {
    name: "Label- en printinstellingen",
  });
  await expect(settings).toBeVisible();
  await settings.getByText("Formaat aanpassen", { exact: true }).click();
  await page
    .getByLabel("Documentresolutie", { exact: true })
    .selectOption("300");
  await page.getByLabel("Breedte (mm)", { exact: true }).fill("40");
  await page.getByLabel("Hoogte (mm)", { exact: true }).fill("30");
  await page.getByLabel("Labelvorm", { exact: true }).selectOption("rounded");
  await page
    .getByLabel("Doorvoerrichting", { exact: true })
    .selectOption("vertical");
  await page.getByRole("button", { name: "Instellingen sluiten" }).click();
  await page.keyboard.press("ControlOrMeta+s");
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("thermoprint.library.v1")),
    )
    .not.toBeNull();
  const document = await page.evaluate(
    () => JSON.parse(localStorage.getItem("thermoprint.library.v1")!).labels[0],
  );
  expect(document.label).toMatchObject({
    widthMm: 40,
    heightMm: 30,
    widthPx: 472,
    heightPx: 354,
    dpi: 300,
    shape: "rounded",
  });
  expect(document.settings.rollDirection).toBe("vertical");

  await page.reload();
  await page
    .getByRole("button", { name: "Instellingen", exact: true })
    .first()
    .click();
  await settings.getByText("Formaat aanpassen", { exact: true }).click();
  await expect(
    page.getByLabel("Doorvoerrichting", { exact: true }),
  ).toHaveValue("vertical");
  await expect(
    page.getByLabel("Documentresolutie", { exact: true }),
  ).toHaveValue("300");
  await page.getByRole("button", { name: "Instellingen sluiten" }).click();

  await page.getByRole("button", { name: /^Nieuw label/ }).click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "PNG downloaden", exact: true })
    .click();
  const download = await downloadPromise;
  const bytes = await readFile((await download.path())!);
  expect(bytes.readUInt32BE(16)).toBe(472);
  expect(bytes.readUInt32BE(20)).toBe(354);
  const pixels = await page.evaluate(
    async (dataUrl) => {
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, image.width, image.height).data;
      return [...data].every((value) => value === 255);
    },
    `data:image/png;base64,${bytes.toString("base64")}`,
  );
  expect(pixels).toBe(true);
  expect(errors).toEqual([]);
});

test("editor objects survive save, new document and reopen", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");
  await page.getByRole("button", { name: "Tekst T", exact: true }).click();
  for (const key of ["q", "b", "r", "l"]) await page.keyboard.press(key);
  await page.keyboard.press("ControlOrMeta+s");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem("thermoprint.library.v1") || '{"labels":[]}',
          ).labels[0]?.elements.length,
      ),
    )
    .toBe(5);
  await page
    .getByRole("navigation", { name: "Hoofdnavigatie" })
    .getByRole("button", { name: "Sjablonen", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Sjablonen" })
    .getByRole("button", { name: "Nieuw label", exact: true })
    .click();
  await expect(page.getByText("0 elements", { exact: true })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Hoofdnavigatie" })
    .getByRole("button", { name: "Sjablonen", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Sjablonen" })
    .getByRole("button", { name: "Open sjabloon Nieuw label", exact: true })
    .click();
  await expect(page.getByText("5 elements", { exact: true })).toBeVisible();
});

test("PNG export includes selected artwork but excludes cyan selection controls", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tekst T", exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: /^Nieuw label/ }).click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "PNG downloaden", exact: true })
    .click();
  const download = await downloadPromise;
  const bytes = await readFile((await download.path())!);
  const result = await page.evaluate(
    async (url) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
      let colored = 0,
        ink = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] !== pixels[i + 1] || pixels[i] !== pixels[i + 2])
          colored++;
        if (pixels[i] < 128) ink++;
      }
      return { colored, ink };
    },
    `data:image/png;base64,${bytes.toString("base64")}`,
  );
  expect(result.colored).toBe(0);
  expect(result.ink).toBeGreaterThan(10);
});

for (const width of [390, 600, 768, 1113, 1280]) {
  test(`Print control stays inside ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const printButton = page.getByRole("button", { name: /^Print(?: ⌘P)?$/ });
    await expect(printButton).toBeVisible();
    const bounds = await printButton.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
  });
}
