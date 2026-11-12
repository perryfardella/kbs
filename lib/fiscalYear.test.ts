import { test } from "node:test";
import assert from "node:assert/strict";
import { computeFiscalYear } from "./fiscalYear.ts";

// Local-time dates: the function works in the user's local calendar.
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

test("mid fiscal year", () => {
  assert.deepEqual(computeFiscalYear("06-30", at(2026, 3, 15)), { startDate: "2025-07-01", endDate: "2026-06-30" });
});

test("the last day of the fiscal year still belongs to that year (any time of day)", () => {
  for (const h of [0, 12, 23]) {
    assert.deepEqual(computeFiscalYear("06-30", at(2026, 6, 30, h)), { startDate: "2025-07-01", endDate: "2026-06-30" });
  }
});

test("the day after rolls into the next fiscal year", () => {
  assert.deepEqual(computeFiscalYear("06-30", at(2026, 7, 1)), { startDate: "2026-07-01", endDate: "2027-06-30" });
});

test("calendar-year fiscal end", () => {
  assert.deepEqual(computeFiscalYear("12-31", at(2026, 12, 31)), { startDate: "2026-01-01", endDate: "2026-12-31" });
  assert.deepEqual(computeFiscalYear("12-31", at(2026, 1, 1)), { startDate: "2026-01-01", endDate: "2026-12-31" });
});
