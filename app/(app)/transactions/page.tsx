"use client";

import { useState, useMemo } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { ListContainer, ListItem } from "@/components/ui/list-container";
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
type BadgeVariant = "personal" | "business" | "transfer";

const typeConfig: Record<TransactionType, { label: string; variant: BadgeVariant; indicator: string }> = {
  personal_expense:             { label: "Personal",          variant: "personal", indicator: "bg-badge-personal" },
  business_expense:             { label: "Business",          variant: "business", indicator: "bg-badge-business" },
  business_expense_personal_pay:{ label: "Biz (Personal Pay)",variant: "business", indicator: "bg-badge-business" },
  personal_expense_business_pay:{ label: "Personal (Biz Pay)",variant: "personal", indicator: "bg-badge-personal" },
  transfer_to_personal:         { label: "Corp → Me",         variant: "transfer", indicator: "bg-badge-transfer" },
  transfer_to_business:         { label: "Me → Corp",         variant: "transfer", indicator: "bg-badge-transfer" },
  dividend_payment:             { label: "Dividend",          variant: "transfer", indicator: "bg-badge-transfer" },
};

const PERSONAL_TYPES: TransactionType[] = ["personal_expense", "personal_expense_business_pay"];
const BUSINESS_TYPES: TransactionType[] = ["business_expense", "business_expense_personal_pay"];
const TRANSFER_TYPES: TransactionType[] = ["transfer_to_personal", "transfer_to_business", "dividend_payment"];

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
  return dateStr.slice(0, 7);
}

export default function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<FilterChip>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showDateFilters, setShowDateFilters] = useState(false);

  const queryArgs = useMemo(() => {
    const args: { search?: string; startDate?: string; endDate?: string } = {};
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
    if (chip === "personal") return results.filter((tx) => PERSONAL_TYPES.includes(tx.type as TransactionType));
    if (chip === "business") return results.filter((tx) => BUSINESS_TYPES.includes(tx.type as TransactionType));
    return results.filter((tx) => TRANSFER_TYPES.includes(tx.type as TransactionType));
  }, [results, chip]);

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
      <div className="sticky top-0 z-10 bg-bg border-b border-border">
        <div className="px-4 pt-4 pb-3 space-y-3">
          <h1 className="font-display text-xl font-semibold text-text-primary">
            Transactions
          </h1>

          {/* Search — inline, only used here so not extracted to a component */}
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 min-h-[44px]">
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
              <Toggle
                key={c.value}
                pressed={chip === c.value}
                onPressedChange={() => setChip(c.value)}
              >
                {c.label}
              </Toggle>
            ))}
            <Toggle
              pressed={showDateFilters || !!(startDate || endDate)}
              onPressedChange={() => setShowDateFilters((v) => !v)}
            >
              Date Range
            </Toggle>
          </div>

          {/* Date range inputs */}
          {showDateFilters && (
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <label className="block text-xs text-text-muted">From</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-xl py-2 text-sm min-h-0 h-10 font-mono"
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="block text-xs text-text-muted">To</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-xl py-2 text-sm min-h-0 h-10 font-mono"
                />
              </div>
              {(startDate || endDate) && (
                <div className="flex items-end pb-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setStartDate(""); setEndDate(""); }}
                  >
                    <X size={16} />
                  </Button>
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
                <ListContainer>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <ListItem key={i}>
                      <Skeleton className="h-4 w-12 shrink-0" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-5 w-16 shrink-0" />
                      <Skeleton className="h-4 w-16 shrink-0" />
                    </ListItem>
                  ))}
                </ListContainer>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface px-4 py-10 text-center">
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
                    <span className="text-xs font-mono text-text-muted text-right">
                      {formatCAD(subtotal)}
                    </span>
                  </div>
                  <ListContainer>
                    {txns.map((tx) => {
                      const config = typeConfig[tx.type as TransactionType];
                      return (
                        <ListItem key={tx._id} asChild>
                          <Link href={`/transactions/${tx._id}`}>
                            <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${config.indicator}`} />
                            <span className="shrink-0 text-xs text-text-muted font-mono w-12">
                              {formatShortDate(tx.date)}
                            </span>
                            <span className="flex-1 truncate text-sm text-text-primary">
                              {tx.description}
                            </span>
                            <Badge variant={config.variant}>{config.label}</Badge>
                            <span className="shrink-0 font-mono text-sm text-text-primary text-right min-w-[60px]">
                              {formatCAD(tx.amount)}
                            </span>
                          </Link>
                        </ListItem>
                      );
                    })}
                  </ListContainer>
                </div>
              );
            })}

            {status === "CanLoadMore" && (
              <Button variant="secondary" size="sm" className="w-full" onClick={() => loadMore(50)}>
                Load more
              </Button>
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
