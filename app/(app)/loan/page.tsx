"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { LoanLedgerList } from "@/components/LoanLedgerList";

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
      <div className="px-4 pt-4 pb-6">
        {/* Balance Hero */}
        <Card className="mb-5 p-4">
          {balance === undefined ? (
            <>
              <Skeleton className="mb-1 h-4 w-28" />
              <Skeleton className="h-10 w-48" />
            </>
          ) : (
            <>
              <p className={`mb-1 text-[13px] font-semibold ${isPositive ? "text-loan-you" : "text-loan-corp"}`}>
                {isPositive ? "Corp owes you" : "You owe the corp"}
              </p>
              <p className="font-mono text-[32px] font-semibold tracking-[-0.02em] text-text-primary">
                {formatCAD(balance)}
              </p>
            </>
          )}
        </Card>

        {/* Ledger */}
        {ledger === undefined ? (
          <div className="flex flex-col gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1 border-b border-border py-2.5">
                <div className="flex items-baseline justify-between gap-2.5">
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-3 w-24 shrink-0" />
                </div>
                <div className="flex items-baseline justify-between gap-2.5">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <LoanLedgerList entries={ledger} />
        )}
      </div>
    </div>
  );
}
