import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/layout/app-shell";

export default function ProfileLoading() {
  return (
    <AppShell activePath="/profile">
      <div className="space-y-6">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-36" />
        <Skeleton className="h-48" />
      </div>
    </AppShell>
  );
}
