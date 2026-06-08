import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatSalinity, formatWaterLevel } from "@/lib/utils";
import type { StationReadingSnapshot } from "@/types";

export function StationCard({ snapshot }: { snapshot: StationReadingSnapshot }) {
  const { station, reading, health } = snapshot;
  const salinity = reading?.salinity;
  const variant =
    salinity !== undefined && salinity >= 1.8 ? "critical" : salinity !== undefined && salinity >= 1.2 ? "warning" : "success";

  return (
    <Link href={`/stations/${station.id}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-2xl">
      <Card className="transition hover:border-accent/30">
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>{station.name}</CardTitle>
            <p className="text-sm text-muted">{station.id}</p>
          </div>
          <Badge variant={station.status === "active" ? "success" : station.status === "maintenance" ? "warning" : "default"}>
            {station.status}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted">Salinity</p>
            <p className="font-serif text-2xl">{salinity !== undefined ? formatSalinity(salinity) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Water level</p>
            <p className="text-lg">{reading ? formatWaterLevel(reading.water_level) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Battery</p>
            <p className="text-lg">{health ? `${health.battery_voltage.toFixed(2)} V` : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Signal</p>
            <p className="text-lg">{health ? `${health.signal_strength_dbm} dBm` : "—"}</p>
          </div>
          {reading && (
            <div className="sm:col-span-2">
              <Badge variant={variant}>Fault flags: {reading.fault_flags}</Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
