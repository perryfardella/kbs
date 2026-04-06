import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run at 8:00 AM UTC daily — auto-applies any recurring transactions whose date has passed
crons.daily(
  "auto-apply due recurring transactions",
  { hourUTC: 8, minuteUTC: 0 },
  internal.recurringTransactions.autoApplyDue,
);

export default crons;
