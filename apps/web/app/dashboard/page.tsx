import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Gauge, Radar } from "lucide-react";
import { DailyComparisonChart } from "@/components/dashboard/daily-comparison-chart";
import { PublicShell } from "@/components/layout/public-shell";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { SalinityChart } from "@/components/stations/salinity-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getPublicRepositories } from "@/lib/publicRead";
import { getDashboardMetrics } from "@/lib/repositories";
import { formatSalinity, formatWaterLevel, severityLabel } from "@/lib/utils";
import type { DailyComparisonPoint, EnvironmentalEvent, StationReadingSnapshot, TrendPoint } from "@/types";
import DashboardLoading from "./loading";

export const revalidate = 60;

const stationZones = [
  {
    id: "STATION_01",
    href: "/s/STATION_01",
    label: "Trạm 1",
    title: "Gần sông",
    description: "Mực nước, độ mặn và biến động ven sông",
    position: "left-[11%] top-[31%] h-[22%] w-[15%]",
  },
  {
    id: "STATION_02",
    href: "/s/STATION_02",
    label: "Trạm 2",
    title: "Giữa cồn",
    description: "Dữ liệu đất và gợi ý chăm sóc trồng trọt",
    position: "left-[35%] top-[39%] h-[22%] w-[15%]",
  },
  {
    id: "STATION_03",
    href: "/s/STATION_03",
    label: "Trạm 3",
    title: "Gateway",
    description: "Tổng hợp và gửi dữ liệu qua SIM, Zalo",
    position: "left-[68%] top-[49%] h-[22%] w-[16%]",
  },
];

function demoDailyComparison(): DailyComparisonPoint[] {
  const formatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" });

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.now() - (6 - index) * 24 * 60 * 60 * 1000);
    return {
      date: formatter.format(date),
      tideLevel: 46 + index * 3 + (index % 2 === 0 ? 4 : -1),
      salinity: Number((1.05 + index * 0.14 + (index % 3) * 0.07).toFixed(2)),
      soilEc: Number((0.82 + index * 0.07 + (index % 2) * 0.04).toFixed(2)),
      readingCount: 0,
    };
  });
}

function StationMap() {
  return (
    <section className="mb-8">
      <div className="mb-4 max-w-3xl">
        <p className="mb-3 text-xs uppercase tracking-[0.18em] text-accent">Bản đồ quan trắc</p>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Chạm vào từng trạm để xem dữ liệu trực tiếp
        </h2>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          Bản đồ mô phỏng các điểm quan trắc trên Cồn Hô: trạm nước gần sông, trạm đất ở giữa cồn và gateway gửi thông
          tin về cho bà con.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <Image
          src="/images/con-ho-station-map.png"
          alt="Bản đồ Cồn Hô với ba trạm quan trắc Horizon"
          width={1632}
          height={967}
          priority
          className="h-auto w-full"
        />

        {stationZones.map((station) => (
          <Link
            key={station.id}
            href={station.href}
            aria-label={`${station.label} - ${station.title}: ${station.description}`}
            title={`${station.label} - ${station.title}`}
            className={`absolute ${station.position} z-10 rounded-xl opacity-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
          >
            <span className="sr-only">{station.label}</span>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {stationZones.map((station) => (
          <Link key={station.id} href={station.href} className="block rounded-2xl focus-visible:ring-2 focus-visible:ring-accent">
            <Card className="h-full transition hover:border-accent/30">
              <CardContent>
                <p className="text-sm font-medium text-accent">{station.label}</p>
                <h3 className="mt-1 text-lg font-semibold tracking-tight">{station.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{station.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
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
        <>
          <StationMap />
          <DailyComparisonChart data={demoDailyComparison()} />
          <EmptyState
            title="Horizon Dashboard"
            description="Bản đồ đã sẵn sàng. Dữ liệu trực tiếp sẽ hiện khi cấu hình Supabase local hoặc backend triển khai được kết nối."
          />
        </>
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
    const averageWaterLevel =
      readingValues.length > 0
        ? readingValues.reduce((sum, reading) => sum + reading.water_level, 0) / readingValues.length
        : 0;
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
    const freshness = latestTimestamp
      ? `Cập nhật ${new Intl.DateTimeFormat("vi-VN", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(latestTimestamp))}`
      : "Chưa có dữ liệu đo";

    const trendSummary = await buildTrendSummary(repos, scope, featuredSnapshot?.station.id);

    return (
      <>
        <InstallPrompt />
        <StationMap />
        <DailyComparisonChart data={dailyComparison} />

        <section className="mb-10 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="healthy">Mạng lưới thời gian thực</Badge>
            <Badge variant="default">Bảng quan trắc Cồn Hô</Badge>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl space-y-3">
              <p className="text-xs uppercase tracking-[0.22em] text-accent">Quan trắc trực tiếp</p>
              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Tình hình môi trường hôm nay</h2>
              <p className="text-sm leading-relaxed text-muted">
                Bảng dưới đây cho biết mạng lưới đang ổn hay cần chú ý, và điều gì vừa thay đổi gần nhất.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link href="/report">Gửi báo cáo hiện trường</Link>
              </Button>
              <Button asChild>
                <Link href="/about">Xem câu chuyện dự án</Link>
              </Button>
            </div>
          </div>

          <dl className="grid gap-6 border-y border-border/40 py-6 sm:grid-cols-2 xl:grid-cols-4">
            <TelemetryStat label="Cập nhật gần nhất" value={freshness} />
            <TelemetryStat label="Trạm hoạt động" value={`${metrics.activeStations}/${metrics.totalStations}`} />
            <TelemetryStat label="Tín hiệu yếu" value={`${metrics.weakSignalNodes}`} />
            <TelemetryStat label="Cảnh báo cần chú ý" value={`${metrics.criticalAlerts}`} />
          </dl>
        </section>

        <section className="grid gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="space-y-8">
            <SalinityChart
              data={trendSummary?.points ?? []}
              stationName={featuredSnapshot?.station.name ?? "Cồn Hô"}
              threshold={threshold}
            />

            <div className="space-y-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-accent">Cập nhật ưu tiên</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight">Cảnh báo</h3>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <Gauge className="h-3.5 w-3.5 text-accent" aria-hidden />
                  {allAlerts.length} sự kiện gần đây
                </div>
              </div>

              {alerts.length === 0 ? (
                <EmptyState
                  title="Không có cảnh báo mới"
                  description="Mạng lưới đang vận hành bình thường. Cảnh báo sẽ xuất hiện ở đây khi một trạm cần chú ý."
                />
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="flex items-start justify-between gap-4 border-b border-border/30 py-4">
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
          </div>

          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-accent">Trạm trực tiếp</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight">Danh sách trạm theo mức ưu tiên</h3>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <Radar className="h-3.5 w-3.5 text-accent" aria-hidden />
                  Xếp theo mức rủi ro
                </div>
              </div>

              <div className="space-y-0">
                {sortedSnapshots.map((snapshot, index) => (
                  <Link
                    key={snapshot.station.id}
                    href={`/s/${snapshot.station.id}`}
                    className="flex items-center justify-between border-b border-border/30 py-4 transition-opacity hover:opacity-70"
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

            {trendSummary ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-accent">Xu hướng hiện tại</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight">Biên độ và chênh lệch</h3>
                </div>
                <div className="space-y-4 border-t border-border/40 pt-4">
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
                      <p className="text-2xl font-semibold tracking-tight">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </>
    );
  } catch {
    return (
      <>
        <StationMap />
        <DailyComparisonChart data={demoDailyComparison()} />
        <EmptyState
          title="Horizon Dashboard"
          description="Hệ thống đang ở chế độ demo hoặc chưa được cấu hình Supabase trên môi trường triển khai. Dashboard sẽ hiển thị dữ liệu thực khi các biến môi trường được cấu hình đầy đủ."
        />
      </>
    );
  }
}

function TelemetryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs uppercase tracking-[0.16em] text-muted">{label}</dt>
      <dd className="text-xl font-semibold tracking-tight">{value}</dd>
    </div>
  );
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
