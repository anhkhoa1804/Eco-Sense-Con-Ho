import { Skeleton } from "@/components/ui/skeleton";
import { PublicShell } from "@/components/layout/public-shell";

export default function DashboardLoading() {
  return (
    <PublicShell activePath="/dashboard">
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-48" />
          ))}
        </div>
      </div>
    </PublicShell>
  );
}
