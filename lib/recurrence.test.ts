import { test } from "node:test";
import assert from "node:assert/strict";
import { computeOccurrences, quarterlyMonths, recurrenceLabel, type RecurrenceRule } from "./recurrence.ts";

const dates = (rule: RecurrenceRule, from: string, limit: number) =>
  computeOccurrences(rule, from, limit).map((o) => o.date);

const q = (startDate: string, extra: Partial<RecurrenceRule> = {}): RecurrenceRule => ({
  frequency: "quarterly",
  startDate,
  ...extra,
});

test("quarterly repeats every 3 months from the start month", () => {
  assert.deepEqual(dates(q("2026-03-15"), "2026-01-01", 5), [
    "2026-03-15", "2026-06-15", "2026-09-15", "2026-12-15", "2027-03-15",
  ]);
});

// The phase must come from startDate, not from the caller's fromDate: autoApplyDue passes
// max(start, today-60) and the dashboard passes today, and both must agree on the dates.
test("phase is independent of fromDate", () => {
  const rule = q("2026-03-15");
  const expected = ["2026-06-15", "2026-09-15", "2026-12-15", "2027-03-15"];
  for (const from of ["2026-04-01", "2026-05-20", "2026-06-01", "2026-06-15", "2026-06-16"]) {
    const got = dates(rule, from, 4);
    const want = from > "2026-06-15" ? ["2026-09-15", "2026-12-15", "2027-03-15", "2027-06-15"] : expected;
    assert.deepEqual(got, want, from);
  }
  // Starting scan in a non-phase month (Jul) still lands on the Sep occurrence.
  assert.equal(dates(rule, "2026-07-01", 1)[0], "2026-09-15");
});

test("anchorDay overrides the start date's day, and occurrences never precede the start", () => {
  assert.deepEqual(dates(q("2026-03-10", { anchorDay: 15 }), "2026-01-01", 2), ["2026-03-15", "2026-06-15"]);
  // Start after this quarter's anchor day: first occurrence is the next quarter.
  assert.deepEqual(dates(q("2026-03-20", { anchorDay: 15 }), "2026-01-01", 2), ["2026-06-15", "2026-09-15"]);
});

test("day 31 clamps to the month's last day", () => {
  assert.deepEqual(dates(q("2026-11-30", { anchorDay: 31 }), "2026-01-01", 4), [
    "2026-11-30", "2027-02-28", "2027-05-31", "2027-08-31",
  ]);
});

test("endDate stops the sequence", () => {
  assert.deepEqual(dates(q("2026-03-15", { endDate: "2026-12-14" }), "2026-01-01", 10), [
    "2026-03-15", "2026-06-15", "2026-09-15",
  ]);
});

test("monthly is unchanged", () => {
  assert.deepEqual(dates({ frequency: "monthly", startDate: "2026-01-31" }, "2026-01-01", 3), [
    "2026-01-31", "2026-02-28", "2026-03-31",
  ]);
});

test("labels", () => {
  assert.equal(quarterlyMonths("2026-03-15"), "Mar, Jun, Sep, Dec");
  assert.equal(quarterlyMonths("2026-11-30"), "Feb, May, Aug, Nov");
  assert.equal(quarterlyMonths("nope"), null);
  assert.equal(recurrenceLabel(q("2026-03-15")), "Quarterly on the 15th (Mar, Jun, Sep, Dec)");
});

test("invalid dates return nothing instead of looping forever", () => {
  for (const frequency of ["weekly", "biweekly", "monthly", "quarterly", "yearly"] as const) {
    assert.deepEqual(dates({ frequency, startDate: "" }, "2026-01-01", 5), [], `${frequency} bad startDate`);
    assert.deepEqual(dates({ frequency, startDate: "2026-01-01" }, "nope", 5), [], `${frequency} bad fromDate`);
  }
});

test("monthly: more cases pinned (anchor day, endDate, fromDate after start)", () => {
  assert.deepEqual(dates({ frequency: "monthly", startDate: "2026-01-10", anchorDay: 29 }, "2026-01-01", 3), [
    "2026-01-29", "2026-02-28", "2026-03-29",
  ]);
  assert.deepEqual(dates({ frequency: "monthly", startDate: "2026-01-15", endDate: "2026-03-14" }, "2026-01-01", 10), [
    "2026-01-15", "2026-02-15",
  ]);
  assert.deepEqual(dates({ frequency: "monthly", startDate: "2026-01-15" }, "2026-02-16", 2), ["2026-03-15", "2026-04-15"]);
  assert.deepEqual(dates({ frequency: "monthly", startDate: "2026-01-15" }, "2025-06-01", 1), ["2026-01-15"]);
});
