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
  const monthDay = new Date(y, m - 1, d).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
  return `${monthDay} '${String(y).slice(2)}`;
}

export interface LoanLedgerEntry {
  _id: Id<"transactions">;
  // Unique per row — a dividend paid on a different date than it was declared expands
  // into two rows sharing one _id (see expandLoanLedgerRows), so this is the React key.
  legKey: string;
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
    <ListContainer>
      {openingBalance !== undefined && (
        <div className="flex items-center gap-3 px-4 py-3 min-h-[44px] bg-border/30">
          <span className="flex-1 min-w-0 truncate text-xs text-text-muted font-mono">
            Opening Balance
          </span>
          <span
            className={`shrink-0 font-mono text-sm text-right font-semibold ${openingBalance >= 0 ? "text-positive" : "text-negative"}`}
          >
            {openingBalance >= 0 ? "+" : "-"}
            {formatCAD(openingBalance)}
          </span>
        </div>
      )}
      {entries.map((tx) => {
        // A dividend declared and paid the same day nets to a 0 delta (see CONTEXT.md)
        // but still belongs on this ledger — show it neutrally rather than defaulting to
        // a misleading "-$0.00". A dividend paid on a later date instead shows as two
        // rows (+amount declared, -amount paid — see expandLoanLedgerRows), neither zero.
        const deltaZero = tx.shareholderLoanDelta === 0;
        const deltaPositive = tx.shareholderLoanDelta > 0;
        const balancePositive = tx.runningBalance >= 0;
        return (
          <div key={tx.legKey} className="flex flex-col gap-1 px-4 py-3 min-h-[44px] justify-center">
            <div className="flex items-baseline gap-2">
              <span className="flex-1 min-w-0 truncate text-sm text-text-primary">
                {tx.description}
              </span>
              <span
                className={`shrink-0 font-mono text-sm font-semibold ${deltaZero ? "text-text-muted" : deltaPositive ? "text-positive" : "text-negative"}`}
              >
                {deltaZero ? "" : deltaPositive ? "+" : "-"}
                {formatCAD(tx.shareholderLoanDelta)}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="flex-1 min-w-0 text-xs text-text-muted font-mono">
                {formatShortDate(tx.date)}
              </span>
              <span
                className={`shrink-0 font-mono text-xs opacity-75 ${balancePositive ? "text-positive" : "text-negative"}`}
              >
                bal {balancePositive ? "+" : "-"}
                {formatCAD(tx.runningBalance)}
              </span>
            </div>
          </div>
        );
      })}
    </ListContainer>
  );
}
