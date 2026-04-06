"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { CheckCircle2, ChevronRight, Pencil, Plus, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { computeOccurrences, recurrenceLabel } from "@/lib/recurrence";
import { subDays, format } from "date-fns";

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

function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

function monthLabel(dateStr: string): string {
  const [y, m] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-CA", { month: "long", year: "numeric" });
}

function monthKey(dateStr: string): string {
  return dateStr.substring(0, 7);
}

function todayString(): string {
  const now = new Date();
  return format(now, "yyyy-MM-dd");
}

interface FlatOccurrence {
  ruleId: string;
  ruleName: string;
  ruleAmount: number;
  ruleType: TransactionType;
  ruleFrequency: string;
  date: string;
  appliedTransactionId?: string;
}

export function UpcomingList() {
  const router = useRouter();

  const rules = useQuery(api.recurringTransactions.list);
  const appliedOccurrences = useQuery(api.recurringTransactions.listAllAppliedOccurrences);

  const today = todayString();

  // Look back 60 days to surface overdue occurrences
  const fromDate = format(subDays(new Date(), 60), "yyyy-MM-dd");

  const { overdue, upcoming } = useMemo(() => {
    if (!rules || !appliedOccurrences) return { overdue: [], upcoming: [] };

    const appliedMap = new Map(
      appliedOccurrences.map((o) => [`${o.recurringTransactionId}:${o.scheduledDate}`, o.appliedTransactionId])
    );

    const all: FlatOccurrence[] = [];

    for (const rule of rules) {
      const occurrences = computeOccurrences(rule, fromDate, 15);
      for (const occ of occurrences) {
        const key = `${rule._id}:${occ.date}`;
        all.push({
          ruleId: rule._id,
          ruleName: rule.description,
          ruleAmount: rule.amount,
          ruleType: rule.type as TransactionType,
          ruleFrequency: recurrenceLabel(rule),
          date: occ.date,
          appliedTransactionId: appliedMap.get(key) as string | undefined,
        });
      }
    }

    // Sort by date ascending
    all.sort((a, b) => a.date.localeCompare(b.date));

    const overdue = all.filter((o) => o.date < today && !o.appliedTransactionId);
    const upcoming = all.filter((o) => o.date >= today || o.appliedTransactionId);

    return { overdue, upcoming };
  }, [rules, appliedOccurrences, today, fromDate]);

  function handleOccurrenceTap(occ: FlatOccurrence) {
    if (occ.appliedTransactionId) return; // already applied — no action
    router.push(`/transactions?tab=upcoming&applyOccurrence=${occ.ruleId}&date=${occ.date}`);
  }

  if (rules === undefined || appliedOccurrences === undefined) {
    return (
      <div className="px-4 pt-4 space-y-3">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <div className="px-4 pt-12 flex flex-col items-center gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-surface border border-border flex items-center justify-center">
          <RefreshCw size={20} className="text-text-muted" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-text-primary">No recurring transactions yet</p>
          <p className="text-sm text-text-muted">Add repeating payments like rent, insurance, or dividends.</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => router.push("/transactions?tab=upcoming&addRecurring=true")}
        >
          <Plus size={16} className="mr-1.5" />
          Add recurring
        </Button>
      </div>
    );
  }

  // Group upcoming occurrences by month
  const upcomingByMonth: Record<string, FlatOccurrence[]> = {};
  for (const occ of upcoming) {
    const key = monthKey(occ.date);
    if (!upcomingByMonth[key]) upcomingByMonth[key] = [];
    upcomingByMonth[key].push(occ);
  }
  const sortedMonthKeys = Object.keys(upcomingByMonth).sort();

  return (
    <div className="pb-6">
      {/* Rules management strip */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
          Recurring rules
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-text-muted -mr-2"
          onClick={() => router.push("/transactions?tab=upcoming&addRecurring=true")}
        >
          <Plus size={14} className="mr-1" />
          Add
        </Button>
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 pb-3 pt-1">
        {rules.map((rule) => (
          <button
            key={rule._id}
            type="button"
            onClick={() => router.push(`/transactions?tab=upcoming&editRecurring=${rule._id}`)}
            className="shrink-0 flex items-center gap-2.5 rounded-2xl border border-border bg-surface px-3 py-2.5 text-left active:bg-border/30 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary truncate max-w-[140px]">{rule.description}</p>
              <p className="text-xs text-text-muted">{recurrenceLabel(rule)} · {formatCAD(rule.amount)}</p>
            </div>
            <Pencil size={13} className="shrink-0 text-text-muted" />
          </button>
        ))}
      </div>
      <div className="border-t border-border" />

      {/* Overdue section */}
      {overdue.length > 0 && (
        <div>
          <div className="px-4 py-1.5">
            <span className="text-xs font-semibold text-negative uppercase tracking-wide">
              Overdue
            </span>
          </div>
          <div className="border-t border-border">
            {overdue.map((occ, i) => (
              <OccurrenceRow
                key={`${occ.ruleId}-${occ.date}`}
                occ={occ}
                isOverdue
                isLast={i === overdue.length - 1}
                onTap={() => handleOccurrenceTap(occ)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming grouped by month */}
      {sortedMonthKeys.map((mk) => {
        const occs = upcomingByMonth[mk];
        return (
          <div key={mk}>
            <div className="px-4 py-1.5 border-t border-border">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                {monthLabel(mk + "-01")}
              </span>
            </div>
            <div>
              {occs.map((occ, i) => (
                <OccurrenceRow
                  key={`${occ.ruleId}-${occ.date}`}
                  occ={occ}
                  isOverdue={false}
                  isLast={i === occs.length - 1}
                  onTap={() => handleOccurrenceTap(occ)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {overdue.length === 0 && upcoming.length === 0 && (
        <p className="px-4 pt-4 text-sm text-text-muted text-center">
          No upcoming occurrences in this period.
        </p>
      )}
    </div>
  );
}

function OccurrenceRow({
  occ,
  isOverdue,
  isLast,
  onTap,
}: {
  occ: FlatOccurrence;
  isOverdue: boolean;
  isLast: boolean;
  onTap: () => void;
}) {
  const cfg = typeConfig[occ.ruleType];
  const applied = !!occ.appliedTransactionId;

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={applied}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:bg-surface/60 disabled:cursor-default ${!isLast ? "border-b border-border" : ""} ${isOverdue ? "bg-negative/5" : ""}`}
    >
      {/* Date */}
      <div className="shrink-0 w-12 text-right">
        <span className={`text-sm font-mono ${isOverdue ? "text-negative" : "text-text-muted"}`}>
          {formatShortDate(occ.date)}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${applied ? "text-text-muted" : "text-text-primary"}`}>
          {occ.ruleName}
        </p>
        <p className="text-xs text-text-muted truncate">{occ.ruleFrequency}</p>
      </div>

      {/* Type badge */}
      <Badge variant={cfg.variant} className="shrink-0 hidden sm:flex">
        {cfg.label}
      </Badge>

      {/* Amount */}
      <div className="shrink-0 text-right">
        <span className={`font-mono text-sm font-semibold ${applied ? "text-text-muted" : "text-text-primary"}`}>
          {formatCAD(occ.ruleAmount)}
        </span>
      </div>

      {/* Status icon */}
      <div className="shrink-0 w-5 flex justify-center">
        {applied ? (
          <CheckCircle2 size={16} className="text-positive" />
        ) : (
          <ChevronRight size={16} className="text-text-muted" />
        )}
      </div>
    </button>
  );
}
