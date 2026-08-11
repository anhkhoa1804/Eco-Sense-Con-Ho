import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatSalinity, formatTimestamp, formatWaterLevel } from "@/lib/utils";
import type { SensorStatus, StationReadingSnapshot } from "@/types";

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

function sensorSummary(
  health: StationReadingSnapshot["health"],
  reading: StationReadingSnapshot["reading"],
): string {
  if (!health && !reading) {
    return "Cảm biến: Chưa có dữ liệu";
  }

  const hasFault =
    (reading?.fault_flags ?? 0) > 0 ||
    reading?.ec_probe_status === "fault" ||
    reading?.ultrasonic_status === "fault";
  const hasWarning =
    reading?.ec_probe_status === "warn" ||
    reading?.ultrasonic_status === "warn";

  if (hasFault) return "Cảm biến: Cần kiểm tra";
  if (hasWarning) return "Cảm biến: Cần chú ý";
  return "Cảm biến: Hoạt động bình thường";
}

function rawSensorStatus(status?: SensorStatus): string {
  return status ?? "—";
}

export function StationCard({ snapshot }: { snapshot: StationReadingSnapshot }) {
  const { station, reading, health } = snapshot;
  const salinity = reading?.salinity;
  const statusVariant =
    station.status === "active" ? "healthy" : station.status === "maintenance" ? "watch" : "offline";
  const statusText = stationStatusLabel(station.status);

  const ariaLabel = `Trạm ${station.name}, trạng thái ${statusText}, độ mặn ${
    salinity !== undefined ? formatSalinity(salinity) : "Chưa có dữ liệu"
  }, mực nước ${reading ? formatWaterLevel(reading.water_level) : "Chưa có dữ liệu"}, ${sensorSummary(health, reading)}`;

  return (
    <Link
      href={`/s/${station.id}`}
      className="block rounded-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={ariaLabel}
    >
      <Card className="h-full rounded-[18px] transition hover:border-accent/30">
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 p-4">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-xl">{station.name}</CardTitle>
            <p className="text-xs text-muted-foreground">{station.id}</p>
          </div>
          <Badge variant={statusVariant} className="shrink-0">
            {statusText}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-0">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Độ mặn</p>
              <p className="text-2xl font-semibold tabular-nums">{salinity !== undefined ? formatSalinity(salinity) : "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Mực nước</p>
              <p className="text-2xl font-semibold tabular-nums">{reading ? formatWaterLevel(reading.water_level) : "—"}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {reading ? `Cập nhật ${formatTimestamp(reading.timestamp)}` : "Chưa có dữ liệu gần nhất"}
          </p>
          <div className="rounded-[14px] border border-border bg-muted/20 px-3 py-3">
            <p className="text-sm font-medium">{sensorSummary(health, reading)}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
              <p>Pin: {health ? `${health.battery_voltage.toFixed(2)} V` : "—"}</p>
              <p>Tín hiệu: {health ? `${health.signal_strength_dbm} dBm` : "—"}</p>
              <p>Độ mặn: {rawSensorStatus(reading?.ec_probe_status)}</p>
              <p>Mực nước: {rawSensorStatus(reading?.ultrasonic_status)}</p>
              <p className="col-span-2">Cờ lỗi: {reading ? reading.fault_flags : "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
