import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function ReportsLoading() {
  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-5">
      <Skeleton className="h-8 w-28" />

      <Card className="p-4 space-y-3">
        <Skeleton className="h-4 w-24" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-9 w-full rounded-xl" />
          <Skeleton className="h-9 w-full rounded-xl" />
        </div>
      </Card>

      <div className="space-y-2">
        <Skeleton className="h-4 w-20 mx-1" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4 space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-24" />
            </Card>
          ))}
        </div>
      </div>

      <Skeleton className="h-10 w-32 rounded-2xl" />
    </div>
  );
}
