import { Id } from "@/convex/_generated/dataModel";
import {
  Kind,
  Realm,
  Side,
  Purpose,
  deriveCashDirection,
  shapeFromFields,
} from "@/lib/transactionFields";

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

function formatMonthYear(dateStr: string): string {
  const [y, m] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-CA", { month: "long", year: "numeric" });
}

export interface LoanLedgerListEntry {
  _id: Id<"transactions">;
  date: string;
  description: string;
  amount: number;
  shareholderLoanDelta: number;
  runningBalance: number;
  kind?: Kind;
  realm?: Realm;
  account?: Side;
  from?: Side;
  to?: Side;
  purpose?: Purpose;
}

type GroupItem =
  | { type: "row"; entry: LoanLedgerListEntry; isLastInGroup: boolean }
  | { type: "marker"; crossesTo: "you-owe" | "corp-owes" };

interface MonthGroup {
  key: string;
  label: string;
  closingBalance: number;
  items: GroupItem[];
}

function buildMonthGroups(entries: LoanLedgerListEntry[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  let prevBalance = 0;

  entries.forEach((entry, i) => {
    const key = entry.date.slice(0, 7);
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = { key, label: formatMonthYear(entry.date), closingBalance: entry.runningBalance, items: [] };
      groups.push(group);
    }

    if (i > 0) {
      const prevSign = Math.sign(prevBalance);
      const currSign = Math.sign(entry.runningBalance);
      if (prevSign !== currSign && prevSign !== 0 && currSign !== 0) {
        group.items.push({ type: "marker", crossesTo: currSign < 0 ? "you-owe" : "corp-owes" });
      }
    }

    group.items.push({ type: "row", entry, isLastInGroup: false });
    group.closingBalance = entry.runningBalance;
    prevBalance = entry.runningBalance;
  });

  for (const group of groups) {
    for (let i = group.items.length - 1; i >= 0; i--) {
      const item = group.items[i];
      if (item.type === "row") {
        item.isLastInGroup = true;
        break;
      }
    }
  }

  return groups;
}

function ZeroCrossingMarker({ crossesTo }: { crossesTo: "you-owe" | "corp-owes" }) {
  const color = crossesTo === "you-owe" ? "var(--loan-corp)" : "var(--loan-you)";
  const label = crossesTo === "you-owe" ? `crosses to "you owe"` : `crosses to "corp owes"`;
  const lineStyle = { background: `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 8px)` };
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="h-px flex-1" style={lineStyle} />
      <span className="whitespace-nowrap text-[9px] uppercase tracking-[0.05em]" style={{ color }}>
        {label}
      </span>
      <div className="h-px flex-1" style={lineStyle} />
    </div>
  );
}

function LoanLedgerRow({ entry, showBorder }: { entry: LoanLedgerListEntry; showBorder: boolean }) {
  const direction = deriveCashDirection(shapeFromFields(entry));
  const isYouToCorp = direction === "you-to-corp";
  const isOwedToYou = entry.runningBalance >= 0;

  return (
    <div className={`flex flex-col gap-1 py-2.5 ${showBorder ? "border-b border-border" : ""}`}>
      <div className="flex items-baseline justify-between gap-2.5">
        <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{entry.description}</span>
        <span
          className={`shrink-0 whitespace-nowrap font-mono text-[11px] font-semibold ${isYouToCorp ? "text-loan-you" : "text-loan-corp"}`}
        >
          {formatCAD(entry.amount)} {isYouToCorp ? "you → corp" : "corp → you"}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-2.5">
        <span className="font-mono text-[11px] text-text-muted">{formatShortDate(entry.date)}</span>
        <span className="flex items-baseline gap-[5px]">
          <span className="font-mono text-[13px] font-bold text-text-primary">{formatCAD(entry.runningBalance)}</span>
          <span className={`text-[10px] ${isOwedToYou ? "text-loan-you" : "text-loan-corp"}`}>
            {isOwedToYou ? "owed to you" : "owed to corp"}
          </span>
        </span>
      </div>
    </div>
  );
}

export function LoanLedgerList({
  entries,
  emptyMessage = "No loan-affecting transactions yet.",
}: {
  entries: LoanLedgerListEntry[];
  emptyMessage?: string;
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface px-4 py-8 text-center text-sm text-text-muted">
        {emptyMessage}
      </div>
    );
  }

  const groups = buildMonthGroups(entries);

  return (
    <div>
      {groups.map((group, gi) => (
        <div key={group.key}>
          <div
            className={`${gi === 0 ? "mt-1" : "mt-3.5"} mb-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-text-muted`}
          >
            {group.label} · closes owed to {group.closingBalance >= 0 ? "you" : "corp"} {formatCAD(group.closingBalance)}
          </div>
          <div className="border-t border-border">
            {group.items.map((item, ii) =>
              item.type === "marker" ? (
                <ZeroCrossingMarker key={`marker-${group.key}-${ii}`} crossesTo={item.crossesTo} />
              ) : (
                <LoanLedgerRow key={item.entry._id} entry={item.entry} showBorder={!item.isLastInGroup} />
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
