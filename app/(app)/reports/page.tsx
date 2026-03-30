"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

function formatCAD(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(amount);
}

const TYPE_LABELS: Record<string, string> = {
  personal_expense: "Personal Expense",
  business_expense: "Business Expense",
  business_expense_personal_pay: "Biz Expense (Personal Pay)",
  personal_expense_business_pay: "Personal Expense (Business Pay)",
  transfer_to_personal: "Corp → Personal Transfer",
  transfer_to_business: "Personal → Business Transfer",
  dividend_payment: "Dividend / Repayment",
};

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

function escapeCsv(value: string | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function ReportsPage() {
  const settings = useQuery(api.settings.get);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && settings?.fiscalYearEnd) {
      const fy = computeFiscalYear(settings.fiscalYearEnd);
      setStartDate(fy.startDate);
      setEndDate(fy.endDate);
      setInitialized(true);
    }
  }, [settings, initialized]);

  const summary = useQuery(
    api.transactions.getSummary,
    startDate && endDate ? { startDate, endDate } : "skip"
  );

  const exportTxns = useQuery(
    api.transactions.getForExport,
    startDate && endDate ? { startDate, endDate } : "skip"
  );

  function handleExportCsv() {
    if (!exportTxns) return;
    const header = [
      "Date", "Description", "Type", "Category",
      "Amount (CAD)", "Notes", "Shareholder Loan Impact",
    ].join(",");

    const rows = exportTxns.map((tx) =>
      [
        escapeCsv(tx.date),
        escapeCsv(tx.description),
        escapeCsv(TYPE_LABELS[tx.type] ?? tx.type),
        escapeCsv(tx.categoryName),
        escapeCsv(tx.amount.toFixed(2)),
        escapeCsv(tx.notes),
        escapeCsv(tx.shareholderLoanDelta.toFixed(2)),
      ].join(",")
    );

    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `KBS_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isLoading = summary === undefined;

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-5">
      <h1 className="font-display text-2xl font-semibold text-text-primary">
        Reports
      </h1>

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
        <p className="text-sm font-semibold text-text-muted uppercase tracking-wide px-1">
          Summary
        </p>
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard label="Personal Expenses" value={summary?.totalPersonalExpenses} isLoading={isLoading} colour="text-badge-personal" />
          <SummaryCard label="Business Expenses" value={summary?.totalBusinessExpenses} isLoading={isLoading} colour="text-badge-business" />
          <SummaryCard label="Corp → Personal" value={summary?.totalTransferToPersonal} isLoading={isLoading} colour="text-badge-transfer" />
          <SummaryCard label="Personal → Business" value={summary?.totalTransferToBusiness} isLoading={isLoading} colour="text-badge-transfer" />
          <SummaryCard label="Net Loan Change" value={summary?.netShareholderLoanChange} isLoading={isLoading} signed />
          <Card className="p-4 space-y-1">
            <p className="text-xs text-text-muted">Transactions</p>
            {isLoading ? (
              <Skeleton className="h-6 w-12" />
            ) : (
              <p className="font-mono text-xl font-semibold text-text-primary">
                {summary?.transactionCount ?? 0}
              </p>
            )}
          </Card>
        </div>
      </div>

      {/* Export */}
      <Button
        variant="outline"
        onClick={handleExportCsv}
        disabled={!exportTxns || !startDate || !endDate}
        className="border-accent bg-accent/10 text-accent"
      >
        Export CSV
      </Button>
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
