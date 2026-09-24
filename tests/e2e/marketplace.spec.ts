import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("a founder books a consultant session (dev payment mode)", async ({ page }) => {
  await login(page, "lisa@demo.youandme.app");
  await page.goto("/consultants?category=growth");
  await expect(page.getByRole("link", { name: /Maya Goldberg/ }).first()).toBeVisible();
  await page.goto("/consultants/maya-goldberg");
  // Production builds refuse the dev payment provider: without Stripe, booking must be honestly unavailable.
  const unavailable = page.getByText(/Online payments aren't set up/);
  if (await unavailable.isVisible()) {
    await expect(page.getByRole("link", { name: /^Book/ })).toHaveCount(0);
    test.info().annotations.push({ type: "skip-reason", description: "Payments not configured in this mode (run against `npm run dev` with PAYMENTS_PROVIDER=dev)." });
    return;
  }
  await page.getByRole("link", { name: /Book/ }).first().click();
  await expect(page).toHaveURL(/\/book\//);

  const next = () => page.getByRole("button", { name: /Continue/ }).click();
  await next(); // service
  await page.getByRole("radiogroup", { name: "Start time" }).getByRole("radio").first().click();
  await next(); // time
  await page.getByLabel(/What do you want to get out of this session/).fill("E2E: help us plan our waitlist activation.");
  await next(); // context
  await next(); // team
  await page.getByRole("button", { name: /Confirm test booking/ }).click();
  await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]{36}/, { timeout: 20_000 });
  await expect(page.getByText("Confirmed").first()).toBeVisible();
});

test("members can message each other; the thread updates", async ({ page }) => {
  await login(page, "lisa@demo.youandme.app");
  await page.goto("/people/marcus-adeyemi");
  await page.getByRole("button", { name: /Message Marcus/ }).click();
  await expect(page).toHaveURL(/\/messages\/[0-9a-f-]{36}/);
  const text = `Hello from e2e ${Date.now()}`;
  const box = page.getByRole("textbox").last();
  await box.fill(text);
  await box.press("Enter");
  await expect(page.getByText(text)).toBeVisible();
});
