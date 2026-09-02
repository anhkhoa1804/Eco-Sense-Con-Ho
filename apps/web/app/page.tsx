import Link from "next/link";
import { cache, Suspense } from "react";
import { ArrowRight, ClipboardList, Info, LayoutDashboard, Send, Sprout, Waves } from "lucide-react";
import { MapStation, StationNetworkMap } from "@/components/dashboard/station-network-map";
import { FieldNotesCarousel } from "@/components/home/field-notes-carousel";
import { Hero } from "@/components/home/hero";
import { LocalGatewayCard, type LocalGatewayReading } from "@/components/home/local-gateway-card";
import { Reveal } from "@/components/ui/reveal";
import { PublicShell } from "@/components/layout/public-shell";
import { TranslationNotice } from "@/components/layout/translation-notice";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { Skeleton } from "@/components/ui/skeleton";
import { freshnessStatus, StatusIndicator } from "@/components/ui/status-indicator";
import { getRecentPosts } from "@/lib/content/posts";
import { getI18n } from "@/lib/i18n/server";
import { getPublicRepositories } from "@/lib/publicRead";
import { filterSnapshotsToPilotStations, PILOT_STATION_IDS, stationHref, type PilotStationId } from "@/lib/publicStations";
import { stationProfiles, stationText, type StationKind } from "@/lib/stationProfile";
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

/**
 * What each node is built to measure — capability, not current readings.
 *
 * Absorbed from the deleted "04 · Quan trắc" chapter. That section restated
 * these same metrics under these same station names in its own three-column
 * grid, directly beneath this one: the reader met "Trạm 1 — Gần sông" twice
 * within one screen, and the homepage ran four consecutive grids of boxes.
 */
const STATION_METRICS: Record<PilotStationId, readonly string[]> = {
  STATION_01: ["Độ mặn", "Mực nước"],
  STATION_02: ["Độ ẩm đất", "EC đất", "Độ pH đất", "Nhiệt độ đất", "Nhiệt độ không khí", "Độ ẩm không khí"],
  STATION_03: [],
};

async function NetworkChapter() {
  const data = await getObservatoryData();
  const { dict } = await getI18n();

  return (
    <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
      {PILOT_STATION_IDS.map((id, index) => {
        const profile = stationProfiles[id];
        const text = stationText(id, dict);
        const Icon = KIND_ICON[profile.kind];
        const timestamp = latestTimestampFor(id, data);

        return (
          <Link
            key={id}
            href={stationHref(id)}
            className="group flex flex-col gap-6 bg-background p-6 transition-colors duration-[var(--motion-base)] hover:bg-muted/20 md:p-8"
          >
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-medium tracking-[0.16em] text-muted [font-family:var(--font-data)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <Icon className="h-5 w-5 text-accent" aria-hidden />
            </div>

            <div className="flex-1 space-y-2">
              <h3 className="text-xl font-semibold tracking-tight">{text.name}</h3>
              <p className="text-sm text-muted">{text.location}</p>
              <p className="pt-1 text-sm leading-relaxed text-muted">{text.intro}</p>
            </div>

            {/* What this node is built to measure. This absorbed the old "04 ·
                Quan trắc" chapter, which listed the same metrics under the same
                station names in a second three-column grid immediately below
                this one — two sections, one fact, and the page's third
                consecutive grid of boxes. Stated here it belongs to the station
                it describes. */}
            {STATION_METRICS[id].length > 0 ? (
              <ul className="flex flex-wrap gap-x-2 gap-y-1">
                {STATION_METRICS[id].map((metric) => (
                  <li
                    key={metric}
                    className="rounded-sm border border-border/70 px-1.5 py-0.5 text-[11px] text-foreground-subtle"
                  >
                    {metric}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="flex items-center justify-between border-t border-border/60 pt-4">
              <StatusIndicator status={freshnessStatus(timestamp)} dict={dict} compact />
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
  const { dict } = await getI18n();

  const mapStations: MapStation[] = (data?.snapshots ?? []).map((snapshot) => ({
    id: snapshot.station.id,
    name: stationText(snapshot.station.id, dict).name,
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

export default async function HomePage() {
  const posts = getRecentPosts(5);
  const { dict } = await getI18n();
  const localGatewayReading = null as LocalGatewayReading | null;

  return (
    <PublicShell activePath="/">
      <Hero />

      <div className="h-flow-large">
        {/* The pilot disclosure. It used to be the fourth item stacked under
            the hero's title, which is exactly the accumulation of small print
            that made the hero feel unfinished. It is not decoration though —
            without it a reader can mistake this for live field data — so it
            moves out of the hero rather than being deleted, and sits on the
            seam between the opening and the network chapter where it reads as
            a caption on the whole page. */}
        <p className="border-l-2 border-accent/40 pl-4 text-sm text-foreground-subtle">
          {dict.home.pilotNote}
        </p>

        <TranslationNotice />

        <LocalGatewayCard initialReading={localGatewayReading} />

        <div className="hidden">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">Local gateway</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-4xl font-semibold tracking-tight text-foreground">
                {localGatewayReading?.air_temp_c != null ? `${localGatewayReading.air_temp_c}°C` : "--°C"}
              </div>
              <p className="mt-1 text-sm text-muted">
                {localGatewayReading?.station_id ?? "Chưa có dữ liệu"}
              </p>
            </div>
            <div className="text-right text-xs text-muted">
              <div>Gateway</div>
              <div className="font-medium text-foreground">{localGatewayReading?.gateway_id ?? "--"}</div>
            </div>
          </div>
        </div>

        {/* Moved here from Monitoring, where it opened the page as a full
            card above the title. Home is where a first-time visitor lands,
            and it renders only when the browser has actually fired
            `beforeinstallprompt` — so most visits never see it at all. */}
        <InstallPrompt />

        <div className="h-flow-chapter">
        {/* 02 — Network.
            No width className — this section already sits inside
            PublicShell's `main.h-wide`, which supplies the same 1200px cap
            and gutter. Re-stating `max-w-[var(--width-content-wide)]` here
            was a provable no-op (it can never bind tighter than the parent
            already does) left over from before the width system had a
            single source of truth; removing it changes nothing on screen. */}
        <Reveal stagger as="section">
          <ChapterHeading
            eyebrow="02 · Mạng lưới"
            title="Ba điểm nhìn, một mạng lưới."
            lead="Hai trạm đo đặt ở hai vùng khác nhau của cù lao, cùng một điểm truyền dữ liệu về hệ thống. Danh sách chỉ số bên dưới là năng lực đo của từng trạm, không phải số liệu hiện tại — trạng thái thật nằm ở trang Quan trắc."
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

        {/* 04 — Why it matters.
            The old "04 · Quan trắc" chapter is gone: it listed each station's
            metrics in a three-column grid immediately after the network
            chapter had already named those same stations, which made the
            homepage run four consecutive grids of boxes and introduced the
            reader to "Trạm 1" twice within one screen. The metrics now sit on
            the station they belong to; its honesty caveat — that this is
            measurement capability, not current readings — moved to the
            network chapter's lead, where the claim is actually made. */}
        <Reveal stagger as="section" className="h-gap-large mx-auto max-w-[var(--width-reading)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">04 · Vì sao</p>
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
        <Reveal stagger as="section" className="h-gap-large">
          <ChapterHeading eyebrow="05 · Cách vận hành" title="Từ hiện trường đến màn hình." />
          <div className="mt-10">
            <HowChapter />
          </div>
        </Reveal>

        {/* 07 — Field notes */}
        <Reveal stagger as="section">
          <ChapterHeading
            eyebrow="06 · Ghi chép"
            title="Ghi chép trong quá trình xây dựng."
            lead="Các bài viết về thiết kế, phương pháp và những gì dự án đang thử nghiệm."
          />
          <div className="mt-10">
            <FieldNotesCarousel posts={posts} />
          </div>
        </Reveal>

        {/* 08 — Explore */}
        <Reveal stagger as="section" className="pb-8">
          <ChapterHeading eyebrow="07 · Tiếp tục" title="Đi sâu hơn." className="mb-10" />
          <ExploreChapter />
        </Reveal>
        </div>
      </div>
    </PublicShell>
  );
}
