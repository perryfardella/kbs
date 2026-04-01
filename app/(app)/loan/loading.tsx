import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { ListContainer } from "@/components/ui/list-container";
import { PageHeader } from "@/components/PageHeader";

export default function LoanLoading() {
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Loan" />
      <div className="px-4 pt-4 pb-6 space-y-5">
        <Card className="p-5 space-y-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-48" />
        </Card>

        <div className="space-y-2">
          <Skeleton className="h-4 w-28 mx-1" />
          <ListContainer>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </ListContainer>
        </div>
      </div>
    </div>
  );
}
