import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/layout/app-shell";

export default function StationLoading() {
  return (
    <AppShell activePath="/stations">
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    </AppShell>
  );
}
