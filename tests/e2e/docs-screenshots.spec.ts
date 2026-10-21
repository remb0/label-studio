import { test } from "@playwright/test";

test("generate README screenshots with fictional demo content", async ({
  page,
}) => {
  test.skip(
    !process.env.UPDATE_DOC_SCREENSHOTS,
    "Explicit documentation generation only.",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("button", { name: "Tekst T", exact: true }).waitFor();
  await page.evaluate(async () => {
    const modulePath = "/src/store/editor-store.ts";
    const { useEditorV2Store: store } = await import(
      /* @vite-ignore */ modulePath
    );
    const text = (
      id: string,
      value: string,
      x: number,
      y: number,
      width: number,
      fontSize: number,
      fontWeight = 400,
    ) => ({
      id,
      type: "text",
      x,
      y,
      width,
      height: fontSize * 1.4,
      rotation: 0,
      props: {
        text: value,
        fontSize,
        fontWeight,
        fontFamily: "Inter",
        fill: "#000",
        align: "left",
      },
    });
    store.setState({
      label: {
        widthMm: 60,
        heightMm: 40,
        widthPx: 480,
        heightPx: 320,
        dpi: 203,
        shape: "rounded",
        split: "none",
      },
      currentLabelName: "Studio essentials · voorbeeld",
      currentLabelDirty: false,
      selectedIds: [],
      elements: [
        text("title", "STUDIO ESSENTIALS", 28, 30, 310, 28, 800),
        text("tagline", "Kleine labels. Grote ideeën.", 28, 77, 310, 16),
        {
          id: "divider",
          type: "line",
          x: 28,
          y: 112,
          width: 424,
          height: 0,
          rotation: 0,
          props: { stroke: "#000", strokeWidth: 2 },
        },
        text("product", "Demo collectie / 2026", 28, 136, 280, 20, 700),
        text(
          "detail",
          "Ontworpen in je browser\nLokaal opgeslagen · Bluetooth ready",
          28,
          174,
          280,
          14,
        ),
        {
          id: "qr",
          type: "qrcode",
          x: 338,
          y: 136,
          width: 110,
          height: 110,
          rotation: 0,
          props: {
            content: "https://labels.remb0.nl",
            errorCorrectionLevel: "M",
          },
        },
        {
          id: "barcode",
          type: "barcode",
          x: 28,
          y: 235,
          width: 220,
          height: 54,
          rotation: 0,
          props: {
            content: "LS-2026-DEMO",
            format: "CODE128",
            displayValue: true,
          },
        },
      ],
    });
    await document.fonts.ready;
  });
  await page.waitForTimeout(700);
  await page.evaluate(async () => {
    const modulePath = "/src/store/editor-store.ts";
    const { useEditorV2Store: store } = await import(
      /* @vite-ignore */ modulePath
    );
    store.getState().setZoom(1.7);
    store.getState().setPan(0, -20);
  });
  await page.screenshot({ path: "docs/images/editor.png" });
  await page
    .getByRole("navigation", { name: "Hoofdnavigatie" })
    .getByRole("button", { name: "Adreslabels", exact: true })
    .click();
  await page.getByLabel(/^Adrestype/).selectOption("zakelijk");
  const inputs = page.locator(".address-fields input");
  const values = [
    "Studio Voorbeeld",
    "Team Ontwerp",
    "Voorbeeldstraat 12",
    "1234 AB",
    "Demostad",
    "Nederland",
    "",
  ];
  for (let index = 0; index < values.length; index++)
    await inputs.nth(index).fill(values[index]);
  await page.screenshot({ path: "docs/images/address.png" });
});
