import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Gauge, Radar } from "lucide-react";
import { DailyComparisonChart } from "@/components/dashboard/daily-comparison-chart";
import { MapStation, StationNetworkMap } from "@/components/dashboard/station-network-map";
import { PublicShell } from "@/components/layout/public-shell";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { SalinityChart } from "@/components/stations/salinity-chart";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Metric } from "@/components/ui/metric";
import { SectionHeader } from "@/components/ui/section-header";
import { freshnessStatus, StatusIndicator } from "@/components/ui/status-indicator";
import { getPublicRepositories } from "@/lib/publicRead";
import { getDashboardMetrics } from "@/lib/repositories";
import { formatSalinity, formatWaterLevel, severityLabel } from "@/lib/utils";
import type { EnvironmentalEvent, StationReadingSnapshot, TrendPoint } from "@/types";
import DashboardLoading from "./loading";

export const revalidate = 60;

function StationNetwork({ snapshots }: { snapshots: StationReadingSnapshot[] }) {
  const mapStations: MapStation[] = snapshots.map((snapshot) => ({
    id: snapshot.station.id,
    name: snapshot.station.name,
    lat: snapshot.station.lat,
    lng: snapshot.station.lng,
    freshness: freshnessStatus(snapshot.reading?.timestamp ?? snapshot.health?.timestamp ?? null),
  }));

  return (
    <section className="space-y-4">
      <SectionHeader eyebrow="Mạng lưới trạm" title="Vị trí quan trắc" trailing="Danh sách đầy đủ có ở phần điều kiện hiện tại bên dưới." />
      <StationNetworkMap stations={mapStations} />
    </section>
  );
}

type TrendSummary = {
  current: number;
  average: number;
  delta: number;
  label: string;
  points: TrendPoint[];
};

async function DashboardContent() {
  try {
    const publicRepos = getPublicRepositories();
    if (!publicRepos) {
      return (
        <div className="space-y-10">
          <EmptyState
            title="Chưa kết nối dữ liệu trực tiếp"
            description="Bảng quan trắc chưa được cấu hình kết nối tới Supabase trên môi trường này, nên không có số liệu thật để hiển thị. Không có bản đồ, biểu đồ hay chỉ số nào bên dưới là dữ liệu thực."
          />
        </div>
      );
    }

    const { repos, scope } = publicRepos;

    const [metrics, snapshots, alerts, critical, warning, info, dailyComparison] = await Promise.all([
      getDashboardMetrics(repos, scope),
      repos.readings.getSnapshots(scope),
      repos.alerts.getRecent(6, scope),
      repos.alerts.getBySeverity("critical", scope),
      repos.alerts.getBySeverity("warning", scope),
      repos.alerts.getBySeverity("info", scope),
      repos.readings.getDailyComparison(scope),
    ]);
    const threshold = await repos.readings.getDefaultSalinityThreshold();

    const readingValues = snapshots.flatMap((snapshot) => (snapshot.reading ? [snapshot.reading] : []));
    const latestTimestamp = readingValues
      .map((reading) => new Date(reading.timestamp).getTime())
      .filter(Number.isFinite)
      .sort((a, b) => b - a)[0];

    const allAlerts = [...critical, ...warning, ...info];
    const stationAlertMap = new Map<string, EnvironmentalEvent[]>();
    for (const alert of allAlerts) {
      const stationAlerts = stationAlertMap.get(alert.station_id) ?? [];
      stationAlerts.push(alert);
      stationAlertMap.set(alert.station_id, stationAlerts);
    }

    const sortedSnapshots = [...snapshots].sort(
      (first, second) => stationPriority(first, stationAlertMap) - stationPriority(second, stationAlertMap),
    );
    const featuredSnapshot = sortedSnapshots.find((snapshot) => snapshot.reading) ?? sortedSnapshots[0];
    const stationNames = new Map(
      snapshots.map((snapshot) => [snapshot.station.id, snapshot.station.name]),
    );
    const latestTimestampIso = latestTimestamp ? new Date(latestTimestamp).toISOString() : null;
    const freshness = latestTimestamp
      ? `Cập nhật ${new Intl.DateTimeFormat("vi-VN", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(latestTimestamp))}`
      : "Chưa có dữ liệu đo";

    const trendSummary = await buildTrendSummary(repos, scope, featuredSnapshot?.station.id);

    return (
      <div className="space-y-10">
        <InstallPrompt />

        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-accent">Quan trắc trực tiếp</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Bảng quan trắc Cồn Hô</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/report">Gửi báo cáo hiện trường</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/about">Xem câu chuyện dự án</Link>
            </Button>
          </div>
        </div>

        {/* Global status */}
        <dl className="grid gap-6 border-y border-border/60 py-6 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Cập nhật gần nhất" value={freshness} status={freshnessStatus(latestTimestampIso)} size="sm" />
          <Metric label="Trạm hoạt động" value={`${metrics.activeStations}/${metrics.totalStations}`} size="sm" />
          <Metric label="Tín hiệu yếu" value={metrics.weakSignalNodes} size="sm" />
          <Metric label="Cảnh báo cần chú ý" value={metrics.criticalAlerts} size="sm" />
        </dl>

        {/* Station network */}
        <StationNetwork snapshots={snapshots} />

        {/* Current conditions + anomalies */}
        <section className="grid gap-10 lg:grid-cols-2 lg:items-start">
          <div className="space-y-4">
            <SectionHeader
              eyebrow="Điều kiện hiện tại"
              title="Trạm theo mức ưu tiên"
              trailing={
                <span className="inline-flex items-center gap-2">
                  <Radar className="h-3.5 w-3.5 text-accent" aria-hidden />
                  Xếp theo mức rủi ro
                </span>
              }
            />

            <div className="space-y-0">
              {sortedSnapshots.map((snapshot, index) => (
                <Link
                  key={snapshot.station.id}
                  href={`/s/${snapshot.station.id}`}
                  className="flex items-center justify-between border-b border-border/50 py-4 transition-opacity hover:opacity-70"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{snapshot.station.name}</p>
                    <p className="text-sm text-muted">
                      {snapshot.reading
                        ? `Độ mặn ${formatSalinity(snapshot.reading.salinity)} · Mực nước ${formatWaterLevel(snapshot.reading.water_level)}`
                        : "Chưa có dữ liệu gần nhất"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs uppercase tracking-[0.14em] text-muted">
                      {index === 0 ? "Ưu tiên hàng đầu" : "Theo dõi"}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted" aria-hidden />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <SectionHeader
              eyebrow="Bất thường"
              title="Cảnh báo"
              trailing={
                <span className="inline-flex items-center gap-2">
                  <Gauge className="h-3.5 w-3.5 text-accent" aria-hidden />
                  {allAlerts.length} sự kiện gần đây
                </span>
              }
            />

            {alerts.length === 0 ? (
              <EmptyState
                title="Không có cảnh báo mới"
                description="Mạng lưới đang vận hành bình thường. Cảnh báo sẽ xuất hiện ở đây khi một trạm cần chú ý."
              />
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div key={alert.id} className="flex items-start justify-between gap-4 border-b border-border/50 py-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {stationNames.get(alert.station_id) ?? alert.station_id}
                      </p>
                      <p className="mt-1 text-sm text-muted">{alert.message_id ?? alert.event_type}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-medium">{severityLabel(alert.severity)}</p>
                      <p className="text-muted">{new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(alert.timestamp))}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Trends */}
        <section className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div>
            <SalinityChart
              data={trendSummary?.points ?? []}
              stationName={featuredSnapshot?.station.name ?? "Cồn Hô"}
              threshold={threshold}
            />
          </div>

          {trendSummary ? (
            <div className="space-y-4">
              <SectionHeader eyebrow="Xu hướng 24 giờ" title="Biên độ và chênh lệch" />
              <div className="space-y-4 border-t border-border/50 pt-4">
                {[
                  { label: "Hiện tại", value: formatSalinity(trendSummary.current) },
                  { label: "Trung bình", value: formatSalinity(trendSummary.average) },
                  {
                    label: "Chênh lệch",
                    value: `${trendSummary.delta >= 0 ? "+" : ""}${formatSalinity(Math.abs(trendSummary.delta))}`,
                  },
                ].map((item) => (
                  <div key={item.label} className="flex items-baseline justify-between gap-4">
                    <p className="text-sm uppercase tracking-[0.14em] text-muted">{item.label}</p>
                    <p className="text-2xl font-semibold tracking-tight tabular-nums">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* Detail */}
        <DailyComparisonChart data={dailyComparison} />
      </div>
    );
  } catch {
    return (
      <div className="space-y-10">
        <EmptyState
          title="Không thể tải dữ liệu trực tiếp"
          description="Đã xảy ra lỗi khi kết nối tới nguồn dữ liệu. Không có bản đồ hay số liệu nào bên dưới là dữ liệu thực — vui lòng thử tải lại trang hoặc kiểm tra cấu hình backend."
        />
      </div>
    );
  }
}

async function buildTrendSummary(
  repos: NonNullable<ReturnType<typeof getPublicRepositories>>["repos"],
  scope: Parameters<typeof getDashboardMetrics>[1],
  stationId?: string,
): Promise<TrendSummary | null> {
  if (!stationId) return null;

  const points = await repos.readings.getTrend24h(stationId, scope);
  if (points.length === 0) return null;

  const values = points.map((point) => point.salinity);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const current = values[values.length - 1];
  const delta = current - values[0];
  const first = new Date(points[0].timestamp);
  const last = new Date(points[points.length - 1].timestamp);
  const label = `Từ ${new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(first)} đến ${new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(last)}`;

  return { current, average, delta, label, points };
}

function stationPriority(
  snapshot: StationReadingSnapshot,
  stationAlertMap: Map<string, EnvironmentalEvent[]>,
): number {
  const stationAlerts = stationAlertMap.get(snapshot.station.id) ?? [];
  const hasCriticalAlert = stationAlerts.some((alert) => alert.severity === "critical");
  const hasSensorFault =
    stationAlerts.some((alert) => alert.event_type === "SENSOR_FAULT") ||
    (snapshot.reading?.fault_flags ?? 0) > 0 ||
    snapshot.reading?.ec_probe_status === "fault" ||
    snapshot.reading?.ultrasonic_status === "fault";
  const isOffline =
    snapshot.station.status === "inactive" ||
    stationAlerts.some((alert) => alert.event_type === "OFFLINE");
  const hasWarning =
    snapshot.station.status === "maintenance" ||
    stationAlerts.some((alert) => alert.severity === "warning") ||
    snapshot.reading?.ec_probe_status === "warn" ||
    snapshot.reading?.ultrasonic_status === "warn";

  if (hasCriticalAlert) return 0;
  if (hasSensorFault) return 1;
  if (isOffline) return 2;
  if (hasWarning) return 3;
  if (snapshot.reading) return 4;
  return 5;
}

export default function DashboardPage() {
  return (
    <PublicShell activePath="/dashboard">
      <Suspense fallback={<DashboardLoading />}>
        <DashboardContent />
      </Suspense>
    </PublicShell>
  );
}
