import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AlertCard } from "@/components/alerts/alert-card";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createRepositories } from "@/lib/repositories";
import AlertsLoading from "./loading";

async function AlertsContent() {
  const { scope } = await getSessionContext();
  if (!scope) {
    return null;
  }

  const supabase = await createClient();
  const repos = createRepositories(supabase);

  const [critical, warning, info, stations] = await Promise.all([
    repos.alerts.getBySeverity("critical", scope),
    repos.alerts.getBySeverity("warning", scope),
    repos.alerts.getBySeverity("info", scope),
    repos.stations.getAll(scope),
  ]);

  const stationNames = new Map(stations.map((s) => [s.id, s.name]));

  const sections = [
    { title: "Critical alerts", items: critical },
    { title: "Warning alerts", items: warning },
    { title: "Info alerts", items: info },
  ];

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-serif text-3xl tracking-tight">Operational alerts</h2>
        <p className="mt-2 text-muted">Active events from the last 7 days.</p>
      </section>
      {sections.map((section) => (
        <section key={section.title} aria-label={section.title}>
          <h3 className="mb-4 font-serif text-2xl">{section.title}</h3>
          {section.items.length === 0 ? (
            <p className="text-muted">No {section.title.toLowerCase()}.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {section.items.map((alert) => (
                <AlertCard key={alert.id} alert={alert} stationName={stationNames.get(alert.station_id)} />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

export default function AlertsPage() {
  return (
    <AppShell activePath="/alerts">
      <Suspense fallback={<AlertsLoading />}>
        <AlertsContent />
      </Suspense>
    </AppShell>
  );
}
