import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Send, Sprout, Waves } from "lucide-react";
import { MapStation, StationNetworkMap } from "@/components/dashboard/station-network-map";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { RiverLine } from "@/components/ui/river-line";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { freshnessStatus } from "@/components/ui/status-indicator";
import { getPublicRepositories } from "@/lib/publicRead";
import { getDashboardMetrics } from "@/lib/repositories";
import { formatSalinity, formatWaterLevel } from "@/lib/utils";

export const revalidate = 60;

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
  if (!context) {
    return <StationNetworkMap stations={[]} variant="preview" />;
  }

  let snapshots: Awaited<ReturnType<typeof context.repos.readings.getSnapshots>>;
  try {
    snapshots = await context.repos.readings.getSnapshots(context.scope);
  } catch {
    return <StationNetworkMap stations={[]} variant="preview" />;
  }

  const mapStations: MapStation[] = snapshots.map((snapshot) => ({
    id: snapshot.station.id,
    name: snapshot.station.name,
    lat: snapshot.station.lat,
    lng: snapshot.station.lng,
    freshness: freshnessStatus(snapshot.reading?.timestamp ?? snapshot.health?.timestamp ?? null),
  }));

  return (
    <div className="space-y-3">
      <StationNetworkMap stations={mapStations} variant="preview" />
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
        Xem bản đồ đầy đủ trong bảng quan trắc
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}

function NetworkPreviewFallback() {
  return (
    <div className="h-[260px] overflow-hidden rounded-lg border border-border bg-muted/10 p-6">
      <Skeleton className="h-6 w-40 rounded-full" />
      <div className="mt-12 space-y-4">
        <Skeleton className="h-8 w-40 rounded-full" />
        <Skeleton className="h-8 w-48 rounded-full" />
      </div>
    </div>
  );
}

async function SalinityThresholds() {
  const context = getPublicRepositories();
  if (!context) return <SalinityThresholdsFallback />;

  try {
    const threshold = await context.repos.readings.getDefaultSalinityThreshold();
    if (!threshold) return <SalinityThresholdsFallback />;

    return (
      <div className="grid gap-6 border-t border-border/60 pt-8 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-watch" aria-hidden />
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Cần chú ý</span>
          </div>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{formatSalinity(threshold.warningLevel)}</p>
          <p className="text-sm text-muted">Độ mặn tiến gần ngưỡng khuyến cáo cho {threshold.cropName}.</p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-risk" aria-hidden />
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Nguy cơ cao</span>
          </div>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{formatSalinity(threshold.criticalLevel)}</p>
          <p className="text-sm text-muted">Vượt ngưỡng an toàn, hạn chế lấy nước trực tiếp.</p>
        </div>
      </div>
    );
  } catch {
    return <SalinityThresholdsFallback />;
  }
}

function SalinityThresholdsFallback() {
  return (
    <div className="space-y-3 border-t border-border/60 pt-8 text-sm">
      <div className="flex items-center gap-2.5">
        <span className="h-2 w-2 shrink-0 rounded-full bg-watch" aria-hidden />
        <span className="font-medium text-foreground">Cần chú ý</span>
        <span className="text-muted">— độ mặn tiến gần ngưỡng khuyến cáo</span>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="h-2 w-2 shrink-0 rounded-full bg-risk" aria-hidden />
        <span className="font-medium text-foreground">Nguy cơ cao</span>
        <span className="text-muted">— vượt ngưỡng an toàn cho tưới tiêu</span>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <PublicShell activePath="/">
      <section className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="animate-entrance space-y-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="healthy">Nền tảng quan trắc khí hậu</Badge>
            <Badge variant="default">Cồn Hô, Vĩnh Long</Badge>
          </div>

          <div className="space-y-6">
            <p className="text-eyebrow uppercase tracking-[0.24em] text-accent">Horizon</p>
            <h1 className="max-w-3xl text-display font-semibold tracking-tight md:text-6xl">
              Horizon lắng nghe thiên nhiên, đồng hành cùng cộng đồng.
            </h1>
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
            <Button
              asChild
              size="lg"
              className="gap-2 transition-shadow duration-[var(--motion-base)] hover:ring-2 hover:ring-brand-orange/50 hover:ring-offset-2 hover:ring-offset-background"
            >
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

      <RiverLine className="mt-16" />

      <section className="mt-24 space-y-10">
        <SectionHeader eyebrow="Thông điệp" title="Ba điểm chạm, cùng lên đèn." />
        <p className="max-w-2xl leading-relaxed text-muted">
          Horizon không chỉ ghi nhận dữ liệu môi trường, mà còn đưa dữ liệu ấy trở lại với đời sống hằng ngày của
          bà con. Một trạm nhìn dòng nước, một trạm nhìn thửa đất, và gateway giúp thông tin đến đúng lúc qua những
          kênh bà con dễ dùng.
        </p>
        <div className="grid gap-x-8 gap-y-12 sm:grid-cols-3">
          {focusItems.map(({ title, desc, icon: Icon }, index) => (
            <div key={title} className="space-y-4 border-t border-border/60 pt-6">
              <div className="flex items-center justify-between">
                <span className="text-eyebrow text-accent">{`0${index + 1}`}</span>
                <IconTile>
                  <Icon className="h-5 w-5" aria-hidden />
                </IconTile>
              </div>
              <div>
                <p className="text-xl font-semibold tracking-tight">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Why salinity matters — wide data section, real thresholds, not a generic feature card */}
      <section className="mt-32 space-y-6">
        <SectionHeader
          eyebrow="Why salinity matters"
          title="Độ mặn là tín hiệu sớm cho sinh hoạt, sản xuất và sức bền hệ sinh thái."
        />
        <p className="max-w-2xl text-base leading-relaxed text-muted">
          Khi độ mặn thay đổi, người dân cần hiểu nhanh nó đang đi lên hay đi xuống, và nó có đang tiến gần ngưỡng
          nguy cơ hay không. Horizon đánh dấu hai ngưỡng này trực tiếp trên biểu đồ xu hướng, không tách riêng chú giải.
        </p>
        <Suspense fallback={<SalinityThresholdsFallback />}>
          <SalinityThresholds />
        </Suspense>
      </section>

      {/* Community and research — centered/human mode, distinct from the data section above */}
      <section className="mt-32 space-y-10 text-center">
        <div className="mx-auto max-w-2xl space-y-4">
          <p className="text-eyebrow uppercase tracking-[0.18em] text-accent">Community and research</p>
          <h2 className="text-h1 font-semibold tracking-tight">
            Người dân, du khách và nhà nghiên cứu cùng nhìn vào một nguồn dữ liệu.
          </h2>
          <p className="text-base leading-relaxed text-muted">
            Báo cáo hiện trường bổ sung ngữ cảnh, còn biểu đồ và trạm giúp kiểm chứng những gì đang diễn ra trên đảo.
          </p>
        </div>
        <div className="mx-auto grid max-w-3xl gap-8 border-t border-border/60 pt-8 text-left sm:grid-cols-2">
          <div>
            <p className="font-medium text-foreground">Người dân</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Xem nhanh tình trạng trạm gần nhà và gửi báo cáo khi thấy bất thường.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Nhà nghiên cứu</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Theo dõi xu hướng dữ liệu dài hạn và đối chiếu với quan sát thực địa.
            </p>
          </div>
        </div>
      </section>

      {/* Closing CTA — full-bleed band, the one deliberate wide moment on the page */}
      <section className="relative mt-32">
        <div
          aria-hidden
          className="absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 bg-[linear-gradient(180deg,rgba(14,95,138,0.05)_0%,rgba(47,168,92,0.06)_100%)]"
        />
        <div className="relative space-y-6 border-t border-border/60 py-20 text-center">
          <p className="text-eyebrow uppercase tracking-[0.18em] text-accent">Bắt đầu</p>
          <h2 className="mx-auto max-w-2xl text-h1 font-semibold tracking-tight md:text-5xl">
            Khám phá mạng lưới quan trắc.
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="gap-2 transition-shadow duration-[var(--motion-base)] hover:ring-2 hover:ring-brand-orange/50 hover:ring-offset-2 hover:ring-offset-background"
            >
              <Link href="/dashboard">
                Vào bảng quan trắc
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/about">Đọc câu chuyện dự án</Link>
            </Button>
          </div>
        </div>
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
