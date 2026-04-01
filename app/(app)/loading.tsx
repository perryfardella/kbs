import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { ListContainer, ListItem } from "@/components/ui/list-container";
import { PageHeader } from "@/components/PageHeader";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Dashboard" />
      <div className="space-y-5 px-4 pt-4 pb-6">
        <Card className="p-5 space-y-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-48" />
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 space-y-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 w-28" />
          </Card>
          <Card className="p-4 space-y-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 w-28" />
          </Card>
        </div>

        <div className="space-y-2">
          <Skeleton className="h-4 w-40 mx-1" />
          <ListContainer>
            {Array.from({ length: 5 }).map((_, i) => (
              <ListItem key={i}>
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-4 w-16" />
              </ListItem>
            ))}
          </ListContainer>
        </div>
      </div>
    </div>
  );
}
