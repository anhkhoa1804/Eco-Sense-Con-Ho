import Link from "next/link";
import { cache, Suspense } from "react";
import { ArrowRight, ClipboardList, LayoutDashboard, Mail, Send, Shield, Sprout, Waves } from "lucide-react";
import { MapStation, StationNetworkMap } from "@/components/dashboard/station-network-map";
import { GalleryStrip } from "@/components/about/gallery-strip";
import { ContactForm } from "@/components/home/contact-form";
import { FieldNotesCarousel } from "@/components/home/field-notes-carousel";
import { Hero } from "@/components/home/hero";
import { Reveal } from "@/components/ui/reveal";
import { PublicShell } from "@/components/layout/public-shell";
import { TranslationNotice } from "@/components/layout/translation-notice";
import { Skeleton } from "@/components/ui/skeleton";
import { freshnessStatus, StatusIndicator } from "@/components/ui/status-indicator";
import { getGalleryItems } from "@/lib/content/gallery";
import { getRecentPosts } from "@/lib/content/posts";
import { getI18n } from "@/lib/i18n/server";
import { STATION_COORDS } from "@/lib/geo";
import { getPublicRepositories } from "@/lib/publicRead";
import { filterSnapshotsToPilotStations, OBSERVATORY_HREF, PILOT_STATION_IDS, type PilotStationId } from "@/lib/publicStations";
import { stationProfiles, stationText, type StationKind } from "@/lib/stationProfile";
import type { SoilReading, StationReadingSnapshot } from "@/types";

export const revalidate = 60;

/**
 * HOME — THE CANONICAL PROJECT PAGE.
 *
 * This page absorbed /about. The two had converged into near-duplicates: both
 * opened on the island, both introduced the same three stations, both
 * explained the same data flow, both closed with the same field notes. A
 * reader had no way to tell which one answered "what is this project", and
 * maintaining the overlap meant every honesty caveat had to be written twice.
 *
 * What came across is the material About genuinely owned — the place itself,
 * the hardware, how a number becomes information, the gallery, and who is
 * building it. What did not come across is anything Home already said.
 *
 * The chapter order is the argument the project makes, in order:
 *
 *   hero → what this is → where and why → the three points → real positions →
 *   what it measures → how a reading becomes information → what it means →
 *   what it looks like → notes → who → contact → where next
 *
 * Compositions vary deliberately: reading-measure prose, a full-bleed
 * illustration, a bordered card grid, image/text splits, a horizontal strip,
 * a panel. A page where every chapter is the same card is what this replaced.
 */

const KIND_ICON: Record<StationKind, typeof Waves> = { water: Waves, soil: Sprout, gateway: Send };

/**
 * A direct contact address, once the project has one it wants published.
 *
 * Deliberately `null` rather than a plausible-looking address. A contact
 * action that silently goes nowhere is worse than none, and not printing
 * things the project cannot stand behind is the whole premise here. While
 * this is null the contact chapter routes people to the report flow, which is
 * real and persisted; set it to a string and a mail action appears beside it.
 */
const CONTACT_EMAIL: string | null = null;

interface ObservatoryData {
  /** Already filtered to the curated 3-station pilot allowlist — never the raw 5-row DB response. */
  snapshots: StationReadingSnapshot[];
  soilReading: SoilReading | null;
}

/**
 * One fetch shared by the network chapter and the map chapter, wrapped in
 * React's cache() so two independent <Suspense> consumers don't double-query
 * for the same render.
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
// Shared blocks
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
      <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight md:text-4xl">{title}</h2>
      {lead ? <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">{lead}</p> : null}
    </div>
  );
}

/** Reading-measure prose, so every essay chapter sits on one measure. */
function Prose({ children }: { children: React.ReactNode }) {
  return <div className="mt-8 space-y-6 text-lg leading-relaxed text-muted">{children}</div>;
}

/** Printed on the station-map illustration — read off the asset, not estimated here. */
const ISLAND_STATS = [
  { label: "Chiều dài", value: "~1.000 m" },
  { label: "Chiều ngang", value: "~300 m" },
  { label: "Diện tích", value: "~18–20 ha" },
] as const;

// ---------------------------------------------------------------------------
// The three observation points
// ---------------------------------------------------------------------------

/**
 * What each node is built to measure — capability, not current readings.
 *
 * This, with each station's role and location, is the surviving half of the
 * per-station pages. Their other half was live telemetry, which the
 * observatory shows better, so `/s/:id` now redirects there.
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
            href={OBSERVATORY_HREF}
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
                {dict.nav.monitoring}
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
// Real positions
// ---------------------------------------------------------------------------

async function MapChapter() {
  const data = await getObservatoryData();
  const { dict } = await getI18n();

  // Positions come from lib/geo, not from the snapshot rows. A station's
  // surveyed coordinate is a fact about the installation; the database column
  // is operational state that can be seeded, edited, or left at a 0,0 default
  // — and 0,0 is a real place in the Gulf of Guinea.
  const mapStations: MapStation[] = (data?.snapshots ?? []).map((snapshot) => {
    const id = snapshot.station.id as PilotStationId;
    return {
      id,
      name: stationText(id, dict).name,
      lat: STATION_COORDS[id]?.lat ?? snapshot.station.lat,
      lng: STATION_COORDS[id]?.lng ?? snapshot.station.lng,
      freshness: freshnessStatus(latestTimestampFor(id, data)),
    };
  });

  return <StationNetworkMap stations={mapStations} variant="observatory" />;
}

function MapFallback() {
  return <Skeleton className="h-[420px] w-full rounded-lg sm:h-[480px] lg:h-[560px]" />;
}

// ---------------------------------------------------------------------------
// What the system observes
// ---------------------------------------------------------------------------

/**
 * Sensor models come from docs/SENSOR_CAPABILITY_MATRIX.md, which traces each
 * metric from physical sensor → firmware → wire contract → DB column →
 * repository → UI.
 *
 * Home renders only the part numbers, as a compact three-column index. The
 * `role` and `note` text — including the honest record of the EC probe the
 * firmware cannot yet read — is the substance of
 * /posts/phan-cung-cua-mot-tram-do, and is kept here so the two cannot
 * describe different hardware.
 */
const HARDWARE_GROUPS = [
  {
    domain: "Nước",
    station: "Trạm 1",
    image: "/assets/illustrations/station-water-placeholder.svg",
    parts: [
      { part: "A02YYUW", role: "Cảm biến siêu âm đo khoảng cách tới mặt nước, từ đó suy ra mực nước.", note: null },
      {
        part: "ES-EC-WT-01",
        role: "Đầu dò độ dẫn điện trong nước, dùng để suy ra độ mặn.",
        note: "Phần đọc giá trị từ đầu dò này chưa được lập trình — hiện là điểm còn dang dở lớn nhất của hệ thống.",
      },
    ],
  },
  {
    domain: "Đất và không khí",
    station: "Trạm 2",
    image: "/assets/illustrations/station-soil-placeholder.svg",
    parts: [
      { part: "ES-SM-THEC-01", role: "Đầu dò cắm trong đất, đo cùng lúc độ ẩm, độ dẫn điện và nhiệt độ của đất.", note: null },
      { part: "ES-PH-SOIL-01", role: "Đầu dò đo độ pH của đất.", note: null },
      { part: "SHT30", role: "Cảm biến nhiệt độ và độ ẩm không khí ngay tại vườn.", note: null },
    ],
  },
  {
    domain: "Truyền dữ liệu",
    station: "Gateway",
    image: "/assets/illustrations/gateway-placeholder.svg",
    parts: [
      {
        part: "SX1278 (LoRa)",
        role: "Đường truyền tầm xa, điện năng thấp giữa hai trạm đo và gateway — không cần phủ sóng di động tại chỗ đặt trạm.",
        note: null,
      },
      {
        part: "Mô-đun di động",
        role: "Gateway là điểm duy nhất cần kết nối internet; nó gom dữ liệu, ký xác thực rồi gửi về hệ thống.",
        note: null,
      },
      { part: "ESP32", role: "Vi điều khiển chạy trên cả ba thiết bị, đọc cảm biến và quản lý chu kỳ gửi dữ liệu.", note: null },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// How a reading becomes information
// ---------------------------------------------------------------------------

const WORKFLOW = [
  { step: "Đo", text: "Cảm biến tại trạm đọc giá trị theo chu kỳ, kèm trạng thái của chính cảm biến đó." },
  { step: "Truyền", text: "Trạm gửi số liệu thô qua LoRa về gateway — thiết bị duy nhất cần internet." },
  { step: "Lưu", text: "Gateway ký xác thực rồi gửi lên hệ thống; dữ liệu không hợp lệ bị từ chối thay vì lưu tạm." },
  { step: "Diễn giải", text: "Mỗi giá trị được gắn thời điểm đo, tình trạng thiết bị và nguồn gốc của nó." },
  { step: "Trình bày", text: "Kết quả hiển thị công khai, kể cả khi trạng thái đúng là “chưa có dữ liệu”." },
] as const;

function WorkflowChapter() {
  return (
    <ol className="grid gap-px overflow-hidden border-y border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
      {WORKFLOW.map(({ step, text }, index) => (
        <li key={step} className="space-y-3 bg-background p-6">
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
// Where to go next
// ---------------------------------------------------------------------------

const EXPLORE = [
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

export default async function HomePage() {
  const posts = getRecentPosts(5);
  const gallery = getGalleryItems();
  const { dict } = await getI18n();

  return (
    <PublicShell activePath="/">
      <Hero />

      <div className="h-flow-large">
        <TranslationNotice />

        <div id="horizon" className="h-flow-chapter scroll-mt-28">
          {/* 01 — What HORIZON is.
              The hero's old pilot caption ("Giai đoạn thí điểm · thiết bị chưa
              lắp đặt ngoài thực địa") is gone from under the title: a hero
              should say what a project IS, not apologise for what it is not
              yet. The same fact is stated here, where there is room to explain
              it rather than merely disclaim it — and again on the hardware
              chapter, which is where it actually bites. */}
          <Reveal stagger as="section" className="mx-auto max-w-[var(--width-reading)]">
            <ChapterHeading eyebrow="01 · Dự án" title="Một mạng lưới quan trắc đặt đúng nơi cần biết." />
            <Prose>
              <p>
                HORIZON là một mạng lưới quan trắc môi trường quy mô nhỏ tại Cồn Hô, Vĩnh Long. Ba điểm đo ghi lại điều
                kiện nước, đất và không khí ngay tại chỗ, rồi công bố kết quả kèm nguồn gốc của từng con số.
              </p>
              <p>
                Nền tảng dữ liệu và giao diện đã hoạt động thật. Thiết bị ngoài thực địa thì chưa — trang này nói rõ
                ranh giới đó ở mọi chỗ nó xuất hiện, thay vì trình bày một hệ thống hoàn chỉnh hơn thực tế.
              </p>
            </Prose>
          </Reveal>

          {/* 02 — Where, and why here */}
          <Reveal stagger as="section" className="mx-auto max-w-[var(--width-reading)]">
            <ChapterHeading eyebrow="02 · Nơi chốn" title="Một cù lao nông nghiệp giữa sông." />
            <Prose>
              <p>
                Cồn Hô là một cù lao thuộc tỉnh Vĩnh Long, nằm giữa các nhánh sông ở đồng bằng sông Cửu Long. Đây là một
                dải đất hẹp — dài khoảng một cây số và rộng chừng ba trăm mét — nên gần như mọi điểm trên cồn đều cách
                mặt nước không xa.
              </p>
              <p>
                Một bản tin cho cả tỉnh có thể nói hôm nay mặn hay không mặn. Nó không nói được nước ngay ngoài bờ vườn
                nhà mình lúc này thế nào, hay khác gì so với hôm qua. Khoảng cách giữa hai câu hỏi đó là lý do HORIZON
                tồn tại.
              </p>
            </Prose>
          </Reveal>

          <section className="full-bleed">
            <Reveal className="h-spatial">
              <figure className="space-y-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- local static asset with known aspect ratio; next/image has previously failed to resolve in this project (see wordmark.tsx) */}
                <img
                  src="/assets/illustrations/con-ho-station-map.png"
                  alt="Bản đồ minh họa vị trí ba điểm quan trắc trên Cồn Hô: Trạm 1 gần sông, Trạm 2 giữa cồn, Gateway cuối cồn"
                  width={1614}
                  height={974}
                  loading="lazy"
                  className="w-full rounded-lg border border-border"
                />
                <figcaption className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 text-sm text-muted">
                  <span>Bản đồ minh họa, không phải ảnh vệ tinh — thể hiện vị trí tương đối của ba điểm quan trắc.</span>
                  <span className="flex flex-wrap gap-x-5 [font-family:var(--font-data)]">
                    {ISLAND_STATS.map((stat) => (
                      <span key={stat.label}>
                        {stat.label} {stat.value}
                      </span>
                    ))}
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          </section>

          {/* 03 — The three observation points */}
          <Reveal stagger as="section">
            <ChapterHeading
              eyebrow="03 · Mạng lưới"
              title="Ba vai trò, không phải ba bản sao."
              lead="Mỗi điểm được thiết kế cho một nhiệm vụ khác nhau, thay vì đặt cùng một bộ cảm biến ở cả ba nơi. Danh sách chỉ số là năng lực đo của từng trạm, không phải số liệu hiện tại — trạng thái thật nằm ở trang Quan trắc."
            />
            <div className="mt-10">
              <Suspense fallback={<NetworkFallback />}>
                <NetworkChapter />
              </Suspense>
            </div>
          </Reveal>

          {/* 04 — Real positions.
              The heading stays in normal flow so it lands on the same left
              edge as every other section; only the map takes the spatial
              breakout. `full-bleed` and `Reveal` must stay on separate
              elements — both drive `transform`, and the reveal's `none` end
              state would cancel full-bleed's translateX(-50%) centering. */}
          <Reveal as="section">
            <ChapterHeading
              eyebrow="04 · Không gian"
              title="Ba điểm đo trên một cù lao."
              lead="Toạ độ khảo sát thật của từng trạm, hiển thị đúng trạng thái dữ liệu hiện tại."
            />
            <div className="full-bleed mt-10">
              <div className="h-spatial">
                <Suspense fallback={<MapFallback />}>
                  <MapChapter />
                </Suspense>
              </div>
            </div>
          </Reveal>

          {/* 05 — What the system observes.
              This was a full hardware chapter: three image/text splits with a
              definition list of every part. That is a good field note and a
              bad homepage section — it tripled the page's length in the
              middle, and a reader who wanted the project's story had to
              scroll through a parts list to reach the rest of it. The detail
              moved to /posts/phan-cung-cua-mot-tram-do intact; what stays is
              the claim, the honest caveat, and one way in. */}
          <Reveal stagger as="section">
            <ChapterHeading
              eyebrow="05 · Thiết bị"
              title="Thiết bị được chọn theo câu hỏi cần trả lời."
              lead="Đây là thiết kế của hệ thống. Phần cứng chưa được lắp đặt ngoài thực địa — các sơ đồ là hình minh họa kỹ thuật, không phải ảnh chụp thiết bị."
            />
            <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
              {HARDWARE_GROUPS.map((group) => (
                <div key={group.domain} className="space-y-4 bg-background p-6 md:p-7">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-lg font-semibold tracking-tight">{group.domain}</h3>
                    <span className="text-[11px] uppercase tracking-[0.14em] text-muted [font-family:var(--font-data)]">
                      {group.station}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {group.parts.map(({ part }) => (
                      <li key={part} className="text-sm text-muted [font-family:var(--font-data)]">
                        {part}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm leading-relaxed text-muted">
              Đầu dò độ mặn đã có trên trạm nhưng{" "}
              <span className="text-watch">firmware chưa đọc được giá trị từ nó</span> — phần dang dở lớn nhất của hệ
              thống hiện nay.{" "}
              <Link
                href="/posts/phan-cung-cua-mot-tram-do"
                className="text-accent underline-offset-2 hover:underline"
              >
                Vì sao chọn từng thiết bị →
              </Link>
            </p>
          </Reveal>

          {/* 06 — How a reading becomes information */}
          <Reveal stagger as="section">
            <ChapterHeading eyebrow="06 · Dòng dữ liệu" title="Từ một đầu dò đến một dòng trên màn hình." />
            <div className="mt-10">
              <WorkflowChapter />
            </div>
          </Reveal>

          {/* 07 — What a number does and does not mean */}
          <Reveal stagger as="section" className="mx-auto max-w-[var(--width-reading)]">
            <ChapterHeading eyebrow="07 · Ý nghĩa" title="Một con số chưa phải là một kết luận." />
            <Prose>
              <p>
                Độ mặn 1,2‰ có thể là bình thường với cây này và đáng lo với cây khác. Cùng một giá trị, đọc ở hai thời
                điểm khác nhau trong con nước, cũng mang ý nghĩa khác nhau.
              </p>
              <p>
                Vì vậy mọi giá trị trong HORIZON đi kèm nguồn gốc của nó: đây là số đo trực tiếp, số liệu cũ, ngưỡng
                tham chiếu, hay dữ liệu minh họa. Người đọc cần phân biệt được “hệ thống đo và thấy ổn” với “hệ thống
                chưa đo được”.
              </p>
            </Prose>
          </Reveal>

          {/* 08 — Visual material */}
          <Reveal as="section">
            <ChapterHeading
              eyebrow="08 · Thư viện"
              title="Hình ảnh dự án."
              lead="Hiện tại thư viện gồm sơ đồ kỹ thuật và hình minh họa do dự án tự dựng. Chưa có ảnh thực địa, và không hình nào ở đây được trình bày như ảnh tư liệu hiện trường."
            />
            <div className="full-bleed mt-10">
              <div className="h-spatial">
                <GalleryStrip items={gallery} />
              </div>
            </div>
          </Reveal>

          {/* 09 — Field notes */}
          <Reveal stagger as="section" id="ghi-chep" className="scroll-mt-28">
            <ChapterHeading
              eyebrow="09 · Ghi chép"
              title="Ghi chép trong quá trình xây dựng."
              lead="Các bài viết về thiết kế, phương pháp và những giả định dự án đang kiểm chứng."
            />
            <div className="mt-10">
              <FieldNotesCarousel posts={posts} />
            </div>
          </Reveal>

          {/* 10 — Who */}
          <Reveal stagger as="section" className="mx-auto max-w-[var(--width-reading)]">
            <ChapterHeading eyebrow="10 · Dự án" title="Ai đang xây dựng HORIZON." />
            <Prose>
              <p>
                HORIZON được phát triển bởi Frogsleap Vietnam như một dự án thí điểm do người trẻ dẫn dắt, kết hợp giữa
                kỹ thuật và quan tâm tới môi trường địa phương.
              </p>
              <p>
                Dự án không cố chứng minh một kết luận về môi trường. Nó đang thử xây một cách nhìn: đủ nhỏ để đặt đúng
                chỗ, đủ rõ ràng để người không chuyên vẫn đọc được, và đủ trung thực để biết mình còn thiếu gì.
              </p>
            </Prose>
          </Reveal>

          {/* 11 — Contact.
              CONTACT AND REPORT ARE DIFFERENT THINGS, and this section exists
              because they were being conflated. A report is an environmental
              observation that becomes a durable row in Supabase; a contact is
              a person wanting to reach the team. Sending everyone to the
              report form asked the second group to file the first kind of
              thing.

              Left states the report channel and links to it. Right is a real
              contact form — which composes a mailto rather than posting,
              because no email provider is configured and a form that says
              "sent" without sending is the one thing this product must never
              do. See components/home/contact-form.tsx. */}
          <Reveal stagger as="section" id="lien-he" className="scroll-mt-28">
            <ChapterHeading eyebrow={`11 · ${dict.contact.eyebrow}`} title={dict.contact.title} />
            <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-[0.85fr_1.15fr]">
              <div className="flex flex-col gap-4 bg-background p-8 md:p-10">
                <div className="flex items-center gap-2 text-foreground-muted">
                  <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                    {dict.contact.reportEyebrow}
                  </span>
                </div>
                <h3 className="text-xl font-semibold tracking-tight">{dict.contact.reportTitle}</h3>
                <p className="text-sm leading-relaxed text-muted">{dict.contact.reportLead}</p>
                <Link
                  href="/report"
                  className="mt-auto inline-flex items-center gap-2 pt-4 text-sm font-medium text-accent underline-offset-4 hover:underline"
                >
                  {dict.monitoring.sendReport}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>

              <div className="space-y-5 bg-background p-8 md:p-10">
                <div className="flex items-center gap-2 text-foreground-muted">
                  <Mail className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                    {dict.contact.eyebrow}
                  </span>
                </div>
                <p className="max-w-xl text-sm leading-relaxed text-muted">{dict.contact.lead}</p>
                {CONTACT_EMAIL ? (
                  <ContactForm address={CONTACT_EMAIL} />
                ) : (
                  <p className="text-sm leading-relaxed text-muted">{dict.contact.noAddress}</p>
                )}
              </div>
            </div>
          </Reveal>

          {/* 12 — The operator side.
              Not a login form and not a second admin entry point — Admin is
              already a primary nav tab. This exists because a reader who has
              just been told the project publishes everything openly should
              also be told that someone operates it, and where that happens.
              Deliberately the quietest section on the page. */}
          <Reveal stagger as="section">
            <div className="flex flex-col gap-6 border-t border-border pt-8 md:flex-row md:items-center md:justify-between md:gap-12">
              <div className="max-w-2xl space-y-2">
                <div className="flex items-center gap-2 text-foreground-subtle">
                  <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                    {dict.operator.eyebrow}
                  </span>
                </div>
                <h3 className="text-lg font-semibold tracking-tight">{dict.operator.title}</h3>
                <p className="text-sm leading-relaxed text-muted">{dict.operator.lead}</p>
              </div>
              <Link
                href="/admin"
                className="inline-flex shrink-0 items-center gap-2 rounded-sm border border-border px-4 py-2.5 text-sm font-medium text-foreground-muted transition-colors duration-[var(--motion-base)] hover:bg-wash-hover hover:text-foreground"
              >
                {dict.operator.cta}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </Reveal>

          {/* 12 — Where to go next */}
          <Reveal stagger as="section" className="pb-8">
            <ChapterHeading eyebrow="13 · Tiếp tục" title="Đi sâu hơn." className="mb-10" />
            <ExploreChapter />
          </Reveal>
        </div>
      </div>
    </PublicShell>
  );
}
