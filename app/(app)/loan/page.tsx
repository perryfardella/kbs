"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { ListContainer } from "@/components/ui/list-container";
import { PageHeader } from "@/components/PageHeader";
import { LoanLedgerTable } from "@/components/LoanLedgerTable";

function formatCAD(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(Math.abs(amount));
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
              {isPositive && "+"}
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
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 flex-1" />
                <div className="flex flex-col items-end gap-1">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
            ))}
          </ListContainer>
        ) : (
          <LoanLedgerTable entries={ledger} />
        )}
      </div>
    </div>
    </div>
  );
}
