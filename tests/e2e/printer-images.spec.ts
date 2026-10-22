import { test, expect } from "@playwright/test";

for (const width of [1280, 390]) {
  test(`printer cards put text beside images at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await page.getByRole("button", { name: "Printer", exact: true }).click();
    const picker = page.getByRole("region", { name: "Printermodel kiezen" });
    async function expectSideBySide(selector: string) {
      for (const card of await picker.locator(selector).all()) {
        const image = await card.locator(":scope > span").first().boundingBox();
        const text = await card.locator(".printer-card-copy").boundingBox();
        expect(image).not.toBeNull();
        expect(text).not.toBeNull();
        expect(text!.x).toBeGreaterThanOrEqual(image!.x + image!.width);
        expect(text!.y).toBeLessThan(image!.y + image!.height);
        expect(image!.y).toBeLessThan(text!.y + text!.height);
      }
    }
    await expectSideBySide(".printer-brands button");
    await picker.getByRole("button", { name: "Alles tonen (20)" }).click();
    await expect(picker.locator("[data-printer-result]")).toHaveCount(20);
    await expect(picker.locator(".printer-model-image img")).toHaveCount(14);
    await expect(
      picker.getByText("Foto nog niet bevestigd", { exact: true }),
    ).toHaveCount(6);
    await expect
      .poll(() =>
        picker
          .locator(".printer-model-image img")
          .evaluateAll((images) =>
            images.every(
              (image) =>
                (image as HTMLImageElement).complete &&
                (image as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    await expectSideBySide("[data-printer-result]");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    const twin = picker.locator('[data-printer-result="dymo-450-twin"]');
    const duo = picker.locator('[data-printer-result="dymo-450-duo"]');
    await expect(twin.getByRole("img")).toHaveAttribute(
      "src",
      "/printers/dymo-450-twin.jpg",
    );
    await expect(duo.getByRole("img")).toHaveAttribute(
      "src",
      "/printers/dymo-450-duo.jpg",
    );
    await twin.click();
    await expect(
      picker.getByRole("link", { name: "Bekijk de bron" }),
    ).toHaveAttribute("href", "https://www.dymo.com/labelwriter.html");
  });
}

test("a failed model photo never falls back to another model's image", async ({
  page,
}) => {
  await page.route("**/printers/dymo-550.jpg", (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Printer", exact: true }).click();
  const picker = page.getByRole("region", { name: "Printermodel kiezen" });
  await picker.getByRole("button", { name: "Alles tonen (20)" }).click();
  const model = picker.locator('[data-printer-result="dymo-550"]');
  await expect(model.getByText("Foto niet beschikbaar")).toBeVisible();
  await expect(model.getByRole("img")).toHaveCount(0);
  await expect(
    picker.locator('[data-printer-result="dymo-550-turbo"] img'),
  ).toHaveAttribute("src", "/printers/dymo-550-turbo.jpg");
});
