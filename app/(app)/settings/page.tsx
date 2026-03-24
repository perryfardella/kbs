"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { useClerk } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(month: number): number {
  return new Date(2000, month, 0).getDate();
}

const selectClass = "h-11 rounded-2xl border border-border bg-surface px-3 text-text-primary focus:outline-none focus:border-accent appearance-none";

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
          <FormField label="Owner Name">
            <Input
              type="text"
              inputMode="text"
              autoComplete="name"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              required
            />
          </FormField>

          <FormField label="Company Name">
            <Input
              type="text"
              inputMode="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </FormField>

          <FormField label="Fiscal Year End">
            <div className="flex gap-3">
              <select
                value={fiscalMonth}
                onChange={(e) => setFiscalMonth(Number(e.target.value))}
                className={`flex-1 ${selectClass}`}
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
                className={`w-24 ${selectClass}`}
              >
                {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </FormField>

          <FormField label="Currency">
            <div className="h-11 rounded-2xl border border-border bg-surface px-4 flex items-center text-text-muted select-none">
              CAD
            </div>
          </FormField>

          <div className="flex flex-col gap-1.5">
            <Label>
              Loan Alert Threshold{" "}
              <span className="text-text-muted font-normal">(optional)</span>
            </Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted text-sm pointer-events-none">
                $
              </span>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={loanAlertThreshold}
                onChange={(e) => setLoanAlertThreshold(e.target.value)}
                placeholder="e.g. 10000"
                className="pl-8"
              />
            </div>
            <p className="text-xs text-text-muted">
              Shows a dashboard banner when the loan balance exceeds this amount
            </p>
          </div>

          {error && (
            <Alert variant="negative">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : saved ? "Saved!" : "Save Settings"}
          </Button>
        </form>
      )}

      {/* Categories Link */}
      <Button variant="secondary" size="sm" className="w-full justify-between px-4" asChild>
        <Link href="/settings/categories">
          <span className="text-text-primary font-medium">Manage Categories</span>
          <ChevronRight size={18} className="text-text-muted" />
        </Link>
      </Button>

      {/* Sign Out */}
      <div className="pt-2 pb-2">
        {!showSignOutConfirm ? (
          <Button variant="destructive" onClick={() => setShowSignOutConfirm(true)}>
            Sign Out
          </Button>
        ) : (
          <Card className="p-4 space-y-3 border-negative/30 bg-negative/10">
            <p className="text-sm text-text-primary text-center">
              Are you sure you want to sign out?
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => setShowSignOutConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-negative text-white border-0"
                onClick={handleSignOut}
              >
                Sign Out
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
