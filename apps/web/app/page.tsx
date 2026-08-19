import Link from "next/link";
import { cache, Suspense } from "react";
import { ArrowRight, ClipboardList, Info, LayoutDashboard, Send, Sprout, Waves, Wind } from "lucide-react";
import { MapStation, StationNetworkMap } from "@/components/dashboard/station-network-map";
import { FieldNotesCarousel } from "@/components/home/field-notes-carousel";
import { Hero } from "@/components/home/hero";
import { Reveal } from "@/components/ui/reveal";
import { PublicShell } from "@/components/layout/public-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { freshnessStatus, StatusIndicator } from "@/components/ui/status-indicator";
import { getRecentPosts } from "@/lib/content/posts";
import { getPublicRepositories } from "@/lib/publicRead";
import { filterSnapshotsToPilotStations, PILOT_STATION_IDS, type PilotStationId } from "@/lib/publicStations";
import { stationProfiles, type StationKind } from "@/lib/stationProfile";
import type { SoilReading, StationReadingSnapshot } from "@/types";

export const revalidate = 60;

const KIND_ICON: Record<StationKind, typeof Waves> = { water: Waves, soil: Sprout, gateway: Send };

interface ObservatoryData {
  /** Already filtered to the curated 3-station pilot allowlist — never the raw 5-row DB response. */
  snapshots: StationReadingSnapshot[];
  soilReading: SoilReading | null;
}

/**
 * One fetch shared by the network chapter and the map chapter, wrapped in
 * React's cache() so two independent <Suspense> consumers don't double-query
 * for the same render.
 *
 * The homepage deliberately reads only what it needs to show *existence and
 * state* — Monitoring owns detailed telemetry (brief §23).
 */
const getObservatoryData = cache(async (): Promise<ObservatoryData | null> => {
  const context = getPublicRepositories();
  if (!context) return null;

  try {
    const { repos, scope } = context;
    const allSnapshots = await repos.readings.getSnapshots(scope);
    const soilReading = await repos.readings.getLatestSoilReadingByStation("STATION_02", scope);
    return { snapshots: filterSnapshotsToPilotStations(allSnapshots), soilReading };
  } catch {
    return null;
  }
});

/**
 * STATION_02 has no environmental_readings row — its real timestamp lives on
 * soil_readings instead. Kind-aware so soil freshness is never silently read
 * as "unavailable" just because the water-shaped fields are empty.
 */
function latestTimestampFor(stationId: PilotStationId, data: ObservatoryData | null): string | null {
  if (stationProfiles[stationId].kind === "soil") {
    return data?.soilReading?.timestamp ?? null;
  }
  const snapshot = data?.snapshots.find((s) => s.station.id === stationId);
  return snapshot?.reading?.timestamp ?? snapshot?.health?.timestamp ?? null;
}

// ---------------------------------------------------------------------------
// 02 — The network
// ---------------------------------------------------------------------------

async function NetworkChapter() {
  const data = await getObservatoryData();

  return (
    <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
      {PILOT_STATION_IDS.map((id, index) => {
        const profile = stationProfiles[id];
        const Icon = KIND_ICON[profile.kind];
        const timestamp = latestTimestampFor(id, data);

        return (
          <Link
            key={id}
            href={`/s/${id}`}
            className="group flex flex-col gap-6 bg-background p-6 transition-colors duration-[var(--motion-base)] hover:bg-muted/20 md:p-8"
          >
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium tracking-[0.16em] text-muted [font-family:var(--font-data)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <Icon className="h-5 w-5 text-accent" aria-hidden />
            </div>

            <div className="flex-1 space-y-2">
              <h3 className="text-xl font-semibold tracking-tight">{profile.name}</h3>
              <p className="text-sm text-muted">{profile.location}</p>
              <p className="pt-1 text-sm leading-relaxed text-muted">{profile.intro}</p>
            </div>

            <div className="flex items-center justify-between border-t border-border/60 pt-4">
              <StatusIndicator status={freshnessStatus(timestamp)} compact />
              <span className="inline-flex items-center gap-1 text-xs font-medium text-accent opacity-0 transition-opacity duration-[var(--motion-base)] group-hover:opacity-100">
                Xem trạm
                <ArrowRight className="h-3 w-3" aria-hidden />
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function NetworkFallback() {
  return (
    <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-6 bg-background p-6 md:p-8">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-4 w-28" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 03 — The map
// ---------------------------------------------------------------------------

async function MapChapter() {
  const data = await getObservatoryData();

  const mapStations: MapStation[] = (data?.snapshots ?? []).map((snapshot) => ({
    id: snapshot.station.id,
    name: stationProfiles[snapshot.station.id]?.name ?? snapshot.station.name,
    lat: snapshot.station.lat,
    lng: snapshot.station.lng,
    freshness: freshnessStatus(latestTimestampFor(snapshot.station.id as PilotStationId, data)),
  }));

  return <StationNetworkMap stations={mapStations} variant="observatory" />;
}

function MapFallback() {
  return <Skeleton className="h-[420px] w-full rounded-lg sm:h-[480px] lg:h-[560px]" />;
}

// ---------------------------------------------------------------------------
// 04 — What the network observes (capability, not current telemetry)
// ---------------------------------------------------------------------------

const OBSERVED_DOMAINS = [
  {
    icon: Waves,
    domain: "Nước",
    at: "Trạm 1 · khu ven sông",
    metrics: ["Độ mặn", "Mực nước"],
  },
  {
    icon: Sprout,
    domain: "Đất",
    at: "Trạm 2 · khu canh tác",
    metrics: ["Độ ẩm đất", "EC đất", "Độ pH đất", "Nhiệt độ đất"],
  },
  {
    // Wind, not Send — Send is the gateway/transmission mark used in the
    // network chapter, and reusing it here would imply this row is about
    // data delivery rather than atmospheric measurement.
    icon: Wind,
    domain: "Không khí",
    at: "Trạm 2 · khu canh tác",
    metrics: ["Nhiệt độ không khí", "Độ ẩm không khí"],
  },
] as const;

function ObservesChapter() {
  return (
    <div className="grid gap-10 md:grid-cols-3 md:gap-12">
      {OBSERVED_DOMAINS.map(({ icon: Icon, domain, at, metrics }) => (
        <div key={domain} className="space-y-5 border-t-2 border-accent/40 pt-6">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-2xl font-semibold tracking-tight">{domain}</h3>
            <Icon className="h-5 w-5 shrink-0 text-accent" aria-hidden />
          </div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted">{at}</p>
          <ul className="space-y-2.5">
            {metrics.map((metric) => (
              <li key={metric} className="flex items-baseline gap-3 text-base">
                <span className="h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
                {metric}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 06 — How it works
// ---------------------------------------------------------------------------

const WORKFLOW = [
  { step: "Quan sát", text: "Cảm biến tại ba điểm ghi lại điều kiện nước, đất và không khí ngay tại chỗ." },
  { step: "Thu thập", text: "Số liệu được gom về một điểm truyền và chuyển tiếp về hệ thống." },
  { step: "Diễn giải", text: "Mỗi giá trị đi kèm thời điểm, trạng thái thiết bị và nguồn gốc của nó." },
  { step: "Chia sẻ", text: "Kết quả hiển thị công khai, kể cả khi chưa có dữ liệu để hiển thị." },
] as const;

function HowChapter() {
  return (
    <ol className="grid gap-px overflow-hidden border-y border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
      {WORKFLOW.map(({ step, text }, index) => (
        <li key={step} className="space-y-3 bg-background p-6 lg:p-7">
          <span className="text-[11px] tracking-[0.16em] text-accent [font-family:var(--font-data)]">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="text-lg font-semibold tracking-tight">{step}</h3>
          <p className="text-sm leading-relaxed text-muted">{text}</p>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// 08 — Explore
// ---------------------------------------------------------------------------

const EXPLORE = [
  { href: "/about", icon: Info, label: "Giới thiệu", text: "Tìm hiểu HORIZON và bối cảnh của dự án." },
  { href: "/dashboard", icon: LayoutDashboard, label: "Quan trắc", text: "Xem mạng lưới và dữ liệu hiện có." },
  { href: "/report", icon: ClipboardList, label: "Báo cáo", text: "Gửi một quan sát từ hiện trường." },
] as const;

function ExploreChapter() {
  return (
    <div className="border-t border-border">
      {EXPLORE.map(({ href, icon: Icon, label, text }) => (
        <Link
          key={href}
          href={href}
          className="group flex items-center gap-5 border-b border-border py-7 transition-colors duration-[var(--motion-base)] hover:bg-muted/20 md:gap-8 md:py-9"
        >
          <Icon className="h-5 w-5 shrink-0 text-accent md:h-6 md:w-6" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-2xl font-semibold tracking-tight md:text-3xl">{label}</span>
            <span className="mt-1 block text-sm text-muted md:text-base">{text}</span>
          </span>
          <ArrowRight
            className="h-5 w-5 shrink-0 text-muted transition-transform duration-[var(--motion-base)] group-hover:translate-x-1 group-hover:text-accent"
            aria-hidden
          />
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/** Shared eyebrow+title block. Widths vary per chapter — the heading rhythm does not. */
function ChapterHeading({
  eyebrow,
  title,
  lead,
  className,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>
      {lead ? <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">{lead}</p> : null}
    </div>
  );
}

export default function HomePage() {
  const posts = getRecentPosts(5);

  return (
    <PublicShell activePath="/">
      <Hero />

      <div className="space-y-28 pt-20 md:space-y-36 md:pt-28">
        {/* 02 — Network */}
        <Reveal stagger as="section" className="mx-auto max-w-[var(--width-content-wide)]">
          <ChapterHeading
            eyebrow="02 · Mạng lưới"
            title="Ba điểm nhìn, một mạng lưới."
            lead="Hai trạm đo đặt ở hai vùng khác nhau của cù lao, cùng một điểm truyền dữ liệu về hệ thống."
          />
          <div className="mt-10">
            <Suspense fallback={<NetworkFallback />}>
              <NetworkChapter />
            </Suspense>
          </div>
        </Reveal>

        {/* 03 — Map.
            The heading stays in normal flow so it lands on the same left edge
            as every other section; only the map itself takes the spatial
            breakout, which is the one element with an actual spatial reason
            to be wider. Previously the whole chapter sat inside `.full-bleed`,
            whose 100vw includes the scrollbar gutter — that dragged the
            heading 8px off the page grid.

            `full-bleed` and `Reveal` must also stay on separate elements: both
            drive `transform`, and the reveal's `transform: none` end state
            would cancel full-bleed's translateX(-50%) centering. */}
        <Reveal as="section">
          <ChapterHeading
            eyebrow="03 · Không gian"
            title="Ba điểm đo trên một cù lao."
            lead="Vị trí thật của từng trạm, hiển thị đúng trạng thái dữ liệu hiện tại."
          />
          <div className="full-bleed mt-10">
            <div className="h-spatial">
              <Suspense fallback={<MapFallback />}>
                <MapChapter />
              </Suspense>
            </div>
          </div>
        </Reveal>

        {/* 04 — What it observes */}
        <Reveal stagger as="section" className="mx-auto max-w-[var(--width-content-wide)]">
          <ChapterHeading
            eyebrow="04 · Quan trắc"
            title="Mạng lưới được thiết kế để quan trắc những gì."
            lead="Đây là năng lực đo của hệ thống, không phải số liệu hiện tại. Trạng thái thật của từng chỉ số nằm ở trang Quan trắc."
          />
          <div className="mt-12">
            <ObservesChapter />
          </div>
        </Reveal>

        {/* 05 — Why it matters */}
        <Reveal stagger as="section" className="mx-auto max-w-[var(--width-reading)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">05 · Vì sao</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
            Điều kiện môi trường thay đổi ở quy mô rất nhỏ.
          </h2>
          <div className="mt-8 space-y-6 text-lg leading-relaxed text-muted">
            <p>
              Một bản tin thời tiết cho cả tỉnh không nói được nước ngoài bờ hôm nay mặn hơn hôm qua bao nhiêu. Trên một
              cù lao giữa sông, khác biệt giữa hai điểm cách nhau vài trăm mét đã có thể đủ để dẫn tới hai quyết định
              tưới tiêu khác nhau.
            </p>
            <p>
              HORIZON đang thử nghiệm một cách tiếp cận đơn giản: đặt thiết bị đo ngay tại nơi sự thay đổi diễn ra, ghi
              lại liên tục, và trình bày kết quả cùng với ngữ cảnh của nó — thời điểm đo, tình trạng thiết bị, và nguồn
              gốc của từng con số.
            </p>
            <p>
              Giai đoạn thí điểm này được thiết kế để kiểm chứng một giả định, chứ chưa phải để kết luận: rằng dữ liệu
              liên tục tại chỗ sẽ bổ sung được điều gì đó cho hiểu biết vốn có của người canh tác.
            </p>
          </div>
        </Reveal>

        {/* 06 — How it works */}
        <Reveal stagger as="section" className="mx-auto max-w-[var(--width-content-wide)]">
          <ChapterHeading eyebrow="06 · Cách vận hành" title="Từ hiện trường đến màn hình." />
          <div className="mt-10">
            <HowChapter />
          </div>
        </Reveal>

        {/* 07 — Field notes */}
        <Reveal stagger as="section" className="mx-auto max-w-[var(--width-content-wide)]">
          <ChapterHeading
            eyebrow="07 · Ghi chép"
            title="Ghi chép trong quá trình xây dựng."
            lead="Các bài viết về thiết kế, phương pháp và những gì dự án đang thử nghiệm."
          />
          <div className="mt-10">
            <FieldNotesCarousel posts={posts} />
          </div>
        </Reveal>

        {/* 08 — Explore */}
        <Reveal stagger as="section" className="mx-auto max-w-[var(--width-content-wide)] pb-8">
          <ChapterHeading eyebrow="08 · Tiếp tục" title="Đi sâu hơn." className="mb-10" />
          <ExploreChapter />
        </Reveal>
      </div>
    </PublicShell>
  );
}
