import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { MapStation, StationNetworkMap } from "@/components/dashboard/station-network-map";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { RiverLine } from "@/components/ui/river-line";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { freshnessStatus } from "@/components/ui/status-indicator";
import { getPublicRepositories } from "@/lib/publicRead";

const milestones = [
  { label: "Thách thức khí hậu", desc: "Độ mặn, xói lở, ngập nước và biến động thủy văn." },
  { label: "Mạng lưới quan trắc", desc: "Trạm IoT công khai, trạng thái rõ ràng, dữ liệu gần thời gian thực." },
  { label: "Cộng đồng tham gia", desc: "Quan sát hiện trường, phản hồi nhanh, thêm ngữ cảnh địa phương." },
  { label: "Giá trị nghiên cứu", desc: "Dữ liệu có thể đọc, so sánh và theo dõi dài hạn." },
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
      <section className="animate-entrance max-w-3xl space-y-6">
        <p className="text-eyebrow uppercase tracking-[0.22em] text-accent">Câu chuyện dự án</p>
        <h1 className="text-display font-semibold tracking-tight md:text-6xl">
          Cồn Hô được kể bằng dữ liệu, không phải bằng tài liệu kỹ thuật.
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted">
          Horizon giúp cù lao trở nên dễ hiểu: độ mặn, mực nước và tình trạng trạm được trình bày rõ ràng để người
          dân, nhà nghiên cứu và du khách nắm bắt môi trường ngay lập tức.
        </p>
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
      </section>

      <section className="mt-12">
        <Suspense fallback={<AboutNetworkMapFallback />}>
          <AboutNetworkMap />
        </Suspense>
      </section>

      <RiverLine className="mt-20" />

      <section className="mt-16 grid gap-16 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-4">
          <SectionHeader eyebrow="Vì sao điều này quan trọng" title="Câu chuyện được kể trước, dữ liệu minh chứng theo sau." />
          <p className="max-w-md text-base leading-relaxed text-muted">
            Trang này được kể như một câu chuyện: trước tiên là vùng đất, rồi đến áp lực môi trường, sau đó là mạng
            lưới quan trắc, và cuối cùng là những người sử dụng nó.
          </p>
        </div>

        <div className="space-y-0">
          {milestones.map((item, index) => (
            <div key={item.label} className="grid gap-6 border-t border-border/40 py-6 md:grid-cols-[0.3fr_0.7fr]">
              <div>
                <p className="text-eyebrow text-accent">0{index + 1}</p>
                <p className="mt-1 text-lg font-semibold tracking-tight">{item.label}</p>
              </div>
              <p className="text-base leading-relaxed text-muted">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-32 border-t border-border/40 pt-12">
        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
          <div className="space-y-3">
            <p className="text-eyebrow uppercase tracking-[0.18em] text-accent">Lộ trình tương lai</p>
            <h2 className="max-w-2xl text-display font-semibold tracking-tight md:text-5xl">
              Mở rộng bản đồ, đào sâu nghiên cứu, giữ trải nghiệm nhẹ nhàng.
            </h2>
          </div>
          <div className="flex lg:justify-end">
            <Button asChild variant="outline" size="lg">
              <Link href="/dashboard">Về bảng quan trắc</Link>
            </Button>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
