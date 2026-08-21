import { expect, test } from "@playwright/test";
import { signIn } from "./auth";

// Distinctive marker so this test's own data is easy to find and clean up
// against the real dev dataset, and won't collide with anything else.
const DESCRIPTION = "E2E TEST — dividend declared vs paid";
const AMOUNT = "1234.56";
const DECLARED_DATE = "2026-01-10";
const PAID_DATE = "2026-02-15";

test("dividend declared on one date and paid on a later date splits into two loan ledger rows", async ({ page }) => {
  await signIn(page);

  // Add the dividend: transfer, business -> personal, marked as a dividend,
  // declared and paid on two different dates.
  await page.goto("/transactions?add=true");
  await page.getByRole("button", { name: "Transfer", exact: true }).click();
  await page.getByRole("button", { name: "Business → Personal" }).click();
  await page.getByRole("button", { name: "Mark as dividend" }).click();

  // The Amount input isn't wrapped in shadcn's <FormControl> (pre-existing, not part of
  // this change), so its <FormLabel> has no working htmlFor — target by placeholder instead.
  await page.getByPlaceholder("0.00").fill(AMOUNT);
  await page.getByLabel("Declared date").fill(DECLARED_DATE);
  await page.getByLabel("Paid date (optional)").fill(PAID_DATE);
  await page.getByLabel("Description").fill(DESCRIPTION);

  await page.getByRole("button", { name: "Save Transaction" }).click();
  await expect(page).toHaveURL("/transactions");

  try {
    // The loan ledger should show two rows: the declared leg (no cash moved) on the
    // declared date, and the paid leg (real cash movement) on the later paid date —
    // not a single row that nets to zero and hides the interim balance.
    await page.goto("/loan");
    const ledger = page.locator("body");
    await expect(ledger.getByText("$1,234.56 declared — no cash moved")).toBeVisible();
    await expect(ledger.getByText("$1,234.56 corp → you")).toBeVisible();
    await expect(ledger.getByText("Jan 10")).toBeVisible();
    await expect(ledger.getByText("Feb 15")).toBeVisible();
  } finally {
    // Clean up — this runs against the real dev dataset, don't leave test junk behind.
    await page.goto("/transactions");
    await page.getByPlaceholder("Search description or notes…").fill(DESCRIPTION);
    await page.getByRole("link", { name: new RegExp(DESCRIPTION) }).first().click();
    await page.getByRole("button", { name: "Delete transaction" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText(DESCRIPTION)).toHaveCount(0);
  }
});

test("recurring dividend rules never show a paid-date control", async ({ page }) => {
  await signIn(page);

  // A recurring rule always generates declared-only occurrences (see CONTEXT.md) — a
  // paid date only ever gets added later by editing a specific generated transaction,
  // never on the rule itself.
  await page.goto("/transactions?addRecurring=true");
  await page.getByRole("button", { name: "Transfer", exact: true }).click();
  await page.getByRole("button", { name: "Business → Personal" }).click();
  await page.getByRole("button", { name: "Mark as dividend" }).click();

  await expect(page.getByText("Paid date")).toHaveCount(0);
});

test("reports page renders the Loan tab without errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await signIn(page);
  await page.goto("/reports");
  await page.getByRole("tab", { name: "Loan" }).click();
  await expect(page.getByText("Opening Balance")).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
