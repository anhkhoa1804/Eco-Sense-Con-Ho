import Link from "next/link";
import { Suspense } from "react";
import { Send, Sprout, Waves } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicRepositories } from "@/lib/publicRead";
import { getDashboardMetrics } from "@/lib/repositories";
import { formatSalinity, formatWaterLevel } from "@/lib/utils";

export const revalidate = 60;

async function LiveSummary() {
  const context = getPublicRepositories();
  if (!context) return null;
  const { repos, scope } = context;
  const [metrics, snapshots] = await Promise.all([
    getDashboardMetrics(repos, scope),
    repos.readings.getSnapshots(scope),
  ]);

  const readingValues = snapshots.flatMap((snapshot: any) => (snapshot.reading ? [snapshot.reading] : []));
  const averageWaterLevel =
    readingValues.length > 0
      ? readingValues.reduce((sum: number, reading: any) => sum + reading.water_level, 0) / readingValues.length
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

const focusItems = [
  {
    title: "Trạm 1 - Dữ liệu nước",
    desc: "Theo dõi mực nước, độ mặn, triều cường và những biến động quanh bờ sông.",
    icon: Waves,
  },
  {
    title: "Trạm 2 - Dữ liệu đất",
    desc: "Đo tình trạng đất để hỗ trợ bà con chọn thời điểm tưới, chăm sóc và trồng trọt phù hợp.",
    icon: Sprout,
  },
  {
    title: "Gateway - Gửi tin về bà con",
    desc: "Tổng hợp dữ liệu từ các trạm và gửi cảnh báo, khuyến nghị qua SIM, Zalo hoặc các kênh quen dùng.",
    icon: Send,
  },
];

export default function HomePage() {
  return (
    <PublicShell activePath="/">
      <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        <div className="max-w-3xl">
          <p className="mb-3 text-xs uppercase tracking-[0.18em] text-accent">05-06.09.2026 · Cồn Hô</p>
          <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">
            HORIZON lắng nghe thiên nhiên, đồng hành cùng cộng đồng.
          </h2>
          <div className="mt-5 space-y-4 text-lg leading-relaxed text-muted">
            <p>
              Bà con Cồn Hô từ lâu sống cùng nhịp nước lên, nước xuống. Canh tác, mưu sinh và du lịch đều gắn với
              dòng sông, nhưng dòng sông ấy cũng đang mang theo những đổi thay khó lường: nước mặn lấn sâu, triều
              cường dâng cao, ngập úng và sạt lở xuất hiện qua từng mùa.
            </p>
            <p>
              Từ một câu hỏi giản dị: làm sao để bà con nhận ra những thay đổi ấy sớm hơn? Horizon bắt đầu bằng các
              trạm quan trắc ghi lại mực nước, độ mặn, dữ liệu đất và biến động môi trường mỗi ngày, rồi đưa thông tin
              trở lại với bà con một cách nhanh chóng.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/dashboard">Xem dữ liệu quan trắc</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/report">Gửi báo cáo hiện trường</Link>
            </Button>
          </div>
        </div>

        <Card className="border-accent/15 bg-muted/20">
          <CardContent className="space-y-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">Thông điệp</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">Ba điểm chạm, cùng lên đèn.</p>
            </div>
            <p className="leading-relaxed text-muted">
              Horizon không chỉ ghi nhận dữ liệu môi trường, mà còn đưa dữ liệu ấy trở lại với đời sống hằng ngày của
              bà con. Một trạm nhìn dòng nước, một trạm nhìn thửa đất, và gateway giúp thông tin đến đúng lúc qua những
              kênh bà con dễ dùng.
            </p>
            <div className="grid gap-3">
              {focusItems.map(({ title, desc, icon: Icon }) => (
                <div key={title} className="flex gap-3 rounded-lg border border-border bg-background p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-medium">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-accent">Quan trắc trực tiếp</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">Tình hình môi trường hôm nay</h3>
          </div>
          <Button asChild variant="outline">
            <Link href="/dashboard">Mở bảng quan trắc</Link>
          </Button>
        </div>
        <Suspense fallback={<SummaryFallback />}>
          <LiveSummary />
        </Suspense>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Ghi nhận mỗi ngày",
            desc: "Trạm cảm biến đo mực nước, độ mặn và tình trạng thiết bị tại hiện trường.",
          },
          {
            title: "Đối chiếu cùng kinh nghiệm",
            desc: "Dữ liệu không thay thế quan sát của bà con, mà giúp các thay đổi được nhìn thấy rõ hơn.",
          },
          {
            title: "Cùng cộng đồng hành động",
            desc: "Người dân có thể xem thông tin công khai và gửi báo cáo khi thấy bất thường.",
          },
        ].map((item) => (
          <Card key={item.title}>
            <CardContent>
              <h4 className="text-lg font-semibold tracking-tight">{item.title}</h4>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.desc}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </PublicShell>
  );
}
