"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type TransactionType =
  | "personal_expense"
  | "business_expense"
  | "business_expense_personal_pay"
  | "personal_expense_business_pay"
  | "transfer_to_personal"
  | "transfer_to_business"
  | "dividend_payment";

type BadgeVariant = "personal" | "business" | "transfer";

const typeConfig: Record<TransactionType, { label: string; variant: BadgeVariant }> = {
  personal_expense:              { label: "Personal",           variant: "personal" },
  business_expense:              { label: "Business",           variant: "business" },
  business_expense_personal_pay: { label: "Biz (Personal Pay)", variant: "business" },
  personal_expense_business_pay: { label: "Personal (Biz Pay)", variant: "personal" },
  transfer_to_personal:          { label: "Corp → Me",          variant: "transfer" },
  transfer_to_business:          { label: "Me → Corp",          variant: "transfer" },
  dividend_payment:              { label: "Dividend",            variant: "transfer" },
};

function formatCAD(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

interface ApplyOccurrenceFormProps {
  recurringTransactionId: Id<"recurringTransactions">;
  scheduledDate: string;
  onSuccess: () => void;
}

export function ApplyOccurrenceForm({
  recurringTransactionId,
  scheduledDate,
  onSuccess,
}: ApplyOccurrenceFormProps) {
  const [amountStr, setAmountStr] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [amountError, setAmountError] = useState("");

  const rule = useQuery(api.recurringTransactions.get, { recurringTransactionId });
  const applyOccurrence = useMutation(api.recurringTransactions.applyOccurrence);

  useEffect(() => {
    if (rule) {
      setAmountStr(String(rule.amount));
      setNotes(rule.notes ?? "");
      setSaving(false);
      setAmountError("");
    }
  }, [rule]);

  async function handleApply() {
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      setAmountError("Enter a valid amount");
      return;
    }
    setAmountError("");
    setSaving(true);
    try {
      await applyOccurrence({
        recurringTransactionId,
        scheduledDate,
        amount,
        notes: notes.trim() || undefined,
      });
      toast.success("Transaction applied");
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to apply";
      toast.error(msg);
      setSaving(false);
    }
  }

  if (rule === undefined) {
    return (
      <div className="px-4 pt-2 space-y-3">
        <Skeleton className="h-6 w-2/3 rounded" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full rounded-2xl" />
      </div>
    );
  }

  if (rule === null) {
    return <p className="px-4 pt-4 text-sm text-text-muted">Recurring transaction not found.</p>;
  }

  const cfg = typeConfig[rule.type as TransactionType];

  return (
    <div className="px-4 pt-2 pb-2 space-y-4">
      {/* Read-only summary */}
      <div className="rounded-2xl border border-border bg-surface px-4 py-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-semibold text-text-primary truncate">{rule.description}</span>
          <Badge variant={cfg.variant}>{cfg.label}</Badge>
        </div>
        {rule.categoryName && (
          <p className="text-xs text-text-muted">{rule.categoryName}</p>
        )}
        <p className="text-sm text-text-muted">{formatDate(scheduledDate)}</p>
      </div>

      {/* Editable amount */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-text-muted uppercase tracking-wide">
          Amount
        </label>
        <div className={`flex items-center gap-2 rounded-2xl border bg-surface px-4 py-2.5 ${amountError ? "border-negative" : "border-border"}`}>
          <span className="font-mono text-sm font-medium text-text-muted">CAD</span>
          <input
            type="text"
            inputMode="decimal"
            value={amountStr}
            onChange={(e) => { setAmountStr(e.target.value); setAmountError(""); }}
            className="flex-1 min-w-0 bg-transparent font-mono text-3xl font-semibold text-text-primary outline-none placeholder:text-[#2a2a2a]"
            placeholder="0.00"
          />
        </div>
        {amountError && <p className="text-xs text-negative">{amountError}</p>}
      </div>

      {/* Editable notes */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-text-muted uppercase tracking-wide">
          Notes (optional)
        </label>
        <Textarea
          placeholder="Any additional details…"
          rows={1}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="sticky bottom-0 left-0 right-0 z-20 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] bg-bg/95 backdrop-blur-sm border-t border-border mt-1 -mx-4 px-4">
        <Button onClick={handleApply} disabled={saving}>
          {saving ? "Applying…" : `Apply — ${formatCAD(parseFloat(amountStr) || 0)}`}
        </Button>
      </div>
    </div>
  );
}
