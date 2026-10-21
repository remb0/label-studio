import { expect, test } from "@playwright/test";

test("BoxCare CSV wizard maps, validates, corrects and prepares private local labels", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Bulklabels", exact: true }).click();
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "boxcare.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "Naam;Klanttype;Actief;Straat;Huisnummer;Postcode;Stad;Bedrijfsnaam\nJan Jansen;particulier;Ja;Dorpsstraat;12;1234ab;Utrecht;\nPiet;particulier;Nee;Straat;5;8888ZZ;Amsterdam;\nBedrijf;zakelijk;Ja;Markt;4;5555AB;;Voorbeeld BV",
      ),
    });
  await expect(
    page.getByText("boxcare.csv · 3 gegevensrijen · 8 kolommen"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Kolommen koppelen →" }).click();
  await expect(
    page.getByLabel("Bronkolommen voor Straat / volledig adres"),
  ).toHaveValues(["3"]);
  await page
    .getByRole("button", { name: "Bewaar mapping", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "geen adressen opgeslagen",
  );
  await page.getByRole("button", { name: "Filters instellen →" }).click();
  await expect(page.getByLabel("Alleen actieve rijen")).toBeChecked();
  await page.getByRole("button", { name: "Adressen controleren →" }).click();
  await expect(
    page.getByText("2 adressen · 1 volledig · 2 geselecteerd"),
  ).toBeVisible();
  await expect(page.getByLabel("Rij 2 postal")).toHaveValue("1234 AB");
  await expect(
    page.getByRole("button", { name: "Ontwerp bekijken →" }),
  ).toBeDisabled();
  await page.getByLabel("Rij 4 city").fill("Rotterdam");
  await page.getByRole("button", { name: "Ontwerp bekijken →" }).click();
  await expect(page.getByLabel("Voorbeeld etiket Jan Jansen")).toBeVisible();
  await page.getByRole("button", { name: "Naar printopdracht →" }).click();
  await expect(
    page.getByText("2 geselecteerde adressen · 2 etiketten"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Print 2 etiketten", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Verbind eerst een printer",
  );
  const stored = await page.evaluate(() => JSON.stringify(localStorage));
  expect(stored).toContain("Mijn CSV-mapping");
  expect(stored).not.toContain("Jan Jansen");
  expect(stored).not.toContain("Dorpsstraat");
  await page.locator(".address-steps button").nth(1).click();
  await page
    .getByLabel("Bronkolommen voor Naam / contactpersoon")
    .selectOption(["7"]);
  await expect(page.locator(".address-steps button").nth(5)).toBeDisabled();
  await expect(page.locator(".address-steps button").nth(3)).toBeDisabled();
  await page.getByRole("button", { name: "Filters instellen →" }).click();
  await page.getByRole("button", { name: "Adressen controleren →" }).click();
  await expect(page.getByLabel("Rij 2 name")).toHaveValue("");
  await page.locator(".address-steps button").nth(2).click();
  await page.getByLabel("Alleen actieve rijen").uncheck();
  await expect(page.locator(".address-steps button").nth(5)).toBeDisabled();
  await page.getByRole("button", { name: "Adressen controleren →" }).click();
  await expect(page.getByLabel("Rij 3 name")).toBeVisible();
});

test("single address renders and warns when its text overflows", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Adreslabels", exact: true }).click();
  await page
    .getByLabel("Naam / contactpersoon", { exact: true })
    .fill("Een voorbeeldnaam");
  await page
    .getByLabel("Straat / volledig adres", { exact: true })
    .fill("Voorbeeldstraat 12");
  await page.getByLabel("Postcode", { exact: true }).fill("1234 AB");
  await page.getByLabel("Plaats", { exact: true }).fill("Amsterdam");
  await expect(
    page.getByLabel("Voorbeeld etiket Een voorbeeldnaam"),
  ).toBeVisible();
  const preview = page.getByLabel("Voorbeeld etiket Een voorbeeldnaam");
  const bounds = await preview.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(
    bounds!.x + bounds!.width / 2,
    bounds!.y + bounds!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds!.x + bounds!.width / 2 + 25,
    bounds!.y + bounds!.height / 2 + 10,
  );
  await page.mouse.up();
  await expect(page.getByLabel(/Tekst horizontaal/)).not.toHaveValue("50");
  // The canvas itself is the final binary raster, including anti-aliased text edges.
  expect(
    await preview.evaluate((element: HTMLCanvasElement) => {
      const pixels = element
        .getContext("2d")!
        .getImageData(0, 0, element.width, element.height).data;
      return pixels.every((v, i) =>
        i % 4 === 3 ? v === 255 : v === 0 || v === 255,
      );
    }),
  ).toBe(true);
  const withoutLogo = await preview.evaluate((element: HTMLCanvasElement) =>
    element.toDataURL(),
  );
  await page
    .getByRole("button", { name: "BoxCare-icoon", exact: true })
    .click();
  await expect
    .poll(() =>
      preview.evaluate((element: HTMLCanvasElement) => element.toDataURL()),
    )
    .not.toBe(withoutLogo);
  await page.getByLabel("Versleep op het voorbeeld").selectOption("logo");
  await preview.scrollIntoViewIfNeeded();
  const logoBounds = await preview.boundingBox();
  expect(logoBounds).not.toBeNull();
  await page.mouse.move(
    logoBounds!.x + logoBounds!.width / 2,
    logoBounds!.y + logoBounds!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    logoBounds!.x + logoBounds!.width / 2 - 20,
    logoBounds!.y + logoBounds!.height / 2 - 20,
  );
  await page.mouse.up();
  await expect(
    page.getByLabel("Logo horizontaal", { exact: true }),
  ).not.toHaveValue("50");
  await page
    .getByLabel("Naam / contactpersoon", { exact: true })
    .fill("X".repeat(150));
  await expect(
    page.getByText(
      "Tekst valt buiten het etiket. Verklein of verplaats het tekstblok.",
    ),
  ).toBeVisible();
});
