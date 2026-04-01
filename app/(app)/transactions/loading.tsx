import { Skeleton } from "@/components/ui/skeleton";
import { ListContainer, ListItem } from "@/components/ui/list-container";
import { PageHeader } from "@/components/PageHeader";
import { Toggle } from "@/components/ui/toggle";
import { Search } from "lucide-react";

export default function TransactionsLoading() {
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Transactions" />

      <div className="px-4 pt-4 pb-6 space-y-4">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 min-h-[44px]">
          <Search size={16} className="text-text-muted shrink-0" />
          <Skeleton className="h-4 flex-1" />
        </div>
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-0.5">
          {["All", "Personal", "Business", "Transfers", "Date Range"].map((label) => (
            <Toggle key={label}>{label}</Toggle>
          ))}
        </div>

        {Array.from({ length: 3 }).map((_, gi) => (
          <div key={gi} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <ListContainer>
              {Array.from({ length: 4 }).map((_, i) => (
                <ListItem key={i}>
                  <Skeleton className="h-1.5 w-1.5 rounded-full shrink-0" />
                  <Skeleton className="h-4 w-12 shrink-0" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-5 w-16 shrink-0" />
                  <Skeleton className="h-4 w-16 shrink-0" />
                </ListItem>
              ))}
            </ListContainer>
          </div>
        ))}
      </div>
    </div>
  );
}
