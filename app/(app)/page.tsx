"use client";

import { useQuery, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ListContainer, ListItem } from "@/components/ui/list-container";
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

type BadgeVariant = "personal" | "business" | "transfer";

const typeConfig: Record<TransactionType, { label: string; variant: BadgeVariant }> = {
  personal_expense:             { label: "Personal",          variant: "personal" },
  business_expense:             { label: "Business",          variant: "business" },
  business_expense_personal_pay:{ label: "Biz (Personal Pay)",variant: "business" },
  personal_expense_business_pay:{ label: "Personal (Biz Pay)",variant: "personal" },
  transfer_to_personal:         { label: "Corp → Me",         variant: "transfer" },
  transfer_to_business:         { label: "Me → Corp",         variant: "transfer" },
  dividend_payment:             { label: "Dividend",          variant: "transfer" },
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
          <p className={`font-mono text-4xl font-semibold tracking-tight ${isPositive ? "text-positive" : "text-negative"}`}>
            {isPositive ? "+" : "-"}
            {formatCAD(balance)}
          </p>
        )}
      </Card>

      {/* Loan Alert Banner */}
      {showAlert && (
        <Alert variant="negative">
          <AlertTriangle size={18} />
          <AlertDescription>
            Your balance has exceeded{" "}
            <span className="font-mono font-semibold">
              {formatCAD(settings!.loanAlertThreshold!)}
            </span>{" "}
            — consider declaring a dividend.
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 space-y-1">
          <p className="text-xs text-text-muted font-medium">Personal · This Month</p>
          {summary === undefined ? (
            <Skeleton className="h-6 w-28" />
          ) : (
            <p className="font-mono text-lg font-semibold text-text-primary text-right">
              {formatCAD(summary?.totalPersonalExpenses ?? 0)}
            </p>
          )}
        </Card>
        <Card className="p-4 space-y-1">
          <p className="text-xs text-text-muted font-medium">Business · This Month</p>
          {summary === undefined ? (
            <Skeleton className="h-6 w-28" />
          ) : (
            <p className="font-mono text-lg font-semibold text-text-primary text-right">
              {formatCAD(summary?.totalBusinessExpenses ?? 0)}
            </p>
          )}
        </Card>
      </div>

      {/* Recent Transactions */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide px-1">
          Recent Transactions
        </h2>
        <ListContainer>
          {status === "LoadingFirstPage" ? (
            Array.from({ length: 5 }).map((_, i) => (
              <ListItem key={i}>
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-4 w-16" />
              </ListItem>
            ))
          ) : recentTxns.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-text-muted">
              No transactions yet. Tap + to add one.
            </p>
          ) : (
            recentTxns.slice(0, 5).map((tx) => {
              const config = typeConfig[tx.type as TransactionType];
              return (
                <ListItem key={tx._id} asChild>
                  <Link href={`/transactions/${tx._id}`}>
                    <span className="shrink-0 text-xs text-text-muted font-mono w-14">
                      {formatShortDate(tx.date)}
                    </span>
                    <span className="flex-1 truncate text-sm text-text-primary">
                      {tx.description}
                    </span>
                    <Badge variant={config.variant}>{config.label}</Badge>
                    <span className="shrink-0 font-mono text-sm text-text-primary text-right">
                      {formatCAD(tx.amount)}
                    </span>
                  </Link>
                </ListItem>
              );
            })
          )}
        </ListContainer>
      </div>
    </div>
  );
}
