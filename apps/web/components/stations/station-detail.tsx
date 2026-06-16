import Link from "next/link";
import { notFound } from "next/navigation";
import { SalinityChart } from "@/components/stations/salinity-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicRepositories } from "@/lib/publicRead";
import { formatSalinity, formatTimestamp, formatWaterLevel } from "@/lib/utils";

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

function healthLabel(batteryVoltage?: number | null): string {
  if (batteryVoltage === undefined || batteryVoltage === null) {
    return "Chưa có dữ liệu";
  }

  return batteryVoltage >= 3.6 ? "Đang vận hành bình thường" : "Cần kiểm tra";
}

export async function StationDetail({ stationId }: { stationId: string }) {
  const context = getPublicRepositories();
  if (!context) {
    return <div>Dữ liệu không khả dụng.</div>;
  }
  const { repos, scope } = context;

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
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-3xl font-semibold tracking-tight">{station.name}</h2>
          <Badge variant={station.status === "active" ? "success" : station.status === "maintenance" ? "warning" : "critical"}>
            {stationStatusLabel(station.status)}
          </Badge>
        </div>
        <p className="text-sm text-muted">
          Cập nhật gần nhất: {reading ? formatTimestamp(reading.timestamp) : "Chưa có dữ liệu gần nhất"}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Độ mặn</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{reading ? formatSalinity(reading.salinity) : "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Mực nước</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{reading ? formatWaterLevel(reading.water_level) : "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tình trạng trạm</CardTitle>
          </CardHeader>
          <CardContent className="text-lg text-muted">{healthLabel(health?.battery_voltage)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cập nhật gần nhất</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted">{reading ? formatTimestamp(reading.timestamp) : "Chưa có dữ liệu"}</CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <SalinityChart data={trend} stationName={station.name} />
        <Card>
          <CardHeader>
            <CardTitle>Giải thích nhanh</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Tổng quan</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Trang này ưu tiên đọc nhanh độ mặn và mực nước trước, sau đó mới mở phần kỹ thuật nếu cần.
              </p>
            </div>
            <details className="rounded-xl border border-border bg-muted/20 px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium">Thông tin kỹ thuật</summary>
              <div className="mt-3 space-y-2 text-sm text-muted">
                <p>Mã trạm: {station.id}</p>
                <p>Pin: {health ? `${health.battery_voltage.toFixed(2)} V` : "—"}</p>
                <p>Tín hiệu: {health ? `${health.signal_strength_dbm} dBm` : "—"}</p>
                <p>Trạng thái cảm biến độ mặn: {reading?.ec_probe_status ?? "—"}</p>
                <p>Trạng thái cảm biến mực nước: {reading?.ultrasonic_status ?? "—"}</p>
              </div>
            </details>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href="/dashboard">Về bảng quan trắc</Link>
        </Button>
        <Button asChild>
          <Link href={`/report?station=${encodeURIComponent(stationId)}`}>Báo cáo gần trạm này</Link>
        </Button>
      </section>
    </div>
  );
}
