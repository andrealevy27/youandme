import { expect, test } from "@playwright/test";

test("landing page presents the product and routes to signup @mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Build the team behind your startup");
  await page.getByRole("link", { name: "Join You&Me" }).first().click();
  await expect(page).toHaveURL(/\/signup/);
});

test("protected pages redirect signed-out visitors to login", async ({ page }) => {
  for (const path of ["/home", "/matches", "/messages", "/admin"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }
});

test("unauthenticated API calls are rejected", async ({ request }) => {
  const res = await request.get("/api/v1/me/export");
  expect(res.status()).toBe(401);
  const convo = await request.get("/api/v1/conversations");
  expect(convo.status()).toBe(401);
});
