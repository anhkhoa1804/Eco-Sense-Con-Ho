import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { AlertCard } from "@/components/alerts/alert-card";
import { DailyComparisonChart } from "@/components/dashboard/daily-comparison-chart";
import { MetricCard } from "@/components/dashboard/metric-card";
import { StationCard } from "@/components/dashboard/station-card";
import { PublicShell } from "@/components/layout/public-shell";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { Card, CardContent } from "@/components/ui/card";
import { getPublicRepositories } from "@/lib/publicRead";
import { getDashboardMetrics } from "@/lib/repositories";
import { formatSalinity, formatWaterLevel } from "@/lib/utils";
import type { DailyComparisonPoint } from "@/types";
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

async function DashboardContent() {
  try {
    const publicRepos = getPublicRepositories();

    if (!publicRepos) {
      return (
        <>
          <StationMap />
          <DailyComparisonChart data={demoDailyComparison()} />
          <section className="max-w-3xl">
            <h2 className="text-3xl font-semibold">Horizon Dashboard</h2>
            <p className="mt-4 text-muted">
              Bản đồ đã sẵn sàng. Dữ liệu trực tiếp sẽ hiện khi cấu hình Supabase local hoặc backend triển khai được kết
              nối.
            </p>
          </section>
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

    const readingValues = snapshots.flatMap((snapshot) =>
      snapshot.reading ? [snapshot.reading] : [],
    );

    const averageWaterLevel =
      readingValues.length > 0
        ? readingValues.reduce((sum, reading) => sum + reading.water_level, 0) / readingValues.length
        : 0;

    const stationNames = new Map(
      snapshots.map((snapshot) => [snapshot.station.id, snapshot.station.name]),
    );

    const allAlerts = [...critical, ...warning, ...info];

    return (
      <>
        <InstallPrompt />
        <StationMap />
        <DailyComparisonChart data={dailyComparison} />

        <section aria-label="Tóm tắt vận hành" className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Độ mặn trung bình"
            value={formatSalinity(metrics.averageSalinity)}
            note="Dữ liệu mới nhất từ các trạm"
          />
          <MetricCard
            label="Mực nước trung bình"
            value={formatWaterLevel(averageWaterLevel)}
            note="Tổng hợp từ các bản ghi gần nhất"
          />
          <MetricCard
            label="Trạm hoạt động"
            value={`${metrics.activeStations}/${metrics.totalStations}`}
            note="Mức phủ của mạng lưới"
          />
          <MetricCard
            label="Cảnh báo cần chú ý"
            value={String(metrics.criticalAlerts)}
            note="Xuất hiện trong 24 giờ gần nhất"
          />
        </section>

        <section aria-label="Danh sách trạm" className="mb-8">
          <div className="mb-4">
            <h3 className="text-2xl font-semibold tracking-tight">Danh sách trạm</h3>
            <p className="mt-1 text-sm text-muted">
              Mỗi thẻ hiển thị chỉ số chính; bấm vào trạm để xem dữ liệu đo trực tiếp.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {snapshots.map((snapshot) => (
              <StationCard key={snapshot.station.id} snapshot={snapshot} />
            ))}
          </div>
        </section>

        <section aria-label="Cảnh báo" className="space-y-4">
          <div>
            <h3 className="text-2xl font-semibold tracking-tight">Cảnh báo</h3>
            <p className="mt-1 text-sm text-muted">Một danh sách duy nhất, theo mức độ ưu tiên.</p>
          </div>

          {alerts.length === 0 ? (
            <p className="text-muted">Hiện không có cảnh báo mới.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {alerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  stationName={stationNames.get(alert.station_id)}
                />
              ))}
            </div>
          )}

          {allAlerts.length === 0 && (
            <p className="text-muted">
              Không có cảnh báo trong 7 ngày gần nhất. Mạng lưới đang vận hành bình thường.
            </p>
          )}
        </section>
      </>
    );
  } catch {
    return (
      <>
        <StationMap />
        <DailyComparisonChart data={demoDailyComparison()} />
        <section className="max-w-3xl py-8">
          <h2 className="mb-4 text-3xl font-semibold">Horizon Dashboard</h2>
          <p className="text-muted">
            Hệ thống đang ở chế độ demo hoặc chưa được cấu hình Supabase trên môi trường triển khai.
          </p>
          <p className="mt-3 text-sm text-muted">
            Dashboard sẽ hiển thị dữ liệu thực khi các biến môi trường được cấu hình đầy đủ.
          </p>
        </section>
      </>
    );
  }
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
