"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ListContainer, ListItem } from "@/components/ui/list-container";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoanLedgerTable } from "@/components/LoanLedgerTable";
import { PageHeader } from "@/components/PageHeader";
import { buildReportWorkbook } from "@/lib/reportWorkbook";
import Link from "next/link";

function formatCAD(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function computeFiscalYear(fiscalYearEnd: string): { startDate: string; endDate: string } {
  const [endMonth, endDay] = fiscalYearEnd.split("-").map(Number);
  const today = new Date();
  const todayYear = today.getFullYear();
  const thisYearEnd = new Date(todayYear, endMonth - 1, endDay);

  if (today <= thisYearEnd) {
    const endDate = `${todayYear}-${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
    const prevEnd = new Date(todayYear - 1, endMonth - 1, endDay);
    const startObj = new Date(prevEnd);
    startObj.setDate(startObj.getDate() + 1);
    return { startDate: startObj.toISOString().slice(0, 10), endDate };
  } else {
    const startObj = new Date(thisYearEnd);
    startObj.setDate(startObj.getDate() + 1);
    const endDate = `${todayYear + 1}-${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
    return { startDate: startObj.toISOString().slice(0, 10), endDate };
  }
}

export default function ReportsPage() {
  const settings = useQuery(api.settings.get);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!initialized && settings?.fiscalYearEnd) {
      const fy = computeFiscalYear(settings.fiscalYearEnd);
      setStartDate(fy.startDate);
      setEndDate(fy.endDate);
      setInitialized(true);
    }
  }, [settings, initialized]);

  const hasRange = Boolean(startDate && endDate);
  const expenseBreakdown = useQuery(
    api.transactions.getExpenseBreakdown,
    hasRange ? { startDate, endDate } : "skip"
  );
  const rentalBreakdown = useQuery(
    api.properties.getRentalBreakdown,
    hasRange ? { startDate, endDate } : "skip"
  );
  const loanLedger = useQuery(
    api.transactions.getLoanLedgerRange,
    hasRange ? { startDate, endDate } : "skip"
  );

  const isLoading = !expenseBreakdown || !rentalBreakdown || !loanLedger;

  async function handleExportXlsx() {
    if (!expenseBreakdown || !rentalBreakdown || !loanLedger) return;
    setIsExporting(true);
    try {
      const blob = await buildReportWorkbook({ expenseBreakdown, rentalBreakdown, loanLedger });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `KBS_${startDate}_${endDate}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Reports" />
      <div className="space-y-5 px-4 pt-4 pb-6">
        {/* Date Range Picker */}
        <Card className="p-4 space-y-3">
          <p className="text-sm font-semibold text-text-muted uppercase tracking-wide">
            Date Range
          </p>
          <div className="grid grid-cols-2 max-[320px]:grid-cols-1 gap-2">
            <div className="min-w-0 space-y-1">
              <Label variant="muted">From</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-xl py-2 text-sm min-h-0 h-9 w-full pr-2 min-w-[130px]"
                inputMode="none"
              />
            </div>
            <div className="min-w-0 space-y-1">
              <Label variant="muted">To</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-xl py-2 text-sm min-h-0 h-9 w-full pr-2 min-w-[130px]"
                inputMode="none"
              />
            </div>
          </div>
          {settings?.fiscalYearEnd && (
            <Button
              variant="link"
              size="sm"
              className="text-xs h-auto p-0"
              onClick={() => {
                const fy = computeFiscalYear(settings.fiscalYearEnd);
                setStartDate(fy.startDate);
                setEndDate(fy.endDate);
              }}
            >
              Reset to current financial year
            </Button>
          )}
        </Card>

        {/* Summary Cards */}
        <div className="space-y-2">
          <p className="px-1 text-sm font-semibold text-text-muted uppercase tracking-wide">
            Summary
          </p>
          <div className="grid grid-cols-2 gap-3">
            <SummaryCard
              label="Personal Income"
              value={expenseBreakdown?.personalIncome.total}
              isLoading={isLoading}
              colour="text-badge-personal"
            />
            <SummaryCard
              label="Business Income"
              value={expenseBreakdown?.businessIncome.total}
              isLoading={isLoading}
              colour="text-badge-business"
            />
            <SummaryCard
              label="Personal Expenses"
              value={expenseBreakdown?.personal.total}
              isLoading={isLoading}
              colour="text-badge-personal"
            />
            <SummaryCard
              label="Business Expenses"
              value={expenseBreakdown?.business.total}
              isLoading={isLoading}
              colour="text-badge-business"
            />
            <SummaryCard
              label="Net Rental"
              value={rentalBreakdown?.total.net}
              isLoading={isLoading}
              signed
            />
            <SummaryCard
              label="Loan Balance"
              value={loanLedger?.closingBalance}
              isLoading={isLoading}
              signed
            />
          </div>
        </div>

        {/* Breakdown Tabs */}
        <Tabs defaultValue="personal">
          <TabsList>
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="business">Business</TabsTrigger>
            <TabsTrigger value="rental">Rental</TabsTrigger>
            <TabsTrigger value="loan">Loan</TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="pt-3 space-y-4">
            <div className="space-y-2">
              <p className="px-1 text-xs font-semibold text-text-muted uppercase tracking-wide">
                Income
              </p>
              <CategoryBreakdownList
                byCategory={expenseBreakdown?.personalIncome.byCategory}
                isLoading={isLoading}
                emptyMessage="No personal income in this range."
              />
            </div>
            <div className="space-y-2">
              <p className="px-1 text-xs font-semibold text-text-muted uppercase tracking-wide">
                Expenses
              </p>
              <CategoryBreakdownList
                byCategory={expenseBreakdown?.personal.byCategory}
                isLoading={isLoading}
                emptyMessage="No personal expenses in this range."
              />
            </div>
          </TabsContent>

          <TabsContent value="business" className="pt-3 space-y-4">
            <div className="space-y-2">
              <p className="px-1 text-xs font-semibold text-text-muted uppercase tracking-wide">
                Income
              </p>
              <CategoryBreakdownList
                byCategory={expenseBreakdown?.businessIncome.byCategory}
                isLoading={isLoading}
                emptyMessage="No business income in this range."
              />
            </div>
            <div className="space-y-2">
              <p className="px-1 text-xs font-semibold text-text-muted uppercase tracking-wide">
                Expenses
              </p>
              <CategoryBreakdownList
                byCategory={expenseBreakdown?.business.byCategory}
                isLoading={isLoading}
                emptyMessage="No business expenses in this range."
              />
            </div>
          </TabsContent>

          <TabsContent value="rental" className="pt-3">
            <PropertyBreakdownList
              byProperty={rentalBreakdown?.byProperty}
              isLoading={isLoading}
            />
          </TabsContent>

          <TabsContent value="loan" className="pt-3">
            {isLoading || !loanLedger ? (
              <ListContainer>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </ListContainer>
            ) : (
              <LoanLedgerTable
                entries={loanLedger.entries}
                openingBalance={loanLedger.openingBalance}
                emptyMessage="No loan activity in this range."
              />
            )}
          </TabsContent>
        </Tabs>

        {/* Export */}
        <Button
          variant="outline"
          onClick={handleExportXlsx}
          disabled={isLoading || isExporting}
          className="border-accent bg-accent/10 text-accent"
        >
          {isExporting ? "Exporting…" : "Export XLSX"}
        </Button>
      </div>
    </div>
  );
}

function SummaryCard({
  label, value, isLoading, colour, signed,
}: {
  label: string;
  value?: number;
  isLoading: boolean;
  colour?: string;
  signed?: boolean;
}) {
  const isNeg = (value ?? 0) < 0;
  const colourClass = signed
    ? isNeg ? "text-negative" : "text-positive"
    : colour ?? "text-text-primary";

  return (
    <Card className="p-4 space-y-1">
      <p className="text-xs text-text-muted">{label}</p>
      {isLoading ? (
        <Skeleton className="h-6 w-24" />
      ) : (
        <p className={`font-mono text-base font-semibold ${colourClass} text-right`}>
          {signed && !isNeg && "+"}
          {formatCAD(value ?? 0)}
        </p>
      )}
    </Card>
  );
}

function CategoryBreakdownList({
  byCategory,
  isLoading,
  emptyMessage,
}: {
  byCategory?: Array<{ name: string; amount: number }>;
  isLoading: boolean;
  emptyMessage: string;
}) {
  if (isLoading || !byCategory) {
    return (
      <ListContainer>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </ListContainer>
    );
  }

  if (byCategory.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface px-4 py-8 text-center text-sm text-text-muted">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ListContainer>
      {byCategory.map((c) => (
        <ListItem key={c.name}>
          <span className="flex-1 min-w-0 truncate text-sm text-text-primary">{c.name}</span>
          <span className="font-mono text-sm text-text-primary">{formatCAD(c.amount)}</span>
        </ListItem>
      ))}
    </ListContainer>
  );
}

function PropertyBreakdownList({
  byProperty,
  isLoading,
}: {
  byProperty?: Array<{ propertyId: string; name: string; income: number; expenses: number; net: number }>;
  isLoading: boolean;
}) {
  if (isLoading || !byProperty) {
    return (
      <ListContainer>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </ListContainer>
    );
  }

  if (byProperty.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface px-4 py-8 text-center text-sm text-text-muted">
        No active properties.
      </div>
    );
  }

  return (
    <ListContainer>
      {byProperty.map((p) => {
        const positive = p.net >= 0;
        return (
          <ListItem asChild key={p.propertyId}>
            <Link href={`/properties/${p.propertyId}`}>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm text-text-primary">{p.name}</p>
                <p className="truncate text-xs text-text-muted">
                  +{formatCAD(p.income)} / -{formatCAD(p.expenses)}
                </p>
              </div>
              <span className={`shrink-0 font-mono text-sm ${positive ? "text-positive" : "text-negative"}`}>
                {positive ? "+" : "-"}
                {formatCAD(Math.abs(p.net))}
              </span>
            </Link>
          </ListItem>
        );
      })}
    </ListContainer>
  );
}
