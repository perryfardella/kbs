"use client";

import { useState, useMemo } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/Skeleton";
import Link from "next/link";
import { Search, X } from "lucide-react";

type TransactionType =
  | "personal_expense"
  | "business_expense"
  | "business_expense_personal_pay"
  | "personal_expense_business_pay"
  | "transfer_to_personal"
  | "transfer_to_business"
  | "dividend_payment";

type FilterChip = "all" | "personal" | "business" | "transfers";

const typeConfig: Record<TransactionType, { label: string; color: string; indicator: string }> = {
  personal_expense: {
    label: "Personal",
    color: "bg-[#60a5fa]/20 text-[#60a5fa]",
    indicator: "bg-[#60a5fa]",
  },
  business_expense: {
    label: "Business",
    color: "bg-[#a78bfa]/20 text-[#a78bfa]",
    indicator: "bg-[#a78bfa]",
  },
  business_expense_personal_pay: {
    label: "Biz (Personal Pay)",
    color: "bg-[#a78bfa]/20 text-[#a78bfa]",
    indicator: "bg-[#a78bfa]",
  },
  personal_expense_business_pay: {
    label: "Personal (Biz Pay)",
    color: "bg-[#60a5fa]/20 text-[#60a5fa]",
    indicator: "bg-[#60a5fa]",
  },
  transfer_to_personal: {
    label: "Corp → Me",
    color: "bg-[#fb923c]/20 text-[#fb923c]",
    indicator: "bg-[#fb923c]",
  },
  transfer_to_business: {
    label: "Me → Corp",
    color: "bg-[#fb923c]/20 text-[#fb923c]",
    indicator: "bg-[#fb923c]",
  },
  dividend_payment: {
    label: "Dividend",
    color: "bg-[#fb923c]/20 text-[#fb923c]",
    indicator: "bg-[#fb923c]",
  },
};

const PERSONAL_TYPES: TransactionType[] = [
  "personal_expense",
  "personal_expense_business_pay",
];
const BUSINESS_TYPES: TransactionType[] = [
  "business_expense",
  "business_expense_personal_pay",
];
const TRANSFER_TYPES: TransactionType[] = [
  "transfer_to_personal",
  "transfer_to_business",
  "dividend_payment",
];

function formatCAD(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
}

function monthLabel(dateStr: string): string {
  const [y, m] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-CA", {
    month: "long",
    year: "numeric",
  });
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // "YYYY-MM"
}

export default function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<FilterChip>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showDateFilters, setShowDateFilters] = useState(false);

  const queryArgs = useMemo(() => {
    const args: {
      search?: string;
      startDate?: string;
      endDate?: string;
    } = {};
    if (search.trim()) args.search = search.trim();
    if (startDate) args.startDate = startDate;
    if (endDate) args.endDate = endDate;
    return args;
  }, [search, startDate, endDate]);

  const { results, status, loadMore } = usePaginatedQuery(
    api.transactions.list,
    queryArgs,
    { initialNumItems: 50 }
  );

  const filtered = useMemo(() => {
    if (chip === "all") return results;
    if (chip === "personal")
      return results.filter((tx) =>
        PERSONAL_TYPES.includes(tx.type as TransactionType)
      );
    if (chip === "business")
      return results.filter((tx) =>
        BUSINESS_TYPES.includes(tx.type as TransactionType)
      );
    return results.filter((tx) =>
      TRANSFER_TYPES.includes(tx.type as TransactionType)
    );
  }, [results, chip]);

  // Group by month
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const tx of filtered) {
      const key = monthKey(tx.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tx);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const chips: { value: FilterChip; label: string }[] = [
    { value: "all", label: "All" },
    { value: "personal", label: "Personal" },
    { value: "business", label: "Business" },
    { value: "transfers", label: "Transfers" },
  ];

  const isLoading = status === "LoadingFirstPage";

  return (
    <div className="mx-auto max-w-lg">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg border-b border-[#1f1f1f]">
        <div className="px-4 pt-4 pb-3 space-y-3">
          <h1 className="font-display text-xl font-semibold text-text-primary">
            Transactions
          </h1>

          {/* Search */}
          <div className="flex items-center gap-2 rounded-2xl border border-[#1f1f1f] bg-surface px-3 min-h-[44px]">
            <Search size={16} className="text-text-muted shrink-0" />
            <input
              type="search"
              inputMode="search"
              placeholder="Search description or notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted py-2.5"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="flex items-center justify-center w-6 h-6 rounded-full active:scale-95 transition-transform"
              >
                <X size={14} className="text-text-muted" />
              </button>
            )}
          </div>

          {/* Filter chips */}
          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-0.5">
            {chips.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setChip(c.value)}
                className={`shrink-0 rounded-xl px-3.5 py-1.5 text-sm font-medium transition-all active:scale-95 min-h-[44px] border ${
                  chip === c.value
                    ? "bg-accent text-bg border-accent"
                    : "bg-surface text-text-muted border-[#1f1f1f]"
                }`}
              >
                {c.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowDateFilters((v) => !v)}
              className={`shrink-0 rounded-xl px-3.5 py-1.5 text-sm font-medium transition-all active:scale-95 min-h-[44px] border ${
                showDateFilters || startDate || endDate
                  ? "bg-accent text-bg border-accent"
                  : "bg-surface text-text-muted border-[#1f1f1f]"
              }`}
            >
              Date Range
            </button>
          </div>

          {/* Date range inputs */}
          {showDateFilters && (
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <label className="block text-xs text-text-muted">From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-[#1f1f1f] bg-surface px-3 py-2 text-text-primary font-mono text-sm outline-none focus:border-accent min-h-[44px]"
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="block text-xs text-text-muted">To</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-[#1f1f1f] bg-surface px-3 py-2 text-text-primary font-mono text-sm outline-none focus:border-accent min-h-[44px]"
                />
              </div>
              {(startDate || endDate) && (
                <div className="flex items-end pb-1">
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate("");
                      setEndDate("");
                    }}
                    className="flex items-center justify-center w-10 h-10 rounded-xl active:scale-95 transition-transform"
                  >
                    <X size={16} className="text-text-muted" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-6 space-y-4 mt-4">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, gi) => (
              <div key={gi} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <div className="rounded-2xl border border-[#1f1f1f] bg-[#141414] overflow-hidden divide-y divide-[#1f1f1f]">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <Skeleton className="h-4 w-12 shrink-0" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-5 w-16 shrink-0" />
                      <Skeleton className="h-4 w-16 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-[#1f1f1f] bg-[#141414] px-4 py-10 text-center">
            <p className="text-sm text-text-muted">
              {search
                ? "No transactions match your search."
                : chip !== "all"
                ? "No transactions in this category."
                : "No transactions yet. Tap + to add one."}
            </p>
          </div>
        ) : (
          <>
            {grouped.map(([key, txns]) => {
              const subtotal = txns.reduce((sum, tx) => sum + tx.amount, 0);
              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                      {monthLabel(txns[0].date)}
                    </span>
                    <span className="text-xs font-mono text-text-muted">
                      {formatCAD(subtotal)}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-[#1f1f1f] bg-[#141414] overflow-hidden divide-y divide-[#1f1f1f]">
                    {txns.map((tx) => {
                      const config = typeConfig[tx.type as TransactionType];
                      return (
                        <Link
                          key={tx._id}
                          href={`/transactions/${tx._id}`}
                          className="flex items-center gap-3 px-4 py-3 active:bg-[#1f1f1f] transition-colors min-h-[44px]"
                        >
                          {/* Type colour indicator */}
                          <span
                            className={`shrink-0 w-1.5 h-1.5 rounded-full ${config.indicator}`}
                          />
                          {/* Date */}
                          <span className="shrink-0 text-xs text-text-muted font-mono w-12">
                            {formatShortDate(tx.date)}
                          </span>
                          {/* Description */}
                          <span className="flex-1 truncate text-sm text-text-primary">
                            {tx.description}
                          </span>
                          {/* Category chip (if present, shown via type label fallback) */}
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.color}`}
                          >
                            {config.label}
                          </span>
                          {/* Amount */}
                          <span className="shrink-0 font-mono text-sm text-text-primary text-right min-w-[60px]">
                            {formatCAD(tx.amount)}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {status === "CanLoadMore" && (
              <button
                type="button"
                onClick={() => loadMore(50)}
                className="w-full rounded-2xl border border-[#1f1f1f] bg-surface py-3 text-sm text-text-muted active:scale-95 transition-all min-h-[44px]"
              >
                Load more
              </button>
            )}

            {status === "LoadingMore" && (
              <div className="flex justify-center py-3">
                <Skeleton className="h-4 w-24" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
