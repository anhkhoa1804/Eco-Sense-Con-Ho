import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, BarChart3, HeartHandshake, Radar, Waves } from "lucide-react";
import { MapStation, StationNetworkMap } from "@/components/dashboard/station-network-map";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { freshnessStatus } from "@/components/ui/status-indicator";
import { getPublicRepositories } from "@/lib/publicRead";

const milestones = [
  { label: "Thách thức khí hậu", desc: "Độ mặn, xói lở, ngập nước và biến động thủy văn." },
  { label: "Mạng lưới quan trắc", desc: "Trạm IoT công khai, trạng thái rõ ràng, dữ liệu gần thời gian thực." },
  { label: "Cộng đồng tham gia", desc: "Quan sát hiện trường, phản hồi nhanh, thêm ngữ cảnh địa phương." },
  { label: "Giá trị nghiên cứu", desc: "Dữ liệu có thể đọc, so sánh và theo dõi dài hạn." },
  { label: "Lộ trình tương lai", desc: "Mở rộng lớp bản đồ, cảnh báo và trải nghiệm di động." },
];

async function AboutNetworkMap() {
  const context = getPublicRepositories();
  if (!context) return <StationNetworkMap stations={[]} />;

  try {
    const snapshots = await context.repos.readings.getSnapshots(context.scope);
    const mapStations: MapStation[] = snapshots.map((snapshot) => ({
      id: snapshot.station.id,
      name: snapshot.station.name,
      lat: snapshot.station.lat,
      lng: snapshot.station.lng,
      freshness: freshnessStatus(snapshot.reading?.timestamp ?? snapshot.health?.timestamp ?? null),
    }));
    return <StationNetworkMap stations={mapStations} />;
  } catch {
    return <StationNetworkMap stations={[]} />;
  }
}

function AboutNetworkMapFallback() {
  return <Skeleton className="h-[420px] w-full rounded-lg" />;
}

export default function AboutPage() {
  return (
    <PublicShell activePath="/about">
      <section className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-8">
          <div className="flex flex-wrap gap-2">
            <Badge variant="healthy">Về Cồn Hô</Badge>
            <Badge variant="default">Ứng phó khí hậu</Badge>
          </div>

          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.22em] text-accent">Câu chuyện dự án</p>
            <h2 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">
              Cồn Hô được kể bằng dữ liệu, không phải bằng tài liệu kỹ thuật.
            </h2>
            <p className="max-w-2xl text-lg leading-relaxed text-muted">
              Horizon giúp cù lao trở nên dễ hiểu: độ mặn, mực nước và tình trạng trạm được trình bày rõ ràng để người
              dân, nhà nghiên cứu và du khách nắm bắt môi trường ngay lập tức.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/dashboard">
                Xem dữ liệu trực tiếp
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/report">Đóng góp quan sát</Link>
            </Button>
          </div>
        </div>

        <Suspense fallback={<AboutNetworkMapFallback />}>
          <AboutNetworkMap />
        </Suspense>
      </section>

      <section className="mt-20 grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.22em] text-accent">Vì sao điều này quan trọng</p>
          <h3 className="text-3xl font-semibold tracking-tight">Câu chuyện được kể trước, dữ liệu minh chứng theo sau.</h3>
          <p className="max-w-xl text-sm leading-relaxed text-muted">
            Trang này được kể như một câu chuyện: trước tiên là vùng đất, rồi đến áp lực môi trường, sau đó là mạng
            lưới quan trắc, và cuối cùng là những người sử dụng nó.
          </p>
        </div>

        <div className="space-y-0">
          {milestones.map((item, index) => (
            <div key={item.label} className="grid gap-4 border-t border-border/40 py-5 md:grid-cols-[0.35fr_0.65fr]">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted">0{index + 1}</p>
                <p className="mt-1 text-sm font-medium">{item.label}</p>
              </div>
              <p className="text-sm leading-relaxed text-muted">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-20 grid gap-10 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.22em] text-accent">Tác động</p>
          <h3 className="text-3xl font-semibold tracking-tight">
            Khoa học, du lịch và quyết định của người dân cùng dùng chung một nền tảng.
          </h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { icon: Waves, title: "Tín hiệu môi trường", desc: "Số liệu độ mặn và mực nước rõ ràng." },
            { icon: HeartHandshake, title: "Cộng đồng tham gia", desc: "Báo cáo hiện trường bổ sung ngữ cảnh địa phương." },
            { icon: BarChart3, title: "Giá trị nghiên cứu", desc: "Xu hướng dữ liệu dễ đọc và có thể so sánh." },
            { icon: Radar, title: "Sự tin cậy", desc: "Giao diện phản ánh đúng một mạng lưới đang vận hành thật." },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex gap-4 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h4 className="font-medium">{item.title}</h4>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-20 flex flex-col gap-6 border-t border-border/40 pt-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-accent">Lộ trình tương lai</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight">
            Mở rộng bản đồ, đào sâu nghiên cứu, giữ trải nghiệm nhẹ nhàng.
          </h3>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard">Về bảng quan trắc</Link>
        </Button>
      </section>
    </PublicShell>
  );
}
