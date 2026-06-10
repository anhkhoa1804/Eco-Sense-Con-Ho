import Link from "next/link";
import { Suspense } from "react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicRepositories } from "@/lib/publicRead";
import { getDashboardMetrics } from "@/lib/repositories";
import { formatSalinity, formatWaterLevel } from "@/lib/utils";

export const revalidate = 60;

async function LiveSummary() {
  const { repos, scope } = getPublicRepositories();
  const [metrics, snapshots] = await Promise.all([
    getDashboardMetrics(repos, scope),
    repos.readings.getSnapshots(scope),
  ]);

  const readingValues = snapshots.flatMap((snapshot) => (snapshot.reading ? [snapshot.reading] : []));
  const averageWaterLevel =
    readingValues.length > 0
      ? readingValues.reduce((sum, reading) => sum + reading.water_level, 0) / readingValues.length
      : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="Độ mặn hiện tại"
        value={formatSalinity(metrics.averageSalinity)}
        note="Trung bình từ các trạm đang hoạt động"
      />
      <MetricCard
        label="Mực nước hiện tại"
        value={formatWaterLevel(averageWaterLevel)}
        note="Giá trị trung bình gần nhất"
      />
      <MetricCard
        label="Trạm đang hoạt động"
        value={`${metrics.activeStations}/${metrics.totalStations}`}
        note="Mạng lưới quan trắc công khai"
      />
      <MetricCard
        label="Cảnh báo cần chú ý"
        value={String(metrics.criticalAlerts)}
        note="Phát sinh trong 24 giờ gần nhất"
      />
    </div>
  );
}

function SummaryFallback() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-32" />
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <PublicShell activePath="/">
      <section className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-start">
        <div>
          <p className="mb-3 text-xs uppercase tracking-[0.18em] text-accent">Quan trắc công khai</p>
          <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
            Quan trắc độ mặn và môi trường nước tại Cồn Hô theo thời gian thực.
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
            Nền tảng công khai dành cho cư dân, học sinh, nhà nghiên cứu, cơ quan quản lý và du khách muốn theo dõi
            tình trạng môi trường nước trên cù lao.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/dashboard">Xem dữ liệu quan trắc</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/about">Tìm hiểu dự án</Link>
            </Button>
          </div>
        </div>

        <Card className="border-accent/15 bg-muted/20">
          <CardHeader>
            <CardTitle>Truy cập nhanh</CardTitle>
            <CardDescription>Người xem mới có thể mở dữ liệu, tìm hiểu dự án hoặc gửi báo cáo hiện trường.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {[
              { href: "/dashboard", title: "Bảng quan trắc", desc: "Độ mặn, mực nước, trạng thái trạm" },
              { href: "/report", title: "Báo cáo hiện trường", desc: "Gửi quan sát mà không cần tài khoản" },
              { href: "/about", title: "Giới thiệu dự án", desc: "Hiểu mục tiêu và phạm vi quan trắc" },
              { href: "/s/STATION_01", title: "Quét một trạm", desc: "Trang xem nhanh trên điện thoại" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl border border-border bg-background p-4 transition-colors hover:border-accent/30 hover:bg-muted/20"
              >
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-sm text-muted">{item.desc}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <h3 className="mb-4 text-2xl font-semibold tracking-tight">Tổng quan trực tiếp</h3>
        <Suspense fallback={<SummaryFallback />}>
          <LiveSummary />
        </Suspense>
      </section>

      <section className="mt-10">
        <Card>
          <CardHeader>
            <CardTitle>Cách hệ thống hoạt động</CardTitle>
            <CardDescription>Ba bước ngắn gọn để hiểu chuỗi thu thập và công bố dữ liệu.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {[
              { title: "Trạm cảm biến", desc: "Đo độ mặn, mực nước và tín hiệu tại hiện trường." },
              { title: "Hệ thống thu thập", desc: "Dữ liệu được tổng hợp và kiểm tra trên máy chủ." },
              { title: "Bảng quan trắc công khai", desc: "Người dân có thể xem dữ liệu và gửi báo cáo." },
            ].map((step, index) => (
              <div key={step.title} className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">Bước {index + 1}</p>
                <h4 className="mt-2 text-lg font-semibold">{step.title}</h4>
                <p className="mt-2 text-sm text-muted">{step.desc}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </PublicShell>
  );
}
