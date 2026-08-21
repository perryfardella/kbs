"use client";

import { useState, useMemo, Suspense } from "react";
import { usePaginatedQuery } from "convex/react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListContainer, ListItem } from "@/components/ui/list-container";
import { Search, X, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { AddTransactionDrawer } from "@/components/AddTransactionDrawer";
import { EditTransactionDrawer } from "@/components/EditTransactionDrawer";
import { AddRecurringDrawer } from "@/components/AddRecurringDrawer";
import { EditRecurringDrawer } from "@/components/EditRecurringDrawer";
import { ApplyOccurrenceDrawer } from "@/components/ApplyOccurrenceDrawer";
import { UpcomingList } from "@/components/UpcomingList";
import { TransactionRow } from "@/components/TransactionRow";

type FilterChip = "all" | "personal" | "business" | "transfers" | "property";

function formatCAD(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function monthLabel(dateStr: string): string {
  const [y, m] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-CA", { month: "long", year: "numeric" });
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function HistoryTab() {
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
    if (chip === "personal") return results.filter((tx) => tx.kind !== "transfer" && tx.realm === "personal");
    if (chip === "business") return results.filter((tx) => tx.kind !== "transfer" && tx.realm === "business");
    if (chip === "property") return results.filter((tx) => tx.realm === "rental");
    return results.filter((tx) => tx.kind === "transfer");
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
    { value: "property", label: "Property" },
  ];

  const isLoading = status === "LoadingFirstPage";

  return (
    <div className="px-4 pt-4 pb-6 space-y-4">
      {/* Search + date filter toggle */}
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 min-h-[44px]">
        <Search size={16} className="text-text-muted shrink-0" />
        <input
          type="search"
          inputMode="search"
          placeholder="Search description or notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent py-2.5 text-sm text-text-primary outline-none placeholder:text-text-muted"
        />
        <button
          type="button"
          onClick={() => setShowDateFilters((v) => !v)}
          aria-label="Filter by date range"
          aria-pressed={showDateFilters}
          className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-xl transition-colors active:scale-95 ${
            showDateFilters || startDate || endDate
              ? "text-accent"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          <Calendar size={16} />
        </button>
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
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
              >
                <X size={16} />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* List content */}
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
                  {txns.map((tx) => (
                    <TransactionRow key={tx._id} tx={tx} href={`/transactions?edit=${tx._id}`} />
                  ))}
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
  );
}

function TransactionsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get("tab") === "upcoming" ? "upcoming" : "history";

  function handleTabChange(value: string) {
    if (value === "upcoming") {
      router.replace("/transactions?tab=upcoming");
    } else {
      router.replace("/transactions");
    }
  }

  return (
    <div className="mx-auto max-w-lg overflow-x-clip">
      <PageHeader title="Transactions">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="w-full">
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          </TabsList>
        </Tabs>
      </PageHeader>

      {activeTab === "history" ? <HistoryTab /> : <UpcomingList />}

      <AddTransactionDrawer />
      <EditTransactionDrawer />
      <AddRecurringDrawer />
      <EditRecurringDrawer />
      <ApplyOccurrenceDrawer />
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsPageInner />
    </Suspense>
  );
}
