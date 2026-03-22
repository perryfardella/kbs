"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(month: number): number {
  // Use a leap year (2000) to get max days for each month
  return new Date(2000, month, 0).getDate();
}

export default function OnboardingPage() {
  const router = useRouter();
  const settings = useQuery(api.settings.get);
  const upsertSettings = useMutation(api.settings.upsert);
  const seedCategories = useMutation(api.categories.seedDefaults);

  const [ownerName, setOwnerName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [fiscalMonth, setFiscalMonth] = useState(3); // March default
  const [fiscalDay, setFiscalDay] = useState(31);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if settings already exist
  useEffect(() => {
    if (settings !== undefined && settings !== null) {
      router.replace("/");
    }
  }, [settings, router]);

  // Clamp day when month changes
  useEffect(() => {
    const maxDay = getDaysInMonth(fiscalMonth);
    if (fiscalDay > maxDay) setFiscalDay(maxDay);
  }, [fiscalMonth, fiscalDay]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerName.trim() || !companyName.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const mm = String(fiscalMonth).padStart(2, "0");
      const dd = String(fiscalDay).padStart(2, "0");
      await upsertSettings({
        ownerName: ownerName.trim(),
        companyName: companyName.trim(),
        fiscalYearEnd: `${mm}-${dd}`,
      });
      await seedCategories({});
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  // Show nothing while checking if settings exist
  if (settings === undefined) {
    return null;
  }

  const maxDay = getDaysInMonth(fiscalMonth);

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl font-semibold text-accent">KBS</h1>
        <p className="mt-1 text-sm text-text-muted">Let&apos;s get you set up</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ownerName" className="text-sm font-medium text-text-primary">
            Your Name
          </label>
          <input
            id="ownerName"
            type="text"
            inputMode="text"
            autoComplete="name"
            placeholder="e.g. Karina Smith"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            required
            className="h-11 rounded-2xl border border-border bg-surface px-4 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="companyName" className="text-sm font-medium text-text-primary">
            Company Name
          </label>
          <input
            id="companyName"
            type="text"
            inputMode="text"
            placeholder="e.g. Karina Smith NP Corp"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
            className="h-11 rounded-2xl border border-border bg-surface px-4 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-primary">
            Fiscal Year End
          </label>
          <div className="flex gap-3">
            <select
              value={fiscalMonth}
              onChange={(e) => setFiscalMonth(Number(e.target.value))}
              className="h-11 flex-1 rounded-2xl border border-border bg-surface px-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              {MONTHS.map((name, i) => (
                <option key={i + 1} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={fiscalDay}
              onChange={(e) => setFiscalDay(Number(e.target.value))}
              className="h-11 w-24 rounded-2xl border border-border bg-surface px-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-text-muted">
            Used to compute the default date range on reports
          </p>
        </div>

        {error && (
          <p className="rounded-2xl border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !ownerName.trim() || !companyName.trim()}
          className="mt-2 h-12 w-full rounded-2xl bg-accent font-medium text-bg transition-colors active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Setting up…" : "Get Started"}
        </button>
      </form>
    </div>
  );
}
