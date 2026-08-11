import Link from "next/link";
import { ArrowRight, BarChart3, HeartHandshake, Radar, Waves } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const stations = [
  {
    name: "Đầu Cồn",
    desc: "Khu đầu cù lao, nơi mặt nước tác động trực tiếp đến sinh hoạt và sản xuất.",
    href: "/s/STATION_01",
  },
  {
    name: "Homestay Cô Ba",
    desc: "Khu đón khách, giúp du khách hiểu cách theo dõi môi trường nước tại Cồn Hô.",
    href: "/s/STATION_02",
  },
  {
    name: "Cuối Cồn",
    desc: "Khu cuối cù lao, nơi mực nước và xói lở có tác động rõ hơn đến bờ sông.",
    href: "/s/STATION_03",
  },
];

const milestones = [
  { label: "Climate challenges", desc: "Độ mặn, xói lở, ngập nước và biến động thủy văn." },
  { label: "Monitoring network", desc: "Trạm IoT công khai, trạng thái rõ ràng, dữ liệu gần thời gian thực." },
  { label: "Community participation", desc: "Quan sát hiện trường, phản hồi nhanh, thêm ngữ cảnh địa phương." },
  { label: "Research value", desc: "Dữ liệu có thể đọc, so sánh và theo dõi dài hạn." },
  { label: "Future roadmap", desc: "Mở rộng lớp bản đồ, cảnh báo và trải nghiệm di động." },
];

export default function AboutPage() {
  return (
    <PublicShell activePath="/about">
      <section className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-8">
          <div className="flex flex-wrap gap-2">
            <Badge variant="healthy">About Cồn Hô</Badge>
            <Badge variant="default">Climate resilience</Badge>
          </div>

          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.22em] text-accent">Product story</p>
            <h2 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-7xl">
              Cồn Hô được kể bằng dữ liệu, không phải bằng tài liệu kỹ thuật.
            </h2>
            <p className="max-w-2xl text-lg leading-relaxed text-muted">
              Eco-Sense makes the island legible: salinity, water level, and station health are presented so local
              communities, researchers, and visitors can understand the environment immediately.
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

        <div className="relative min-h-[560px] overflow-hidden rounded-[42px] bg-[linear-gradient(180deg,#f6faf6_0%,#edf5ef_100%)] shadow-[0_24px_80px_rgba(15,23,42,0.08)] ring-1 ring-border/70">
          <div className="absolute inset-x-10 top-20 h-px bg-border/70" />
          <div className="absolute inset-y-10 left-1/2 w-px bg-border/70" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(31,138,76,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(15,118,110,0.08),transparent_28%)]" />
          <div className="absolute left-8 top-8 rounded-full bg-background/80 px-4 py-1.5 text-xs font-medium text-muted shadow-sm backdrop-blur">
            Monitoring network
          </div>
          {stations.map((station, index) => (
            <Link
              key={station.name}
              href={station.href}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${20 + index * 24}%`, top: `${30 + index * 20}%` }}
            >
              <div className="rounded-full bg-background/80 px-4 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur">
                {station.name}
              </div>
            </Link>
          ))}
          <div className="absolute inset-x-8 bottom-8 grid gap-3 sm:grid-cols-3">
            {["Salinity", "Water level", "Station status"].map((item) => (
              <div key={item} className="text-sm text-muted">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-20 grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.22em] text-accent">Why it matters</p>
          <h3 className="text-3xl font-semibold tracking-tight">The hierarchy is narrative first, then evidence.</h3>
          <p className="max-w-xl text-sm leading-relaxed text-muted">
            The page should read like a product story: first the place, then the pressure, then the network, then the
            people who use it.
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
          <p className="text-xs uppercase tracking-[0.22em] text-accent">Impact</p>
          <h3 className="text-3xl font-semibold tracking-tight">
            Science, tourism, and local decision-making share the same interface.
          </h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { icon: Waves, title: "Environmental signal", desc: "Clear salinity and water-level readings." },
            { icon: HeartHandshake, title: "Community participation", desc: "Field reports add local context." },
            { icon: BarChart3, title: "Research value", desc: "Trends are readable and comparable." },
            { icon: Radar, title: "Trust", desc: "The interface looks like a real network." },
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
          <p className="text-xs uppercase tracking-[0.22em] text-accent">Future roadmap</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight">
            Expand the map, deepen the research, keep the experience calm.
          </h3>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard">Return to dashboard</Link>
        </Button>
      </section>
    </PublicShell>
  );
}
