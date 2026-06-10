import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatSalinity, formatTimestamp, formatWaterLevel } from "@/lib/utils";
import type { StationReadingSnapshot } from "@/types";

function stationStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Đang hoạt động";
    case "maintenance":
      return "Bảo trì";
    case "offline":
      return "Ngoại tuyến";
    default:
      return status;
  }
}

export function StationCard({ snapshot }: { snapshot: StationReadingSnapshot }) {
  const { station, reading, health } = snapshot;
  const salinity = reading?.salinity;
  const statusVariant =
    station.status === "active" ? "success" : station.status === "maintenance" ? "warning" : "critical";

  return (
    <Link href={`/s/${station.id}`} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      <Card className="h-full transition hover:border-accent/30">
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>{station.name}</CardTitle>
            <p className="text-sm text-muted">{station.id}</p>
          </div>
          <Badge variant={statusVariant}>{stationStatusLabel(station.status)}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Độ mặn</p>
              <p className="text-2xl font-semibold">{salinity !== undefined ? formatSalinity(salinity) : "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Mực nước</p>
              <p className="text-2xl font-semibold">{reading ? formatWaterLevel(reading.water_level) : "—"}</p>
            </div>
          </div>
          <p className="text-sm text-muted">
            {reading ? `Cập nhật ${formatTimestamp(reading.timestamp)}` : "Chưa có dữ liệu gần nhất"}
          </p>
          <details className="rounded-xl border border-border bg-muted/20 px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium">Thông tin kỹ thuật</summary>
            <div className="mt-3 grid gap-2 text-sm text-muted sm:grid-cols-2">
              <p>Pin: {health ? `${health.battery_voltage.toFixed(2)} V` : "—"}</p>
              <p>Tín hiệu: {health ? `${health.signal_strength_dbm} dBm` : "—"}</p>
              <p className="sm:col-span-2">Cờ lỗi: {reading ? reading.fault_flags : "—"}</p>
            </div>
          </details>
        </CardContent>
      </Card>
    </Link>
  );
}
