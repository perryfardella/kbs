import { addDays, format, startOfDay } from "date-fns";

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

/**
 * Current fiscal year (inclusive "YYYY-MM-DD" bounds, local dates) for a "MM-DD" fiscal year end.
 * The last day of a fiscal year still belongs to that year, not the next one.
 */
export function computeFiscalYear(fiscalYearEnd: string, today: Date = new Date()): { startDate: string; endDate: string } {
  const [endMonth, endDay] = fiscalYearEnd.split("-").map(Number);
  const day = startOfDay(today);
  const year = day.getFullYear();
  // This calendar year's end falls on or after today => we're in the year that ends this year.
  const endYear = day <= new Date(year, endMonth - 1, endDay) ? year : year + 1;
  return {
    startDate: ymd(addDays(new Date(endYear - 1, endMonth - 1, endDay), 1)),
    endDate: ymd(new Date(endYear, endMonth - 1, endDay)),
  };
}
