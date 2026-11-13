import { addDays, format, startOfDay } from "date-fns";

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

/**
 * Current fiscal year (inclusive "YYYY-MM-DD" bounds, local dates) for a "MM-DD" fiscal year end.
 * The last day of a fiscal year still belongs to that year, not the next one.
 */
export function computeFiscalYear(fiscalYearEnd: string, today: Date = new Date()): { startDate: string; endDate: string } {
  const [endMonth, endDay] = fiscalYearEnd.split("-").map(Number);
  // Clamp so a "02-29" year end lands on Feb 28 in a non-leap year instead of rolling into March.
  const endOf = (y: number) => new Date(y, endMonth - 1, Math.min(endDay, new Date(y, endMonth, 0).getDate()));
  const day = startOfDay(today);
  const year = day.getFullYear();
  // This calendar year's end falls on or after today => we're in the year that ends this year.
  const endYear = day <= endOf(year) ? year : year + 1;
  return {
    startDate: ymd(addDays(endOf(endYear - 1), 1)),
    endDate: ymd(endOf(endYear)),
  };
}
