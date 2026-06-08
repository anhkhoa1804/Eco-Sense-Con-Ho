import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/layout/app-shell";

export default function AlertsLoading() {
  return (
    <AppShell activePath="/alerts">
      <div className="space-y-6">
        <Skeleton className="h-10 w-56" />
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-40" />
        ))}
      </div>
    </AppShell>
  );
}
