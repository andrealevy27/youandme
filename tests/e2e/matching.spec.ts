import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("a founder reviews today's curated matches with explained compatibility", async ({ page }) => {
  await login(page, "lisa@demo.youandme.app");
  await page.goto("/matches");
  await expect(page.getByRole("heading", { name: "Five people worth meeting." })).toBeVisible();
  const cards = page.locator("article");
  expect(await cards.count()).toBeGreaterThan(0);
  expect(await cards.count()).toBeLessThanOrEqual(5);
  await expect(cards.first().getByText(/% compatibility/)).toBeVisible();
  await expect(cards.first().getByText(/match because|Possible match/)).toBeVisible();
});

test("profile pages show context-aware actions and compatibility", async ({ page }) => {
  await login(page, "lisa@demo.youandme.app");
  await page.goto("/people/sarah-chen");
  await expect(page.getByRole("heading", { name: "Sarah Chen" })).toBeVisible();
  await expect(page.getByText("Your compatibility")).toBeVisible();
  await expect(page.getByRole("button", { name: /Interested/ }).first()).toBeVisible();
});
