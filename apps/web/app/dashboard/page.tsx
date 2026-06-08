import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { MetricCard } from "@/components/dashboard/metric-card";
import { StationCard } from "@/components/dashboard/station-card";
import { AlertCard } from "@/components/alerts/alert-card";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createRepositories, getDashboardMetrics } from "@/lib/repositories";
import { formatSalinity } from "@/lib/utils";
import DashboardLoading from "./loading";

async function DashboardContent() {
  const { scope } = await getSessionContext();
  if (!scope) {
    return null;
  }

  const supabase = await createClient();
  const repos = createRepositories(supabase);

  const [metrics, snapshots, alerts, stations] = await Promise.all([
    getDashboardMetrics(repos, scope),
    repos.readings.getSnapshots(scope),
    repos.alerts.getRecent(6, scope),
    repos.stations.getAll(scope),
  ]);

  const stationNames = new Map(stations.map((s) => [s.id, s.name]));

  return (
    <>
      <InstallPrompt />
      <section className="mb-8">
        <p className="mb-2 text-xs uppercase tracking-[0.18em] text-accent">Live network</p>
        <h2 className="font-serif text-3xl tracking-tight md:text-4xl">Cồn Hô monitoring dashboard</h2>
        <p className="mt-2 max-w-2xl text-muted">Real telemetry from Supabase — stations, salinity, alerts, and node health.</p>
      </section>

      <section aria-label="Summary metrics" className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Stations active" value={`${metrics.activeStations}/${metrics.totalStations}`} note="network coverage in Con Ho" />
        <MetricCard label="Average salinity" value={formatSalinity(metrics.averageSalinity)} note="latest reading per station" />
        <MetricCard label="Critical alerts" value={String(metrics.criticalAlerts)} note="last 24 hours" />
        <MetricCard label="Weak signal nodes" value={String(metrics.weakSignalNodes)} note="signal at or below -95 dBm" />
      </section>

      <section aria-label="Latest readings" className="mb-8">
        <h3 className="mb-4 font-serif text-2xl">Latest readings</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {snapshots.map((snapshot) => (
            <StationCard key={snapshot.station.id} snapshot={snapshot} />
          ))}
        </div>
      </section>

      <section aria-label="Recent alerts">
        <h3 className="mb-4 font-serif text-2xl">Recent alerts</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {alerts.length === 0 ? (
            <p className="text-muted">No recent alerts.</p>
          ) : (
            alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} stationName={stationNames.get(alert.station_id)} />
            ))
          )}
        </div>
      </section>
    </>
  );
}

export default function DashboardPage() {
  return (
    <AppShell activePath="/dashboard">
      <Suspense fallback={<DashboardLoading />}>
        <DashboardContent />
      </Suspense>
    </AppShell>
  );
}
