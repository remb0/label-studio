import { expect, test } from "@playwright/test";

test("inline typing is autosaved before blur and Escape restores the original draft text", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tekst T", exact: true }).click();
  const canvas = page.locator(".konvajs-content");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Editorcanvas ontbreekt");
  await page.mouse.dblclick(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  const textarea = page.locator("body > textarea");
  await expect(textarea).toBeFocused();
  await expect(textarea).toHaveValue("Label Text");
  await textarea.fill("Deze tekst is nog niet afgesloten");
  await expect(textarea).toBeFocused();
  const draftText = () =>
    page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem("label-studio.draft.v1") ||
            '{"document":{"elements":[]}}',
        ).document.elements[0]?.props.text,
    );
  await expect.poll(draftText).toBe("Deze tekst is nog niet afgesloten");
  await expect(textarea).toBeFocused();
  await textarea.press("Escape");
  await expect(textarea).toHaveCount(0);
  await expect.poll(draftText).toBe("Label Text");
});
