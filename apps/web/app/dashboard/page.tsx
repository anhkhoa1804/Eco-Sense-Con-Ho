import { Suspense } from "react";
import { AlertCard } from "@/components/alerts/alert-card";
import { MetricCard } from "@/components/dashboard/metric-card";
import { StationCard } from "@/components/dashboard/station-card";
import { PublicShell } from "@/components/layout/public-shell";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { getPublicRepositories } from "@/lib/publicRead";
import { getDashboardMetrics } from "@/lib/repositories";
import { formatSalinity, formatWaterLevel } from "@/lib/utils";
import DashboardLoading from "./loading";

export const revalidate = 60;

async function DashboardContent() {
  try {
    const publicRepos = getPublicRepositories();

    if (!publicRepos) {
      return (
        <section className="max-w-3xl">
          <h2 className="text-3xl font-semibold">
            Eco-Sense Dashboard
          </h2>

          <p className="mt-4 text-muted">
            Demo deployment is running without a configured Supabase backend.
          </p>

          <p className="mt-2 text-muted">
            Live telemetry, alerts, and station data will appear once backend
            services are connected.
          </p>
        </section>
      );
    }

    const { repos, scope } = publicRepos;

    const [metrics, snapshots, alerts, critical, warning, info] = await Promise.all([
      getDashboardMetrics(repos, scope),
      repos.readings.getSnapshots(scope),
      repos.alerts.getRecent(6, scope),
      repos.alerts.getBySeverity("critical", scope),
      repos.alerts.getBySeverity("warning", scope),
      repos.alerts.getBySeverity("info", scope),
    ]);

    const readingValues = snapshots.flatMap((snapshot) =>
      snapshot.reading ? [snapshot.reading] : [],
    );

    const averageWaterLevel =
      readingValues.length > 0
        ? readingValues.reduce(
            (sum, reading) => sum + reading.water_level,
            0,
          ) / readingValues.length
        : 0;

    const stationNames = new Map(
      snapshots.map((snapshot) => [snapshot.station.id, snapshot.station.name]),
    );

    const allAlerts = [...critical, ...warning, ...info];

    return (
      <>
        <InstallPrompt />

        <section className="mb-8 max-w-3xl">
          <p className="mb-3 text-xs uppercase tracking-[0.18em] text-accent">
            Quan trắc trực tiếp
          </p>

          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Tổng quan môi trường nước Cồn Hô
          </h2>

          <p className="mt-3 text-lg leading-relaxed text-muted">
            Trang này ưu tiên ba câu hỏi: độ mặn đang ở mức nào,
            mực nước đang thay đổi ra sao,
            và hệ thống có điểm nào cần chú ý ngay.
          </p>
        </section>

        <section
          aria-label="Tóm tắt vận hành"
          className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
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
            <h3 className="text-2xl font-semibold tracking-tight">
              Danh sách trạm
            </h3>

            <p className="mt-1 text-sm text-muted">
              Mỗi thẻ hiển thị chỉ số chính; chi tiết kỹ thuật nằm bên trong.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {snapshots.map((snapshot) => (
              <StationCard
                key={snapshot.station.id}
                snapshot={snapshot}
              />
            ))}
          </div>
        </section>

        <section aria-label="Cảnh báo" className="space-y-4">
          <div>
            <h3 className="text-2xl font-semibold tracking-tight">
              Cảnh báo
            </h3>

            <p className="mt-1 text-sm text-muted">
              Một danh sách duy nhất, theo mức độ ưu tiên.
            </p>
          </div>

          {alerts.length === 0 ? (
            <p className="text-muted">
              Hiện không có cảnh báo mới.
            </p>
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
              Không có cảnh báo trong 7 ngày gần nhất.
              Mạng lưới đang vận hành bình thường.
            </p>
          )}
        </section>
      </>
    );
  } catch {
    return (
      <section className="max-w-3xl py-12">
        <h2 className="text-3xl font-semibold mb-4">
          Eco-Sense Dashboard
        </h2>

        <p className="text-muted">
          Hệ thống đang ở chế độ Demo hoặc chưa được cấu hình
          Supabase trên môi trường triển khai.
        </p>

        <p className="mt-3 text-sm text-muted">
          Dashboard sẽ hiển thị dữ liệu thực khi các biến môi trường
          được cấu hình đầy đủ.
        </p>
      </section>
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