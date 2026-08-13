import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Droplets, MapPinned, Send, Sprout, Users, Waves } from "lucide-react";
import { MapStation, StationNetworkMap } from "@/components/dashboard/station-network-map";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { freshnessStatus } from "@/components/ui/status-indicator";
import { getPublicRepositories } from "@/lib/publicRead";
import { getDashboardMetrics } from "@/lib/repositories";
import { formatSalinity, formatWaterLevel } from "@/lib/utils";

export const revalidate = 60;

const storyBlocks = [
  {
    eyebrow: "Where is Cồn Hô?",
    title: "Một cù lao nhỏ nhưng mang nhiều lớp dữ liệu môi trường.",
    description:
      "Cồn Hô cần được nhìn như một mạng sống động giữa dòng nước: có mực nước, độ mặn, sức khỏe trạm và nhịp biến đổi theo thời gian.",
    icon: MapPinned,
  },
  {
    eyebrow: "Why salinity matters",
    title: "Độ mặn là tín hiệu sớm cho sinh hoạt, sản xuất và sức bền hệ sinh thái.",
    description:
      "Khi độ mặn thay đổi, người dân cần hiểu nhanh nó đang đi lên hay đi xuống, và nó có đang tiến gần ngưỡng nguy cơ hay không.",
    icon: Droplets,
  },
  {
    eyebrow: "Community and research",
    title: "Người dân, du khách và nhà nghiên cứu cùng nhìn vào một nguồn dữ liệu.",
    description:
      "Báo cáo hiện trường bổ sung ngữ cảnh, còn biểu đồ và trạm giúp kiểm chứng những gì đang diễn ra trên đảo.",
    icon: Users,
  },
];

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

async function LiveSummary() {
  const context = getPublicRepositories();
  if (!context) return null;

  try {
    const { repos, scope } = context;
    const [metrics, snapshots] = await Promise.all([
      getDashboardMetrics(repos, scope),
      repos.readings.getSnapshots(scope),
    ]);

    const readingValues = snapshots.flatMap((snapshot) => (snapshot.reading ? [snapshot.reading] : []));
    // null, not 0 — an average of zero readings is undefined, not a measured zero.
    const averageWaterLevel =
      readingValues.length > 0
        ? readingValues.reduce((sum, reading) => sum + reading.water_level, 0) / readingValues.length
        : null;
    const latestTimestamp = readingValues
      .map((reading) => new Date(reading.timestamp).getTime())
      .filter(Number.isFinite)
      .sort((a, b) => b - a)[0];

    const freshness = latestTimestamp
      ? `Cập nhật ${new Intl.DateTimeFormat("vi-VN", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(latestTimestamp))}`
      : "Chưa có dữ liệu đo";

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-4 border-y border-border/40 py-4">
          <RibbonStat label="Độ mặn trung bình" value={formatSalinity(metrics.averageSalinity)} />
          <RibbonStat label="Mực nước trung bình" value={formatWaterLevel(averageWaterLevel)} />
          <RibbonStat label="Trạm đang hoạt động" value={`${metrics.activeStations}/${metrics.totalStations}`} />
          <RibbonStat label="Cảnh báo cần chú ý" value={String(metrics.criticalAlerts)} />
        </div>
        <p className="text-sm text-muted">{freshness}</p>
      </div>
    );
  } catch {
    return <p className="text-sm text-muted">Không thể kết nối tới nguồn dữ liệu trực tiếp lúc này.</p>;
  }
}

function SummaryFallback() {
  return (
    <div className="space-y-4">
      <div className="h-px bg-border/40" />
      <div className="flex flex-wrap gap-8 text-sm text-muted">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-36" />
      </div>
    </div>
  );
}

async function NetworkPreview() {
  const context = getPublicRepositories();
  if (!context) return <StationNetworkMap stations={[]} />;

  let snapshots: Awaited<ReturnType<typeof context.repos.readings.getSnapshots>>;
  try {
    snapshots = await context.repos.readings.getSnapshots(context.scope);
  } catch {
    return <StationNetworkMap stations={[]} />;
  }

  const mapStations: MapStation[] = snapshots.map((snapshot) => ({
    id: snapshot.station.id,
    name: snapshot.station.name,
    lat: snapshot.station.lat,
    lng: snapshot.station.lng,
    freshness: freshnessStatus(snapshot.reading?.timestamp ?? snapshot.health?.timestamp ?? null),
  }));

  return <StationNetworkMap stations={mapStations} />;
}

function NetworkPreviewFallback() {
  return (
    <div className="h-[420px] overflow-hidden rounded-lg border border-border bg-muted/10 p-8">
      <Skeleton className="h-6 w-40 rounded-full" />
      <div className="mt-24 space-y-6">
        <Skeleton className="h-10 w-48 rounded-full" />
        <Skeleton className="h-10 w-56 rounded-full" />
        <Skeleton className="h-10 w-44 rounded-full" />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <PublicShell activePath="/">
      <section className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="healthy">Nền tảng quan trắc khí hậu</Badge>
            <Badge variant="default">Cồn Hô, Trà Vinh</Badge>
          </div>

          <div className="space-y-5">
            <p className="text-xs uppercase tracking-[0.24em] text-accent">Horizon</p>
            <h2 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
              Horizon lắng nghe thiên nhiên, đồng hành cùng cộng đồng.
            </h2>
            <div className="max-w-2xl space-y-4 text-lg leading-relaxed text-muted">
              <p>
                Bà con Cồn Hô từ lâu sống cùng nhịp nước lên, nước xuống. Canh tác, mưu sinh và du lịch đều gắn với
                dòng sông, nhưng dòng sông ấy cũng đang mang theo những đổi thay khó lường: nước mặn lấn sâu, triều
                cường dâng cao, ngập úng và sạt lở xuất hiện qua từng mùa.
              </p>
              <p>
                Horizon bắt đầu bằng các trạm quan trắc ghi lại mực nước, độ mặn, dữ liệu đất và biến động môi trường
                mỗi ngày, rồi đưa thông tin trở lại với bà con một cách nhanh chóng — đủ rõ cho người dân, đủ chi
                tiết cho nhà nghiên cứu.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="gap-2">
              <Link href="/dashboard">
                Xem dữ liệu quan trắc
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/report">Gửi báo cáo hiện trường</Link>
            </Button>
          </div>

          <Suspense fallback={<SummaryFallback />}>
            <LiveSummary />
          </Suspense>
        </div>

        <Suspense fallback={<NetworkPreviewFallback />}>
          <NetworkPreview />
        </Suspense>
      </section>

      <section className="mt-20 space-y-6 border-y border-border/60 py-10">
        <SectionHeader eyebrow="Thông điệp" title="Ba điểm chạm, cùng lên đèn." />
        <p className="max-w-2xl leading-relaxed text-muted">
          Horizon không chỉ ghi nhận dữ liệu môi trường, mà còn đưa dữ liệu ấy trở lại với đời sống hằng ngày của
          bà con. Một trạm nhìn dòng nước, một trạm nhìn thửa đất, và gateway giúp thông tin đến đúng lúc qua những
          kênh bà con dễ dùng.
        </p>
        <div className="grid gap-6 sm:grid-cols-3">
          {focusItems.map(({ title, desc, icon: Icon }) => (
            <div key={title} className="flex gap-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              <div>
                <p className="font-medium">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-20 space-y-14">
        {storyBlocks.map((block, index) => {
          const Icon = block.icon;
          const reverse = index % 2 === 1;
          return (
            <div
              key={block.title}
              className={`grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}
            >
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.22em] text-accent">{block.eyebrow}</p>
                <h3 className="max-w-xl text-3xl font-semibold tracking-tight md:text-4xl">{block.title}</h3>
                <p className="max-w-xl text-base leading-relaxed text-muted">{block.description}</p>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background shadow-sm">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Tín hiệu công khai</p>
                    <p className="text-sm text-muted">Đủ rõ cho người dân, đủ chi tiết cho nhà nghiên cứu.</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {["Bản đồ trực quan", "Xu hướng dễ đọc", "Ngữ cảnh đáng tin cậy"].map((item) => (
                    <div key={item} className="text-sm text-muted">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="mt-20 grid gap-8 border-t border-border/60 pt-10 md:grid-cols-3">
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
          <div key={item.title}>
            <h4 className="text-lg font-semibold tracking-tight">{item.title}</h4>
            <p className="mt-2 text-sm leading-relaxed text-muted">{item.desc}</p>
          </div>
        ))}
      </section>

      <section className="mt-20 border-t border-border/60 pt-10">
        <SectionHeader
          eyebrow="Bắt đầu"
          title="Khám phá mạng lưới quan trắc."
          trailing={
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/dashboard">Vào bảng quan trắc</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/about">Đọc câu chuyện dự án</Link>
              </Button>
            </div>
          }
        />
      </section>
    </PublicShell>
  );
}

function RibbonStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-[14rem] items-center gap-3 text-sm text-muted">
      <span className="whitespace-nowrap uppercase tracking-[0.16em] text-foreground">{label}</span>
      <span className="hidden h-px w-8 bg-border/70 md:block" aria-hidden />
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
