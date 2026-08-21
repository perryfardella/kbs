import Link from "next/link";
import { ListItem } from "@/components/ui/list-container";
import { Badge } from "@/components/ui/badge";
import {
  badgeVariantFor,
  describeTransactionType,
  tryShapeFromFields,
  type LooseShapeFields,
} from "@/lib/transactionFields";

const BORDER_BY_VARIANT: Record<string, string> = {
  personal: "border-badge-personal",
  business: "border-badge-business",
  transfer: "border-badge-transfer",
  rental: "border-badge-rental",
};

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

interface TransactionRowProps {
  tx: LooseShapeFields & { _id: string; date: string; description: string; amount: number };
  href: string;
}

export function TransactionRow({ tx, href }: TransactionRowProps) {
  const shape = tryShapeFromFields(tx);
  const label = shape ? describeTransactionType(shape) : "";
  const variant = shape ? badgeVariantFor(shape) : "transfer";
  const borderColor = BORDER_BY_VARIANT[variant] ?? "border-badge-transfer";

  return (
    <ListItem
      asChild
      className={`min-h-0 items-stretch gap-0 border-l-[3px] py-3 pr-4 pl-3 ${borderColor}`}
    >
      <Link href={href}>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2.5">
            <span className="truncate text-sm font-medium text-text-primary">
              {tx.description}
            </span>
            <span className="shrink-0 font-mono text-[15px] font-semibold text-text-primary">
              {formatCAD(tx.amount)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2.5">
            <Badge variant={variant}>{label}</Badge>
            <span className="shrink-0 font-mono text-xs text-text-muted">
              {formatShortDate(tx.date)}
            </span>
          </div>
        </div>
      </Link>
    </ListItem>
  );
}
