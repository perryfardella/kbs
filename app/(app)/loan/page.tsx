"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { ListContainer } from "@/components/ui/list-container";
import { PageHeader } from "@/components/PageHeader";

function formatCAD(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(Math.abs(amount));
}

function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function LoanLedgerPage() {
  const balance = useQuery(api.transactions.getShareholderLoanBalance);
  const ledger = useQuery(api.transactions.getShareholderLoanLedger);

  const isPositive = (balance ?? 0) >= 0;

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Loan" />
      <div className="px-4 pt-4 pb-6 space-y-5">
        {/* Balance Hero */}
        <Card className="p-5 space-y-1">
          <p className="text-sm text-text-muted font-medium">
            {balance === undefined
              ? "Loading…"
              : isPositive
                ? "Corp owes you"
                : "You owe corp"}
          </p>
          {balance === undefined ? (
            <Skeleton className="h-10 w-48" />
          ) : (
            <p
              className={`font-mono text-4xl font-semibold tracking-tight ${isPositive ? "text-positive" : "text-negative"}`}
            >
              {isPositive ? "+" : "-"}
              {formatCAD(balance)}
            </p>
          )}
        </Card>

      {/* Ledger Table */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide px-1">
          Loan Activity
        </h2>

        {ledger === undefined ? (
          <ListContainer>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </ListContainer>
        ) : ledger.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface px-4 py-8 text-center text-sm text-text-muted">
            No loan-affecting transactions yet.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_2fr_1fr_1fr_1fr] gap-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              <span>Date</span>
              <span>Description</span>
              <span className="text-right">Amount</span>
              <span className="text-right">Impact</span>
              <span className="text-right">Balance</span>
            </div>
            <ListContainer>
              {ledger.map((tx) => {
                const deltaPositive = tx.shareholderLoanDelta > 0;
                const balancePositive = tx.runningBalance >= 0;
                return (
                  <div
                    key={tx._id}
                    className="grid grid-cols-[1fr_2fr_1fr_1fr_1fr] gap-2 px-4 py-3 min-h-[44px] items-center"
                  >
                    <span className="text-xs text-text-muted font-mono truncate">
                      {formatShortDate(tx.date)}
                    </span>
                    <span className="text-sm text-text-primary truncate">
                      {tx.description}
                    </span>
                    <span className="font-mono text-xs text-text-primary text-right">
                      {formatCAD(tx.amount)}
                    </span>
                    <span className={`font-mono text-xs text-right font-semibold ${deltaPositive ? "text-positive" : "text-negative"}`}>
                      {deltaPositive ? "+" : "-"}
                      {formatCAD(tx.shareholderLoanDelta)}
                    </span>
                    <span className={`font-mono text-xs text-right font-semibold ${balancePositive ? "text-positive" : "text-negative"}`}>
                      {balancePositive ? "+" : "-"}
                      {formatCAD(tx.runningBalance)}
                    </span>
                  </div>
                );
              })}
            </ListContainer>
          </>
        )}
      </div>
    </div>
    </div>
  );
}
