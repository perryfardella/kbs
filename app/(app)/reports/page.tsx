"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/Skeleton";

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

function computeFiscalYear(fiscalYearEnd: string): {
  startDate: string;
  endDate: string;
} {
  const [endMonth, endDay] = fiscalYearEnd.split("-").map(Number);
  const today = new Date();
  const todayYear = today.getFullYear();

  const thisYearEnd = new Date(todayYear, endMonth - 1, endDay);

  if (today <= thisYearEnd) {
    // FY ends this calendar year, started previous year
    const endDate = `${todayYear}-${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
    const prevEnd = new Date(todayYear - 1, endMonth - 1, endDay);
    const startObj = new Date(prevEnd);
    startObj.setDate(startObj.getDate() + 1);
    const startDate = startObj.toISOString().slice(0, 10);
    return { startDate, endDate };
  } else {
    // FY started after this year's end, ends next year
    const startObj = new Date(thisYearEnd);
    startObj.setDate(startObj.getDate() + 1);
    const startDate = startObj.toISOString().slice(0, 10);
    const endDate = `${todayYear + 1}-${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
    return { startDate, endDate };
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

  const defaultFiscal =
    settings?.fiscalYearEnd
      ? computeFiscalYear(settings.fiscalYearEnd)
      : null;

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && defaultFiscal) {
      setStartDate(defaultFiscal.startDate);
      setEndDate(defaultFiscal.endDate);
      setInitialized(true);
    }
  }, [defaultFiscal, initialized]);

  const effectiveStart = startDate || defaultFiscal?.startDate || "";
  const effectiveEnd = endDate || defaultFiscal?.endDate || "";

  const summary = useQuery(
    api.transactions.getSummary,
    effectiveStart && effectiveEnd
      ? { startDate: effectiveStart, endDate: effectiveEnd }
      : "skip"
  );

  const exportTxns = useQuery(
    api.transactions.getForExport,
    effectiveStart && effectiveEnd
      ? { startDate: effectiveStart, endDate: effectiveEnd }
      : "skip"
  );

  function handleExportCsv() {
    if (!exportTxns) return;
    const header = [
      "Date",
      "Description",
      "Type",
      "Category",
      "Amount (CAD)",
      "Notes",
      "Shareholder Loan Impact",
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
    a.download = `KBS_${effectiveStart}_${effectiveEnd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isLoading = settings === undefined || summary === undefined;

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-5">
      <h1 className="font-display text-2xl font-semibold text-text-primary">
        Reports
      </h1>

      {/* Date Range Picker */}
      <div className="rounded-2xl border border-[#1f1f1f] bg-[#141414] p-4 space-y-3">
        <p className="text-sm font-semibold text-text-muted uppercase tracking-wide">
          Date Range
        </p>
        <div className="flex gap-3 items-center">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-text-muted">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              inputMode="none"
            />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-xs text-text-muted">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              inputMode="none"
            />
          </div>
        </div>
        {settings?.fiscalYearEnd && (
          <button
            onClick={() => {
              const fy = computeFiscalYear(settings.fiscalYearEnd);
              setStartDate(fy.startDate);
              setEndDate(fy.endDate);
            }}
            className="text-xs text-accent underline active:scale-95 transition-transform"
          >
            Reset to current fiscal year
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-text-muted uppercase tracking-wide px-1">
          Summary
        </p>
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard
            label="Personal Expenses"
            value={summary?.totalPersonalExpenses}
            isLoading={isLoading}
            colour="text-[#60a5fa]"
          />
          <SummaryCard
            label="Business Expenses"
            value={summary?.totalBusinessExpenses}
            isLoading={isLoading}
            colour="text-[#a78bfa]"
          />
          <SummaryCard
            label="Corp → Personal"
            value={summary?.totalTransferToPersonal}
            isLoading={isLoading}
            colour="text-[#fb923c]"
          />
          <SummaryCard
            label="Personal → Business"
            value={summary?.totalTransferToBusiness}
            isLoading={isLoading}
            colour="text-[#fb923c]"
          />
          <SummaryCard
            label="Net Loan Change"
            value={summary?.netShareholderLoanChange}
            isLoading={isLoading}
            signed
          />
          <div className="rounded-2xl border border-[#1f1f1f] bg-[#141414] p-4 space-y-1">
            <p className="text-xs text-text-muted">Transactions</p>
            {isLoading ? (
              <Skeleton className="h-6 w-12" />
            ) : (
              <p className="font-mono text-xl font-semibold text-text-primary">
                {summary?.transactionCount ?? 0}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Export */}
      <button
        onClick={handleExportCsv}
        disabled={!exportTxns || !effectiveStart || !effectiveEnd}
        className="w-full rounded-2xl border border-accent bg-accent/10 text-accent font-semibold py-4 text-base active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Export CSV
      </button>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  isLoading,
  colour,
  signed,
}: {
  label: string;
  value?: number;
  isLoading: boolean;
  colour?: string;
  signed?: boolean;
}) {
  const isNeg = (value ?? 0) < 0;
  const colourClass = signed
    ? isNeg
      ? "text-[#f87171]"
      : "text-[#4ade80]"
    : colour ?? "text-text-primary";

  return (
    <div className="rounded-2xl border border-[#1f1f1f] bg-[#141414] p-4 space-y-1">
      <p className="text-xs text-text-muted">{label}</p>
      {isLoading ? (
        <Skeleton className="h-6 w-24" />
      ) : (
        <p className={`font-mono text-base font-semibold ${colourClass} text-right`}>
          {signed && !isNeg && "+"}
          {formatCAD(value ?? 0)}
        </p>
      )}
    </div>
  );
}
