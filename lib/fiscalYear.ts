/** Current fiscal year (inclusive "YYYY-MM-DD" bounds) for a "MM-DD" fiscal year end. */
export function computeFiscalYear(fiscalYearEnd: string, today: Date = new Date()): { startDate: string; endDate: string } {
  const [endMonth, endDay] = fiscalYearEnd.split("-").map(Number);
  const todayYear = today.getFullYear();
  const thisYearEnd = new Date(todayYear, endMonth - 1, endDay);

  if (today <= thisYearEnd) {
    const endDate = `${todayYear}-${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
    const prevEnd = new Date(todayYear - 1, endMonth - 1, endDay);
    const startObj = new Date(prevEnd);
    startObj.setDate(startObj.getDate() + 1);
    return { startDate: startObj.toISOString().slice(0, 10), endDate };
  } else {
    const startObj = new Date(thisYearEnd);
    startObj.setDate(startObj.getDate() + 1);
    const endDate = `${todayYear + 1}-${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
    return { startDate: startObj.toISOString().slice(0, 10), endDate };
  }
}
