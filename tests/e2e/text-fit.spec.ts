import { expect, test } from "@playwright/test";

test("text fitting shrinks long text, survives saving and warns for clipped content", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tekst T", exact: true }).click();
  const checkbox = page.getByRole("checkbox", {
    name: "Tekst automatisch passend maken",
  });
  await checkbox.check();
  const field = (name: string) =>
    page.getByText(name, { exact: true }).locator("..").locator("input");
  await field("X").fill("10");
  await field("Y").fill("10");
  await field("W").fill("200");
  await field("H").fill("40");
  await field("Size").fill("30");
  await field("Content").fill(
    "Dit is een lang voorbeeld dat volledig in het tekstvak moet passen zonder tekst te verliezen",
  );
  await expect(page.getByText(/^Weergave:/)).not.toHaveText(/Weergave: 30 px/);
  await expect(
    page.getByRole("status", { name: "Controle labelinhoud" }),
  ).not.toBeVisible();
  await page.getByText("Transform", { exact: true }).click();
  await page.keyboard.press("ControlOrMeta+s");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem("thermoprint.library.v1") || '{"labels":[]}',
          ).labels[0]?.elements[0]?.props.autoFit,
      ),
    )
    .toBe(true);
  await field("X").fill("-20");
  await expect(
    page.getByRole("status", { name: "Controle labelinhoud" }),
  ).toContainText("valt buiten de labelrand");
});

test("impossible text fit is explicit rather than truncated silently", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tekst T", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Tekst automatisch passend maken" })
    .check();
  const field = (name: string) =>
    page.getByText(name, { exact: true }).locator("..").locator("input");
  await field("W").fill("2");
  await field("H").fill("2");
  await field("Content").fill("Veel te veel tekst");
  await expect(
    page.getByRole("status", { name: "Controle labelinhoud" }),
  ).toContainText("tekst past niet, zelfs op 4 px");
});

test("print safety guard rejects clipped and impossible text before capture", async ({
  page,
}) => {
  test.skip(
    !!process.env.PRODUCTION_URL &&
      !process.env.PRODUCTION_URL.includes(":5173"),
    "Direct module guard check requires the development server; UI tests above run in production too.",
  );
  await page.goto("/");
  const messages = await page.evaluate(async () => {
    // @ts-expect-error Development server exposes the same print guard used by Editor.
    const { assertLabelContentFits } =
      await import("/src/label/text-fit-layout.ts");
    const label = {
      widthMm: 40,
      heightMm: 12,
      widthPx: 320,
      heightPx: 96,
      shape: "rectangle",
    };
    const element = {
      id: "test",
      type: "text",
      x: 10,
      y: 10,
      width: 200,
      height: 40,
      rotation: 0,
      props: { text: "Voorbeeld", fontSize: 18, autoFit: true },
    };
    const check = (value: typeof element) => {
      try {
        assertLabelContentFits([value], label);
        return "ok";
      } catch (error) {
        return (error as Error).message;
      }
    };
    return [
      check(element),
      check({ ...element, x: -20 }),
      check({ ...element, width: 1, height: 1 }),
    ];
  });
  expect(messages[0]).toBe("ok");
  expect(messages[1]).toContain("vóór het printen");
  expect(messages[1]).toContain("valt buiten de labelrand");
  expect(messages[2]).toContain("tekst past niet, zelfs op 4 px");
});
