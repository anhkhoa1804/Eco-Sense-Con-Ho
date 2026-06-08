import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SalinityChart } from "@/components/stations/salinity-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createRepositories } from "@/lib/repositories";
import { formatSalinity, formatTimestamp, formatWaterLevel } from "@/lib/utils";
import StationLoading from "./loading";

async function StationDetail({ stationId }: { stationId: string }) {
  const { scope } = await getSessionContext();
  if (!scope) {
    notFound();
  }

  const supabase = await createClient();
  const repos = createRepositories(supabase);

  const [station, reading, health, trend] = await Promise.all([
    repos.stations.getById(stationId, scope),
    repos.readings.getLatestByStation(stationId, scope),
    repos.readings.getLatestHealthByStation(stationId, scope),
    repos.readings.getTrend24h(stationId, scope),
  ]);

  if (!station) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="font-serif text-3xl tracking-tight">{station.name}</h2>
          <Badge variant={station.status === "active" ? "success" : station.status === "maintenance" ? "warning" : "default"}>
            {station.status}
          </Badge>
        </div>
        <p className="text-muted">{station.id}</p>
        <p className="text-sm text-muted">
          {station.lat.toFixed(5)}, {station.lng.toFixed(5)}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader><CardTitle>Salinity</CardTitle></CardHeader>
          <CardContent className="font-serif text-3xl">{reading ? formatSalinity(reading.salinity) : "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Water level</CardTitle></CardHeader>
          <CardContent className="text-2xl">{reading ? formatWaterLevel(reading.water_level) : "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Battery</CardTitle></CardHeader>
          <CardContent className="text-2xl">{health ? `${health.battery_voltage.toFixed(2)} V` : "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Signal</CardTitle></CardHeader>
          <CardContent className="text-2xl">{health ? `${health.signal_strength_dbm} dBm` : "—"}</CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Sensor status</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p>EC probe: {reading?.ec_probe_status ?? "—"}</p>
            <p>Ultrasonic: {reading?.ultrasonic_status ?? "—"}</p>
            <p>Fault flags: {reading?.fault_flags ?? 0}</p>
            <p className="text-sm text-muted">
              Last reading: {reading ? formatTimestamp(reading.timestamp) : "No data"}
            </p>
            <p className="text-sm text-muted">
              Firmware: {health?.firmware_version ?? "—"}
            </p>
          </CardContent>
        </Card>
        <SalinityChart data={trend} stationName={station.name} />
      </section>
    </div>
  );
}

export default async function StationPage({ params }: { params: Promise<{ stationId: string }> }) {
  const { stationId } = await params;

  return (
    <AppShell activePath="/stations">
      <Suspense fallback={<StationLoading />}>
        <StationDetail stationId={stationId} />
      </Suspense>
    </AppShell>
  );
}
