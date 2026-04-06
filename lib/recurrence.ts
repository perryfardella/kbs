import { addDays, addMonths, format, parseISO, getDay, isBefore, isAfter } from "date-fns";

export type RecurrenceFrequency = "weekly" | "biweekly" | "monthly" | "yearly";

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  // weekly/biweekly: 0–6 (day of week, 0=Sun); monthly: 1–31 (day of month)
  anchorDay?: number;
  // yearly only: "MM-DD"
  anchorDate?: string;
  startDate: string; // "YYYY-MM-DD"
  endDate?: string; // "YYYY-MM-DD" (optional)
}

export interface ComputedOccurrence {
  date: string; // "YYYY-MM-DD"
}

function toDateStr(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Returns the Date for day `targetDay` (1–31) in the given year/month, clamped to the last valid day. */
function clampedMonthDate(year: number, month: number, targetDay: number): Date {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(targetDay, daysInMonth));
}

/**
 * Computes occurrences for a recurring rule.
 *
 * @param rule - The recurrence rule
 * @param fromDate - Only return occurrences on or after this date ("YYYY-MM-DD")
 * @param limit - Maximum number of occurrences to return
 */
export function computeOccurrences(
  rule: RecurrenceRule,
  fromDate: string,
  limit: number
): ComputedOccurrence[] {
  const results: ComputedOccurrence[] = [];
  const from = parseISO(fromDate);
  const start = parseISO(rule.startDate);
  const end = rule.endDate ? parseISO(rule.endDate) : null;

  // The effective start is the later of fromDate and startDate
  const effectiveFrom = isBefore(from, start) ? start : from;

  if (rule.frequency === "weekly") {
    const targetDow = rule.anchorDay ?? getDay(start); // 0=Sun … 6=Sat

    // Find first occurrence on or after effectiveFrom that falls on targetDow
    let current = new Date(effectiveFrom);
    const dayDiff = (targetDow - getDay(current) + 7) % 7;
    current = addDays(current, dayDiff);

    // Also ensure it's not before startDate
    if (isBefore(current, start)) current = addDays(current, 7);

    while (results.length < limit) {
      if (end && isAfter(current, end)) break;
      results.push({ date: toDateStr(current) });
      current = addDays(current, 7);
    }
  } else if (rule.frequency === "biweekly") {
    // Sequence is anchored to startDate; advance by 14 days
    let current = new Date(start);

    // Advance until we're at or past effectiveFrom, in 14-day steps
    while (isBefore(current, effectiveFrom)) {
      current = addDays(current, 14);
    }

    while (results.length < limit) {
      if (end && isAfter(current, end)) break;
      results.push({ date: toDateStr(current) });
      current = addDays(current, 14);
    }
  } else if (rule.frequency === "monthly") {
    const targetDay = rule.anchorDay ?? start.getDate();

    // Scan month by month starting from effectiveFrom's month
    let monthStart = new Date(effectiveFrom.getFullYear(), effectiveFrom.getMonth(), 1);

    while (results.length < limit) {
      const candidate = clampedMonthDate(
        monthStart.getFullYear(),
        monthStart.getMonth(),
        targetDay
      );

      if (end && isAfter(candidate, end)) break;

      if (!isBefore(candidate, start) && !isBefore(candidate, effectiveFrom)) {
        results.push({ date: toDateStr(candidate) });
      }

      monthStart = addMonths(monthStart, 1);
    }
  } else if (rule.frequency === "yearly") {
    const anchor = rule.anchorDate ?? format(start, "MM-dd");
    const [mm, dd] = anchor.split("-").map(Number);

    let year = effectiveFrom.getFullYear();

    while (results.length < limit) {
      const candidate = clampedMonthDate(year, mm - 1, dd);
      if (end && isAfter(candidate, end)) break;

      if (!isBefore(candidate, start) && !isBefore(candidate, effectiveFrom)) {
        results.push({ date: toDateStr(candidate) });
      }

      year++;

      // Safety: don't project more than 50 years ahead
      if (year > effectiveFrom.getFullYear() + 50) break;
    }
  }

  return results;
}

function ordinalSuffix(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  switch (n % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

/** Returns a human-readable label for a recurrence rule, e.g. "Monthly on the 1st". */
export function recurrenceLabel(rule: RecurrenceRule): string {
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  switch (rule.frequency) {
    case "weekly": {
      const start = parseISO(rule.startDate);
      const dow = rule.anchorDay ?? getDay(start);
      return `Weekly on ${DAY_NAMES[dow]}`;
    }
    case "biweekly": {
      const start = parseISO(rule.startDate);
      const dow = getDay(start);
      return `Every 2 weeks on ${DAY_NAMES[dow]}`;
    }
    case "monthly": {
      const start = parseISO(rule.startDate);
      const day = rule.anchorDay ?? start.getDate();
      return `Monthly on the ${day}${ordinalSuffix(day)}`;
    }
    case "yearly": {
      const start = parseISO(rule.startDate);
      const anchor = rule.anchorDate ?? format(start, "MM-dd");
      const [mm, dd] = anchor.split("-").map(Number);
      return `Yearly on ${MONTH_NAMES[mm - 1]} ${dd}${ordinalSuffix(dd)}`;
    }
  }
}
