import { Suspense } from "react";
import { PublicShell } from "@/components/layout/public-shell";
import { StationDetail } from "@/components/stations/station-detail";
import { Skeleton } from "@/components/ui/skeleton";
export const revalidate = 60;

function StationFallback() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

export default async function QrStationPage({ params }: { params: Promise<{ stationId: string }> }) {
  const { stationId } = await params;

  return (
    <PublicShell activePath="/dashboard">
      <Suspense fallback={<StationFallback />}>
        <StationDetail stationId={stationId} />
      </Suspense>
    </PublicShell>
  );
}
