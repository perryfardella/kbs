"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(month: number): number {
  return new Date(2000, month, 0).getDate();
}

const onboardingSchema = z.object({
  ownerName: z.string().min(1, "Your name is required"),
  companyName: z.string().min(1, "Company name is required"),
  fiscalMonth: z.number().int().min(1).max(12),
  fiscalDay: z.number().int().min(1).max(31),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

export default function OnboardingPage() {
  const router = useRouter();
  const settings = useQuery(api.settings.get);
  const upsertSettings = useMutation(api.settings.upsert);
  const seedCategories = useMutation(api.categories.seedDefaults);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    mode: "onChange",
    defaultValues: {
      ownerName: "",
      companyName: "",
      fiscalMonth: 3,
      fiscalDay: 31,
    },
  });

  // Redirect if settings already exist
  useEffect(() => {
    if (settings !== undefined && settings !== null) {
      router.replace("/");
    }
  }, [settings, router]);

  // Clamp day when month changes
  const fiscalMonth = form.watch("fiscalMonth");
  useEffect(() => {
    const maxDay = getDaysInMonth(fiscalMonth);
    const currentDay = form.getValues("fiscalDay");
    if (currentDay > maxDay) form.setValue("fiscalDay", maxDay);
  }, [fiscalMonth, form]);

  async function handleSubmit(data: OnboardingFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const mm = String(data.fiscalMonth).padStart(2, "0");
      const dd = String(data.fiscalDay).padStart(2, "0");
      await upsertSettings({
        ownerName: data.ownerName.trim(),
        companyName: data.companyName.trim(),
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

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-5">
          <FormField
            control={form.control}
            name="ownerName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Your Name</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    inputMode="text"
                    autoComplete="name"
                    placeholder="e.g. Karina Smith"
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
                <FormLabel>Company Name</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    inputMode="text"
                    placeholder="e.g. Karina Smith NP Corp"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormItem>
            <FormLabel>Fiscal Year End</FormLabel>
            <div className="flex gap-3">
              <FormField
                control={form.control}
                name="fiscalMonth"
                render={({ field }) => (
                  <select
                    value={field.value}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    className="h-11 flex-1 rounded-2xl border border-border bg-surface px-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
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
                    className="h-11 w-24 rounded-2xl border border-border bg-surface px-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
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
            <FormDescription>
              Used to compute the default date range on reports
            </FormDescription>
          </FormItem>

          {error && (
            <p className="rounded-2xl border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !form.formState.isValid}
            className="mt-2 h-12 w-full rounded-2xl bg-accent font-medium text-bg transition-colors active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Setting up…" : "Get Started"}
          </button>
        </form>
      </Form>
    </div>
  );
}
