"use client";

import { Suspense } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ListContainer, ListItem } from "@/components/ui/list-container";
import { PageHeader } from "@/components/PageHeader";
import { AddTransactionDrawer } from "@/components/AddTransactionDrawer";
import { EditTransactionDrawer } from "@/components/EditTransactionDrawer";
import { EditPropertyDrawer } from "@/components/EditPropertyDrawer";
import Link from "next/link";
import { ChevronLeft, Pencil, Plus } from "lucide-react";

function formatCAD(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(Math.abs(amount));
}

function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

type BadgeVariant = "personal" | "business" | "transfer" | "rental";

const typeConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  rental_income:                 { label: "Income",            variant: "rental" },
  rental_expense:                { label: "Expense",           variant: "rental" },
  personal_expense:              { label: "Personal",          variant: "personal" },
  business_expense:              { label: "Business",          variant: "business" },
  business_expense_personal_pay: { label: "Biz (Personal Pay)",variant: "business" },
  personal_expense_business_pay: { label: "Personal (Biz Pay)",variant: "personal" },
  transfer_to_personal:          { label: "Corp → Me",         variant: "transfer" },
  transfer_to_business:          { label: "Me → Corp",         variant: "transfer" },
  dividend_payment:              { label: "Dividend",          variant: "transfer" },
};

const now = new Date();
const year = now.getFullYear();
const startOfYear = `${year}-01-01`;
const endOfYear = `${year}-12-31`;

function PropertyDetailInner() {
  const params = useParams<{ propertyId: string }>();
  const propertyId = params.propertyId as Id<"properties">;
  const base = `/properties/${propertyId}`;
  const returnTo = encodeURIComponent(base);

  const property = useQuery(api.properties.get, { propertyId });
  const summary = useQuery(api.properties.getPropertySummary, {
    propertyId,
    startDate: startOfYear,
    endDate: endOfYear,
  });
  const { results, status, loadMore } = usePaginatedQuery(
    api.transactions.list,
    { propertyId },
    { initialNumItems: 50 }
  );

  const net = summary?.net ?? 0;
  const netPositive = net >= 0;

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title={property?.name ?? "Property"}
        left={
          <Button variant="secondary" size="icon" asChild className="-ml-2">
            <Link href="/properties" aria-label="Back to properties">
              <ChevronLeft size={18} className="text-text-muted" />
            </Link>
          </Button>
        }
        right={
          <Button variant="secondary" size="icon" asChild className="-mr-2">
            <Link href={`${base}?editProperty=true`} aria-label="Edit property">
              <Pencil size={16} className="text-text-primary" />
            </Link>
          </Button>
        }
      />
      <div className="space-y-5 px-4 pt-4 pb-6">
        {property === null && (
          <div className="rounded-2xl border border-border bg-surface px-4 py-10 text-center">
            <p className="text-sm text-text-muted">Property not found.</p>
          </div>
        )}

        {/* Summary */}
        <Card className="p-5 space-y-1">
          <p className="text-sm text-text-muted font-medium">Net cash flow · {year}</p>
          {summary === undefined ? (
            <Skeleton className="h-9 w-40" />
          ) : (
            <p className={`font-mono text-3xl font-semibold tracking-tight ${netPositive ? "text-positive" : "text-negative"}`}>
              {netPositive ? "+" : "-"}
              {formatCAD(net)}
            </p>
          )}
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 space-y-1">
            <p className="text-xs text-text-muted font-medium">Income · {year}</p>
            {summary === undefined ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              <p className="font-mono text-lg font-semibold text-positive text-right">
                {formatCAD(summary?.income ?? 0)}
              </p>
            )}
          </Card>
          <Card className="p-4 space-y-1">
            <p className="text-xs text-text-muted font-medium">Expenses · {year}</p>
            {summary === undefined ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              <p className="font-mono text-lg font-semibold text-text-primary text-right">
                {formatCAD(summary?.expenses ?? 0)}
              </p>
            )}
          </Card>
        </div>

        {/* Add actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button asChild variant="secondary" size="sm">
            <Link href={`${base}?add=true&type=rental_income&property=${propertyId}&returnTo=${returnTo}`}>
              <Plus size={16} className="mr-1" /> Income
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href={`${base}?add=true&type=rental_expense&property=${propertyId}&returnTo=${returnTo}`}>
              <Plus size={16} className="mr-1" /> Expense
            </Link>
          </Button>
        </div>

        {/* Transactions */}
        <div className="space-y-2">
          <h2 className="px-1 text-sm font-semibold text-text-muted uppercase tracking-wide">
            Transactions
          </h2>
          {status === "LoadingFirstPage" ? (
            <ListContainer>
              {Array.from({ length: 5 }).map((_, i) => (
                <ListItem key={i}>
                  <Skeleton className="h-4 w-12 shrink-0" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-5 w-16 shrink-0" />
                  <Skeleton className="h-4 w-16 shrink-0" />
                </ListItem>
              ))}
            </ListContainer>
          ) : results.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface px-4 py-8 text-center text-sm text-text-muted">
              No transactions for this property yet.
            </div>
          ) : (
            <>
              <ListContainer>
                {results.map((tx) => {
                  const config = typeConfig[tx.type] ?? { label: tx.type, variant: "transfer" as BadgeVariant };
                  const isIncome = tx.type === "rental_income";
                  return (
                    <ListItem key={tx._id} asChild>
                      <Link href={`${base}?edit=${tx._id}&returnTo=${returnTo}`}>
                        <span className="shrink-0 w-12 font-mono text-xs text-text-muted">
                          {formatShortDate(tx.date)}
                        </span>
                        <span className="flex-1 truncate text-sm text-text-primary">
                          {tx.description}
                        </span>
                        <Badge variant={config.variant}>{config.label}</Badge>
                        <span className={`shrink-0 text-right font-mono text-sm min-w-[60px] ${isIncome ? "text-positive" : "text-text-primary"}`}>
                          {isIncome ? "+" : ""}
                          {formatCAD(tx.amount)}
                        </span>
                      </Link>
                    </ListItem>
                  );
                })}
              </ListContainer>
              {status === "CanLoadMore" && (
                <Button variant="secondary" size="sm" className="w-full" onClick={() => loadMore(50)}>
                  Load more
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <AddTransactionDrawer />
      <EditTransactionDrawer />
      <EditPropertyDrawer propertyId={propertyId} />
    </div>
  );
}

export default function PropertyDetailPage() {
  return (
    <Suspense>
      <PropertyDetailInner />
    </Suspense>
  );
}
