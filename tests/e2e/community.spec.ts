import { expect, test } from "@playwright/test";

test("guest account mode stays offline and language preference is remembered", async ({
  page,
}) => {
  const remote: string[] = [];
  page.on("request", (request) => {
    if (/supabase/.test(request.url())) remote.push(request.url());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(
    page.getByText(
      "Cloudaccounts zijn nog niet ingesteld door de beheerder. Je kunt de studio zonder account gebruiken.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "E-mailadres" })).toHaveCount(
    0,
  );
  expect(remote).toEqual([]);
  await page.getByRole("combobox", { name: "Taal" }).selectOption("en");
  await expect(
    page.getByRole("button", { name: "About", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "About", exact: true }),
  ).toBeVisible();
});
