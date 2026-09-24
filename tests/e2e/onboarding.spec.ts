import { expect, test } from "@playwright/test";
import { uniqueEmail } from "./helpers";

test("a new founder signs up, onboards and lands on a personalised home", async ({ page }) => {
  const email = uniqueEmail("founder");
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Robin Founder");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-strong-password-1");
  await page.getByRole("button", { name: /create account|join/i }).click();
  await expect(page).toHaveURL(/\/onboarding/);

  const next = () => page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("checkbox", { name: /building a startup/i }).click();
  await next();
  await page.getByLabel("Headline").fill("Building tools for clinics");
  await next();
  await page.getByLabel("City").fill("Boston");
  await page.getByLabel("Country").fill("United States");
  await next();
  await page.getByLabel("Current role").fill("Founder");
  await next();
  await page.getByRole("button", { name: "Go-to-market" }).click();
  await page.getByRole("button", { name: "Operations" }).click();
  await next();
  await page.getByRole("button", { name: "Health" }).click();
  await next();
  await page.getByRole("radio", { name: /let's add it/i }).click();
  await next();
  await page.getByLabel("What are you building").fill("Scheduling that clinics actually enjoy");
  await next();
  await page.getByLabel("Startup name").fill(`ClinicFlow ${Date.now() % 10000}`);
  await next();
  await page.getByRole("radio", { name: /Validation/ }).click();
  await next();
  await page.getByRole("button", { name: "Just me" }).click();
  await next();
  await page.getByRole("radio", { name: "Yes" }).click();
  await page.getByRole("button", { name: "Technical" }).click();
  await next();
  await page.getByRole("button", { name: "Skip" }).click(); // missing skills
  await page.getByRole("button", { name: "Growth" }).first().click(); // help
  await next();
  await page.getByRole("radio", { name: "Full-time now" }).click();
  await page.getByRole("button", { name: "40+ hrs / week" }).click();
  await next();
  await page.getByRole("radio", { name: "Remote" }).click();
  await next();
  await page.getByRole("radio", { name: "Venture-scale company" }).click();
  await next();
  await page.getByRole("radio", { name: "First-time founder" }).click();
  await next();
  await page.getByRole("button", { name: "Skip" }).click(); // looking for (optional)
  await page.getByRole("button", { name: "Do it later" }).click();

  await expect(page).toHaveURL(/\/home/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Robin");
  await expect(page.getByText("Today's matches")).toBeVisible();
});
