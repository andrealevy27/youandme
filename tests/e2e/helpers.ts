import { expect, type Page } from "@playwright/test";

export const DEMO_PASSWORD = "demo-password-123";

export async function login(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/home/);
}

export function uniqueEmail(prefix = "e2e") {
  return `${prefix}+${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
}
