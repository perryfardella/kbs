import { Id } from "@/convex/_generated/dataModel";
import { ListContainer } from "@/components/ui/list-container";

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

export interface LoanLedgerEntry {
  _id: Id<"transactions">;
  date: string;
  description: string;
  amount: number;
  shareholderLoanDelta: number;
  runningBalance: number;
}

export function LoanLedgerTable({
  entries,
  openingBalance,
  emptyMessage = "No loan-affecting transactions yet.",
}: {
  entries: LoanLedgerEntry[];
  openingBalance?: number;
  emptyMessage?: string;
}) {
  if (entries.length === 0 && openingBalance === undefined) {
    return (
      <div className="rounded-2xl border border-border bg-surface px-4 py-8 text-center text-sm text-text-muted">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-[1fr_2fr_1fr_1fr_1fr] gap-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
        <span>Date</span>
        <span>Description</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Impact</span>
        <span className="text-right">Balance</span>
      </div>
      <ListContainer>
        {openingBalance !== undefined && (
          <div className="grid grid-cols-[1fr_2fr_1fr_1fr_1fr] gap-2 px-4 py-3 min-h-[44px] items-center bg-border/30">
            <span className="text-xs text-text-muted font-mono truncate col-span-3">
              Opening Balance
            </span>
            <span />
            <span
              className={`font-mono text-xs text-right font-semibold ${openingBalance >= 0 ? "text-positive" : "text-negative"}`}
            >
              {openingBalance >= 0 ? "+" : "-"}
              {formatCAD(openingBalance)}
            </span>
          </div>
        )}
        {entries.map((tx) => {
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
              <span
                className={`font-mono text-xs text-right font-semibold ${deltaPositive ? "text-positive" : "text-negative"}`}
              >
                {deltaPositive ? "+" : "-"}
                {formatCAD(tx.shareholderLoanDelta)}
              </span>
              <span
                className={`font-mono text-xs text-right font-semibold ${balancePositive ? "text-positive" : "text-negative"}`}
              >
                {balancePositive ? "+" : "-"}
                {formatCAD(tx.runningBalance)}
              </span>
            </div>
          );
        })}
      </ListContainer>
    </>
  );
}
