"use client";

import { useQuery, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/Skeleton";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

const now = new Date();
const year = now.getFullYear();
const month = now.getMonth();
const startOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`;
const lastDay = new Date(year, month + 1, 0).getDate();
const endOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

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
  });
}

type TransactionType =
  | "personal_expense"
  | "business_expense"
  | "business_expense_personal_pay"
  | "personal_expense_business_pay"
  | "transfer_to_personal"
  | "transfer_to_business"
  | "dividend_payment";

const typeConfig: Record<TransactionType, { label: string; color: string }> = {
  personal_expense: { label: "Personal", color: "bg-[#60a5fa]/20 text-[#60a5fa]" },
  business_expense: { label: "Business", color: "bg-[#a78bfa]/20 text-[#a78bfa]" },
  business_expense_personal_pay: { label: "Biz (Personal Pay)", color: "bg-[#a78bfa]/20 text-[#a78bfa]" },
  personal_expense_business_pay: { label: "Personal (Biz Pay)", color: "bg-[#60a5fa]/20 text-[#60a5fa]" },
  transfer_to_personal: { label: "Corp → Me", color: "bg-[#fb923c]/20 text-[#fb923c]" },
  transfer_to_business: { label: "Me → Corp", color: "bg-[#fb923c]/20 text-[#fb923c]" },
  dividend_payment: { label: "Dividend", color: "bg-[#fb923c]/20 text-[#fb923c]" },
};

export default function DashboardPage() {
  const balance = useQuery(api.transactions.getShareholderLoanBalance);
  const settings = useQuery(api.settings.get);
  const summary = useQuery(api.transactions.getSummary, {
    startDate: startOfMonth,
    endDate: endOfMonth,
  });
  const { results: recentTxns, status } = usePaginatedQuery(
    api.transactions.list,
    {},
    { initialNumItems: 5 }
  );

  const isPositive = (balance ?? 0) >= 0;
  const showAlert =
    settings?.loanAlertThreshold != null &&
    balance != null &&
    Math.abs(balance) > settings.loanAlertThreshold;

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-5">
      {/* Shareholder Loan Card */}
      <div className="rounded-2xl border border-[#1f1f1f] bg-[#141414] p-5 space-y-1">
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
            className={`font-mono text-4xl font-semibold tracking-tight ${
              isPositive ? "text-[#4ade80]" : "text-[#f87171]"
            }`}
          >
            {isPositive ? "+" : "-"}
            {formatCAD(balance)}
          </p>
        )}
      </div>

      {/* Loan Alert Banner */}
      {showAlert && (
        <div className="flex items-start gap-3 rounded-2xl border border-[#f87171]/30 bg-[#f87171]/10 px-4 py-3 text-[#f87171]">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p className="text-sm leading-snug">
            Your balance has exceeded{" "}
            <span className="font-mono font-semibold">
              {formatCAD(settings!.loanAlertThreshold!)}
            </span>{" "}
            — consider declaring a dividend.
          </p>
        </div>
      )}

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[#1f1f1f] bg-[#141414] p-4 space-y-1">
          <p className="text-xs text-text-muted font-medium">Personal · This Month</p>
          {summary === undefined ? (
            <Skeleton className="h-6 w-28" />
          ) : (
            <p className="font-mono text-lg font-semibold text-text-primary text-right">
              {formatCAD(summary?.totalPersonalExpenses ?? 0)}
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-[#1f1f1f] bg-[#141414] p-4 space-y-1">
          <p className="text-xs text-text-muted font-medium">Business · This Month</p>
          {summary === undefined ? (
            <Skeleton className="h-6 w-28" />
          ) : (
            <p className="font-mono text-lg font-semibold text-text-primary text-right">
              {formatCAD(summary?.totalBusinessExpenses ?? 0)}
            </p>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide px-1">
          Recent Transactions
        </h2>
        <div className="rounded-2xl border border-[#1f1f1f] bg-[#141414] overflow-hidden">
          {status === "LoadingFirstPage" ? (
            <div className="divide-y divide-[#1f1f1f]">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : recentTxns.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-text-muted">
              No transactions yet. Tap + to add one.
            </p>
          ) : (
            <div className="divide-y divide-[#1f1f1f]">
              {recentTxns.slice(0, 5).map((tx) => {
                const config = typeConfig[tx.type as TransactionType];
                return (
                  <Link
                    key={tx._id}
                    href={`/transactions/${tx._id}`}
                    className="flex items-center gap-3 px-4 py-3 active:bg-[#1f1f1f] transition-colors min-h-[44px]"
                  >
                    <span className="shrink-0 text-xs text-text-muted font-mono w-14">
                      {formatShortDate(tx.date)}
                    </span>
                    <span className="flex-1 truncate text-sm text-text-primary">
                      {tx.description}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.color}`}
                    >
                      {config.label}
                    </span>
                    <span className="shrink-0 font-mono text-sm text-text-primary text-right">
                      {formatCAD(tx.amount)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
