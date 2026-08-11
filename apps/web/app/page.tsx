import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Droplets, MapPinned, Send, Sprout, Users, Waves } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicRepositories } from "@/lib/publicRead";
import { getDashboardMetrics } from "@/lib/repositories";
import { formatSalinity, formatWaterLevel } from "@/lib/utils";

export const revalidate = 60;

const networkNodes = [
  { label: "Đầu Cồn", status: "healthy", x: "20%", y: "26%" },
  { label: "Homestay Cô Ba", status: "watch", x: "58%", y: "40%" },
  { label: "Cuối Cồn", status: "healthy", x: "76%", y: "74%" },
];

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

  const { repos, scope } = context;
  const [metrics, snapshots] = await Promise.all([
    getDashboardMetrics(repos, scope),
    repos.readings.getSnapshots(scope),
  ]);

  const readingValues = snapshots.flatMap((snapshot) => (snapshot.reading ? [snapshot.reading] : []));
  const averageWaterLevel =
    readingValues.length > 0
      ? readingValues.reduce((sum, reading) => sum + reading.water_level, 0) / readingValues.length
      : 0;
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
        <RibbonStat label="Max salinity" value={formatSalinity(metrics.averageSalinity)} />
        <RibbonStat label="Water rhythm" value={formatWaterLevel(averageWaterLevel)} />
        <RibbonStat label="Stations active" value={`${metrics.activeStations}/${metrics.totalStations}`} />
        <RibbonStat label="Critical alerts" value={String(metrics.criticalAlerts)} />
      </div>
      <p className="text-sm text-muted">{freshness}</p>
    </div>
  );
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

function NetworkPreview() {
  return (
    <div className="relative min-h-[640px] overflow-hidden rounded-[42px] bg-[linear-gradient(180deg,#f6faf6_0%,#edf5ef_100%)] shadow-[0_24px_80px_rgba(15,23,42,0.08)] ring-1 ring-border/70">
      <div className="absolute inset-x-12 top-20 h-px bg-border/70" />
      <div className="absolute inset-y-12 left-1/2 w-px bg-border/70" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(31,138,76,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(15,118,110,0.1),transparent_28%)]" />
      <div className="absolute left-8 top-8 rounded-full bg-background/80 px-4 py-1.5 text-xs font-medium text-muted shadow-sm backdrop-blur">
        Realtime network
      </div>
      <div className="absolute inset-x-8 top-28 h-[1px] bg-foreground/5" />
      <div className="absolute inset-y-28 left-8 right-8 w-[1px] bg-foreground/5" />
      {networkNodes.map((node) => (
        <div
          key={node.label}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: node.x, top: node.y }}
        >
          <div className="relative">
            <span
              className={[
                "absolute inset-0 rounded-full blur-2xl transition-opacity",
                node.status === "healthy" ? "bg-healthy/20 opacity-70" : "bg-watch/20 opacity-80",
              ].join(" ")}
              aria-hidden
            />
            <div
              className={[
                "relative flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium backdrop-blur transition-transform duration-300",
                node.status === "healthy" ? "bg-healthy-bg text-healthy" : "bg-watch-bg text-watch",
              ].join(" ")}
            >
              <span
                className={[
                  "h-2.5 w-2.5 rounded-full",
                  node.status === "healthy" ? "bg-healthy" : "bg-watch",
                ].join(" ")}
              />
              {node.label}
            </div>
          </div>
        </div>
      ))}
      <div className="absolute inset-x-8 bottom-8 grid gap-3 sm:grid-cols-3">
        {[
          "Độ mặn theo dõi liên tục",
          "Mực nước phản ánh nhịp thủy văn",
          "Cảnh báo nổi bật theo mức độ",
        ].map((item) => (
          <div key={item} className="text-sm text-muted">
            {item}
          </div>
        ))}
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
            <Badge variant="healthy">Climate-tech platform</Badge>
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

        <NetworkPreview />
      </section>

      <section className="mt-20">
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
            <div className="grid gap-3 sm:grid-cols-3">
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
                    <p className="font-medium text-foreground">A public signal</p>
                    <p className="text-sm text-muted">Clear enough for citizens, detailed enough for researchers.</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {["Map first", "Readable trend", "Trustworthy context"].map((item) => (
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

      <section className="mt-20 grid gap-4 md:grid-cols-3">
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

      <section className="mt-20 flex flex-col gap-6 border-t border-border/40 pt-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-accent">Call to action</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight">Explore the monitoring network.</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/dashboard">Enter dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/about">Read the story</Link>
          </Button>
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
