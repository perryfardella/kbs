import { setupClerkTestingToken } from "@clerk/testing/playwright";
import type { Page } from "@playwright/test";

export async function signIn(page: Page) {
  const email = process.env.E2E_CLERK_USER_EMAIL;
  const password = process.env.E2E_CLERK_USER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Set E2E_CLERK_USER_EMAIL and E2E_CLERK_USER_PASSWORD in .env.local to run e2e tests.",
    );
  }

  await setupClerkTestingToken({ page });
  await page.goto("/login");
  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: /continue/i }).click();

  // Dev-instance +clerk_test emails require a second-factor email code,
  // which Clerk always accepts as 424242 in test mode.
  const wentToFactorTwo = await page
    .waitForURL(/factor-two/, { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  if (wentToFactorTwo) {
    const codeInput = page.getByRole("textbox", { name: /verification code/i });
    await codeInput.waitFor({ state: "visible" });
    // The OTP widget is a multi-box input; fill() doesn't propagate to each
    // box correctly, so type it key-by-key. Auto-submits once all 6 are in.
    await codeInput.pressSequentially("424242", { delay: 100 });
  }

  await page.waitForURL("/", { timeout: 15_000 });
}
