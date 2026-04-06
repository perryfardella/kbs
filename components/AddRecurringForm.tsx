"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  recurringTransactionSchema,
  type RecurringTransactionFormValues,
} from "@/app/(app)/transactions/recurringTransactionSchema";

type TransactionType =
  | "personal_expense"
  | "business_expense"
  | "business_expense_personal_pay"
  | "personal_expense_business_pay"
  | "transfer_to_personal"
  | "transfer_to_business"
  | "dividend_payment";

type CategoryRealm = "personal" | "business" | null;

const TYPE_OPTIONS: {
  value: TransactionType;
  label: string;
  tooltip?: string;
  categoryRealm: CategoryRealm;
}[] = [
  { value: "personal_expense",              label: "Personal Expense",                categoryRealm: "personal" },
  { value: "business_expense",              label: "Business Expense",                categoryRealm: "business" },
  { value: "business_expense_personal_pay", label: "Biz Expense (Personal Pay)",      tooltip: "I pay a business expense from my own pocket", categoryRealm: "business" },
  { value: "personal_expense_business_pay", label: "Personal Expense (Business Pay)", tooltip: "I pay a personal expense from the business account", categoryRealm: "personal" },
  { value: "transfer_to_personal",          label: "Corp → Me",                       categoryRealm: null },
  { value: "transfer_to_business",          label: "Me → Corp",                       categoryRealm: null },
  { value: "dividend_payment",              label: "Dividend / Repayment",            categoryRealm: null },
];

const FREQUENCY_OPTIONS = [
  { value: "weekly",   label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly",  label: "Monthly" },
  { value: "yearly",   label: "Yearly" },
] as const;

const DOW_OPTIONS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const MONTH_OPTIONS = [
  { value: 1, label: "Jan" }, { value: 2, label: "Feb" }, { value: 3, label: "Mar" },
  { value: 4, label: "Apr" }, { value: 5, label: "May" }, { value: 6, label: "Jun" },
  { value: 7, label: "Jul" }, { value: 8, label: "Aug" }, { value: 9, label: "Sep" },
  { value: 10, label: "Oct" }, { value: 11, label: "Nov" }, { value: 12, label: "Dec" },
];

function todayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

interface AddRecurringFormProps {
  isOpen: boolean;
  onSuccess: () => void;
}

export function AddRecurringForm({ isOpen, onSuccess }: AddRecurringFormProps) {
  const [saving, setSaving] = useState(false);

  const categories = useQuery(api.categories.list);
  const createRecurring = useMutation(api.recurringTransactions.create);

  const form = useForm<RecurringTransactionFormValues>({
    resolver: zodResolver(recurringTransactionSchema),
    defaultValues: {
      type: "personal_expense",
      amount: "",
      description: "",
      categoryId: "",
      notes: "",
      frequency: "monthly",
      anchorDay: undefined,
      anchorDate: undefined,
      startDate: todayString(),
      endDate: "",
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    setSaving(false);
    form.reset({
      type: "personal_expense",
      amount: "",
      description: "",
      categoryId: "",
      notes: "",
      frequency: "monthly",
      anchorDay: undefined,
      anchorDate: undefined,
      startDate: todayString(),
      endDate: "",
    });
    const timer = setTimeout(() => form.setFocus("amount"), 300);
    return () => clearTimeout(timer);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const transactionType = form.watch("type");
  const frequency = form.watch("frequency");
  const anchorDay = form.watch("anchorDay");
  const anchorDate = form.watch("anchorDate");

  const selectedOption = TYPE_OPTIONS.find((t) => t.value === transactionType)!;
  const showCategory = selectedOption.categoryRealm !== null;

  const filteredCategories = (categories ?? []).filter((cat) => {
    if (!showCategory) return false;
    const realm = selectedOption.categoryRealm;
    if (realm === "personal") return cat.realm === "personal" || cat.realm === "both";
    if (realm === "business") return cat.realm === "business" || cat.realm === "both";
    return false;
  });

  // Parse yearly anchorDate for display
  const yearlyMonth = anchorDate ? parseInt(anchorDate.split("-")[0]) : undefined;
  const yearlyDay = anchorDate ? parseInt(anchorDate.split("-")[1]) : undefined;

  async function handleSave(data: RecurringTransactionFormValues) {
    setSaving(true);
    try {
      await createRecurring({
        description: data.description.trim(),
        amount: parseFloat(data.amount),
        type: data.type,
        categoryId: data.categoryId ? (data.categoryId as Id<"categories">) : undefined,
        notes: data.notes?.trim() || undefined,
        frequency: data.frequency,
        anchorDay: data.anchorDay,
        anchorDate: data.anchorDate,
        startDate: data.startDate,
        endDate: data.endDate?.trim() || undefined,
      });
      toast.success("Recurring transaction saved");
      onSuccess();
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSave)}>
        <div className="px-4 pt-2 space-y-3 pb-2">
          {/* Type Selector */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-text-muted uppercase tracking-wide">
                  Type
                </label>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {TYPE_OPTIONS.map((opt) => (
                    <Toggle
                      key={opt.value}
                      pressed={field.value === opt.value}
                      onPressedChange={() => {
                        field.onChange(opt.value);
                        form.setValue("categoryId", "");
                      }}
                    >
                      {opt.label}
                    </Toggle>
                  ))}
                </div>
                {selectedOption.tooltip && (
                  <p className="flex items-start gap-1.5 text-xs text-text-muted leading-relaxed">
                    <Info size={12} className="mt-0.5 shrink-0" />
                    {selectedOption.tooltip}
                  </p>
                )}
              </div>
            )}
          />

          {/* Amount */}
          <FormField
            control={form.control}
            name="amount"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel variant="muted">Amount</FormLabel>
                <div className={`flex items-center gap-2 rounded-2xl border bg-surface px-4 py-2.5 ${fieldState.invalid ? "border-negative" : "border-border"}`}>
                  <span className="font-mono text-sm font-medium text-text-muted">CAD</span>
                  <input
                    {...field}
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="flex-1 min-w-0 bg-transparent font-mono text-3xl font-semibold text-text-primary outline-none placeholder:text-[#2a2a2a]"
                  />
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Description + Category */}
          <FormField
            control={form.control}
            name="description"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel variant="muted">Description</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="What is this for?"
                    className={fieldState.invalid ? "border-negative" : ""}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {showCategory && (
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel variant="muted">Category</FormLabel>
                  {categories === undefined ? (
                    <Skeleton className="h-12 w-full rounded-2xl" />
                  ) : (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger className={fieldState.invalid ? "border-negative" : ""}>
                        <SelectValue placeholder="Select a category…" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredCategories.map((cat) => (
                          <SelectItem key={cat._id} value={cat._id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Frequency */}
          <FormField
            control={form.control}
            name="frequency"
            render={({ field }) => (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-text-muted uppercase tracking-wide">
                  Repeats
                </label>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <Toggle
                      key={opt.value}
                      pressed={field.value === opt.value}
                      onPressedChange={() => {
                        field.onChange(opt.value);
                        form.setValue("anchorDay", undefined);
                        form.setValue("anchorDate", undefined);
                      }}
                    >
                      {opt.label}
                    </Toggle>
                  ))}
                </div>
              </div>
            )}
          />

          {/* Anchor: day of week for weekly */}
          {frequency === "weekly" && (
            <FormField
              control={form.control}
              name="anchorDay"
              render={({ field, fieldState }) => (
                <div className="space-y-2">
                  <label className={`block text-xs font-medium uppercase tracking-wide ${fieldState.invalid ? "text-negative" : "text-text-muted"}`}>
                    On which day?
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {DOW_OPTIONS.map((opt) => (
                      <Toggle
                        key={opt.value}
                        pressed={field.value === opt.value}
                        onPressedChange={() => field.onChange(opt.value)}
                      >
                        {opt.label}
                      </Toggle>
                    ))}
                  </div>
                  <FormMessage />
                </div>
              )}
            />
          )}

          {/* Anchor: day of month for monthly */}
          {frequency === "monthly" && (
            <FormField
              control={form.control}
              name="anchorDay"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel variant="muted">On which day of the month?</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      placeholder="e.g. 1"
                      className={`font-mono ${fieldState.invalid ? "border-negative" : ""}`}
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        field.onChange(isNaN(v) ? undefined : Math.min(31, v));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Anchor: month + day for yearly */}
          {frequency === "yearly" && (
            <FormField
              control={form.control}
              name="anchorDate"
              render={({ fieldState }) => (
                <div className="space-y-2">
                  <label className={`block text-xs font-medium uppercase tracking-wide ${fieldState.invalid ? "text-negative" : "text-text-muted"}`}>
                    On which date each year?
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      value={yearlyMonth !== undefined ? String(yearlyMonth) : ""}
                      onValueChange={(val) => {
                        const month = parseInt(val);
                        const day = yearlyDay ?? 1;
                        form.setValue(
                          "anchorDate",
                          `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                        );
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTH_OPTIONS.map((m) => (
                          <SelectItem key={m.value} value={String(m.value)}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      placeholder="Day"
                      className="font-mono"
                      value={yearlyDay ?? ""}
                      onChange={(e) => {
                        const day = parseInt(e.target.value);
                        const month = yearlyMonth ?? 1;
                        if (!isNaN(day) && day >= 1 && day <= 31) {
                          form.setValue(
                            "anchorDate",
                            `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                          );
                        }
                      }}
                    />
                  </div>
                  <FormMessage />
                </div>
              )}
            />
          )}

          {/* Start Date */}
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel variant="muted">
                  {frequency === "biweekly" ? "First occurrence" : "Starting from"}
                </FormLabel>
                <FormControl>
                  <Input type="date" className="font-mono" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* End Date (optional) */}
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel variant="muted">End date (optional)</FormLabel>
                <FormControl>
                  <Input type="date" className="font-mono" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Notes */}
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel variant="muted">Notes (optional)</FormLabel>
                <FormControl>
                  <Textarea placeholder="Any additional details…" rows={1} {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="sticky bottom-0 left-0 right-0 z-20 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] bg-bg/95 backdrop-blur-sm border-t border-border mt-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save Recurring Transaction"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
