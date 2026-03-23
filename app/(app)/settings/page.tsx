"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { useClerk } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/Skeleton";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(month: number): number {
  return new Date(2000, month, 0).getDate();
}

export default function SettingsPage() {
  const router = useRouter();
  const { signOut } = useClerk();
  const settings = useQuery(api.settings.get);
  const upsertSettings = useMutation(api.settings.upsert);

  const [ownerName, setOwnerName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [fiscalMonth, setFiscalMonth] = useState(3);
  const [fiscalDay, setFiscalDay] = useState(31);
  const [loanAlertThreshold, setLoanAlertThreshold] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && settings) {
      setOwnerName(settings.ownerName);
      setCompanyName(settings.companyName);
      const [mm, dd] = settings.fiscalYearEnd.split("-").map(Number);
      setFiscalMonth(mm);
      setFiscalDay(dd);
      setLoanAlertThreshold(
        settings.loanAlertThreshold != null
          ? String(settings.loanAlertThreshold)
          : ""
      );
      setInitialized(true);
    }
  }, [settings, initialized]);

  // Clamp day when month changes
  useEffect(() => {
    const maxDay = getDaysInMonth(fiscalMonth);
    if (fiscalDay > maxDay) setFiscalDay(maxDay);
  }, [fiscalMonth, fiscalDay]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerName.trim() || !companyName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const mm = String(fiscalMonth).padStart(2, "0");
      const dd = String(fiscalDay).padStart(2, "0");
      const threshold =
        loanAlertThreshold.trim() !== ""
          ? Number(loanAlertThreshold)
          : undefined;
      await upsertSettings({
        ownerName: ownerName.trim(),
        companyName: companyName.trim(),
        fiscalYearEnd: `${mm}-${dd}`,
        loanAlertThreshold: threshold,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  const isLoading = settings === undefined;
  const maxDay = getDaysInMonth(fiscalMonth);

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-5">
      <h1 className="font-display text-2xl font-semibold text-text-primary">
        Settings
      </h1>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-11 w-full rounded-2xl" />
          <Skeleton className="h-11 w-full rounded-2xl" />
          <Skeleton className="h-11 w-full rounded-2xl" />
          <Skeleton className="h-11 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">
              Owner Name
            </label>
            <input
              type="text"
              inputMode="text"
              autoComplete="name"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              required
              className="h-11 rounded-2xl border border-border bg-surface px-4 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">
              Company Name
            </label>
            <input
              type="text"
              inputMode="text"
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
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">
              Currency
            </label>
            <div className="h-11 rounded-2xl border border-border bg-surface px-4 flex items-center text-text-muted select-none">
              CAD
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">
              Loan Alert Threshold{" "}
              <span className="text-text-muted font-normal">(optional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted text-sm pointer-events-none">
                $
              </span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={loanAlertThreshold}
                onChange={(e) => setLoanAlertThreshold(e.target.value)}
                placeholder="e.g. 10000"
                className="h-11 w-full rounded-2xl border border-border bg-surface pl-8 pr-4 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
            <p className="text-xs text-text-muted">
              Shows a dashboard banner when the loan balance exceeds this amount
            </p>
          </div>

          {error && (
            <p className="rounded-2xl border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="h-12 w-full rounded-2xl bg-accent font-medium text-bg transition-colors active:scale-95 disabled:opacity-50"
          >
            {saving ? "Saving…" : saved ? "Saved!" : "Save Settings"}
          </button>
        </form>
      )}

      {/* Categories Link */}
      <Link
        href="/settings/categories"
        className="flex items-center justify-between rounded-2xl border border-[#1f1f1f] bg-[#141414] px-4 py-4 active:scale-95 transition-transform"
      >
        <span className="text-text-primary font-medium">Manage Categories</span>
        <ChevronRight size={18} className="text-text-muted" />
      </Link>

      {/* Sign Out */}
      <div className="pt-2 pb-2">
        {!showSignOutConfirm ? (
          <button
            onClick={() => setShowSignOutConfirm(true)}
            className="w-full rounded-2xl border border-negative/30 bg-negative/10 py-4 text-negative font-medium active:scale-95 transition-transform"
          >
            Sign Out
          </button>
        ) : (
          <div className="rounded-2xl border border-negative/30 bg-negative/10 p-4 space-y-3">
            <p className="text-sm text-text-primary text-center">
              Are you sure you want to sign out?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSignOutConfirm(false)}
                className="flex-1 rounded-2xl border border-[#1f1f1f] bg-[#141414] py-3 text-text-muted font-medium active:scale-95 transition-transform"
              >
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                className="flex-1 rounded-2xl bg-negative py-3 text-white font-medium active:scale-95 transition-transform"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
