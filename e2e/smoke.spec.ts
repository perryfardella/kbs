import { expect, test } from "@playwright/test";
import { signIn } from "./auth";

test("signed-in user can reach the dashboard", async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL("/");
});
