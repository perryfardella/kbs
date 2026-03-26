"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { useClerk } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
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

const settingsSchema = z.object({
  ownerName: z.string().min(1, "Owner name is required"),
  companyName: z.string().min(1, "Company name is required"),
  fiscalMonth: z.number().int().min(1).max(12),
  fiscalDay: z.number().int().min(1).max(31),
  loanAlertThreshold: z.string().optional(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const router = useRouter();
  const { signOut } = useClerk();
  const settings = useQuery(api.settings.get);
  const upsertSettings = useMutation(api.settings.upsert);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      ownerName: "",
      companyName: "",
      fiscalMonth: 3,
      fiscalDay: 31,
      loanAlertThreshold: "",
    },
  });

  useEffect(() => {
    if (!initialized && settings) {
      const [mm, dd] = settings.fiscalYearEnd.split("-").map(Number);
      form.reset({
        ownerName: settings.ownerName,
        companyName: settings.companyName,
        fiscalMonth: mm,
        fiscalDay: dd,
        loanAlertThreshold:
          settings.loanAlertThreshold != null
            ? String(settings.loanAlertThreshold)
            : "",
      });
      setInitialized(true);
    }
  }, [settings, initialized, form]);

  const fiscalMonth = form.watch("fiscalMonth");
  useEffect(() => {
    const maxDay = getDaysInMonth(fiscalMonth);
    const currentDay = form.getValues("fiscalDay");
    if (currentDay > maxDay) form.setValue("fiscalDay", maxDay);
  }, [fiscalMonth, form]);

  async function handleSave(data: SettingsFormValues) {
    setSaving(true);
    setError(null);
    try {
      const mm = String(data.fiscalMonth).padStart(2, "0");
      const dd = String(data.fiscalDay).padStart(2, "0");
      const threshold =
        data.loanAlertThreshold?.trim() !== ""
          ? Number(data.loanAlertThreshold)
          : undefined;
      await upsertSettings({
        ownerName: data.ownerName.trim(),
        companyName: data.companyName.trim(),
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
            <FormField
              control={form.control}
              name="ownerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel variant="muted">Owner Name</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      inputMode="text"
                      autoComplete="name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel variant="muted">Company Name</FormLabel>
                  <FormControl>
                    <Input type="text" inputMode="text" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel variant="muted">Fiscal Year End</FormLabel>
              <div className="flex gap-3">
                <FormField
                  control={form.control}
                  name="fiscalMonth"
                  render={({ field }) => (
                    <select
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      className={`flex-1 ${selectClass}`}
                    >
                      {MONTHS.map((name, i) => (
                        <option key={i + 1} value={i + 1}>
                          {name}
                        </option>
                      ))}
                    </select>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fiscalDay"
                  render={({ field }) => (
                    <select
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      className={`w-24 ${selectClass}`}
                    >
                      {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  )}
                />
              </div>
            </FormItem>

            <FormItem>
              <FormLabel variant="muted">Currency</FormLabel>
              <div className="h-11 rounded-2xl border border-border bg-surface px-4 flex items-center text-text-muted select-none">
                CAD
              </div>
            </FormItem>

            <FormField
              control={form.control}
              name="loanAlertThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Loan Alert Threshold{" "}
                    <span className="text-text-muted font-normal">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted text-sm pointer-events-none">
                        $
                      </span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        placeholder="e.g. 10000"
                        className="pl-8"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Shows a dashboard banner when the loan balance exceeds this amount
                  </FormDescription>
                </FormItem>
              )}
            />

            {error && (
              <Alert variant="negative">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : saved ? "Saved!" : "Save Settings"}
            </Button>
          </form>
        </Form>
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
