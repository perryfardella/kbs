import { Skeleton } from "@/components/ui/skeleton";
import { ListContainer, ListItem } from "@/components/ui/list-container";
import { PageHeader } from "@/components/PageHeader";

export default function TransactionsLoading() {
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title={<Skeleton className="h-7 w-36" />} />

      <div className="px-4 pt-4 pb-6 space-y-4">
        <Skeleton className="h-11 w-full rounded-2xl" />
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-0.5">
          <Skeleton className="h-8 w-10 rounded-full shrink-0" />
          <Skeleton className="h-8 w-20 rounded-full shrink-0" />
          <Skeleton className="h-8 w-24 rounded-full shrink-0" />
          <Skeleton className="h-8 w-24 rounded-full shrink-0" />
          <Skeleton className="h-8 w-28 rounded-full shrink-0" />
        </div>

        {Array.from({ length: 3 }).map((_, gi) => (
          <div key={gi} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <ListContainer>
              {Array.from({ length: 4 }).map((_, i) => (
                <ListItem key={i}>
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
