import { expect, test } from "@playwright/test";

test("zoom accepts percentages and Escape cancels without committing", async ({
  page,
}) => {
  await page.goto("/");
  const input = page
    .getByRole("textbox", { name: "Zoompercentage" })
    .filter({ visible: true });
  await input.fill("150");
  await input.press("Enter");
  await expect(input).toHaveValue("150");
  await input.fill("300");
  await input.press("Escape");
  await expect(input).toHaveValue("150");
  await input.fill("9999");
  await input.press("Enter");
  await expect(input).toHaveValue("800");
});
