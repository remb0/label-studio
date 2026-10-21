import { test, expect } from "@playwright/test";
test("production container serves secure headers and the built app without CSP errors", async ({
  page,
  request,
}) => {
  test.skip(
    !process.env.PRODUCTION_URL,
    "Opt-in test for an actual production image",
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const response = await request.get("/");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-security-policy"]).toContain(
    "script-src 'self'",
  );
  expect(response.headers()["permissions-policy"]).toContain(
    "bluetooth=(self)",
  );
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  const version = await request.get("/version.json");
  expect(version.status()).toBe(200);
  expect((await version.json()).commit).toMatch(/^[a-f0-9]{40}$/);
  await page.goto("/");
  await expect(
    page.getByRole("navigation", { name: "Hoofdnavigatie" }),
  ).toBeVisible();
  await expect(page.locator("canvas").first()).toBeVisible();
  await page.getByRole("button", { name: "Adreslabels", exact: true }).click();
  await page.getByRole("button", { name: "BoxCare-logo", exact: true }).click();
  await expect(page.getByLabel("Grootte · 100%")).toBeVisible();
  expect(errors).toEqual([]);
});
