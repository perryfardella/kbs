import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";

export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Settings" />
      <div className="space-y-5 px-4 pt-4 pb-6">
        <div className="space-y-4">
          <Skeleton className="h-11 w-full rounded-2xl" />
          <Skeleton className="h-11 w-full rounded-2xl" />
          <Skeleton className="h-11 w-full rounded-2xl" />
          <Skeleton className="h-11 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-10 w-full rounded-2xl" />
      </div>
    </div>
  );
}
