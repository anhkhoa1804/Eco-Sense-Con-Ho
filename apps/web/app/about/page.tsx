import Link from "next/link";
import { ArrowRight, ClipboardList, Home, LayoutDashboard, Send, Sprout, Waves } from "lucide-react";
import { FieldNotesList } from "@/components/about/field-notes-list";
import { GalleryStrip } from "@/components/about/gallery-strip";
import { PublicShell } from "@/components/layout/public-shell";
import { Reveal } from "@/components/ui/reveal";
import { getGalleryItems } from "@/lib/content/gallery";
import { getRecentPosts } from "@/lib/content/posts";
import { PILOT_STATION_IDS } from "@/lib/publicStations";
import { stationProfiles, type StationKind } from "@/lib/stationProfile";

export const revalidate = 3600;

const KIND_ICON: Record<StationKind, typeof Waves> = { water: Waves, soil: Sprout, gateway: Send };

/** Printed on public/images/con-ho-station-map.png — read off the asset, not estimated here. */
const ISLAND_STATS = [
  { label: "Chiều dài", value: "~1.000 m" },
  { label: "Chiều ngang", value: "~300 m" },
  { label: "Diện tích", value: "~18–20 ha" },
];

/**
 * Sensor models and roles come from docs/SENSOR_CAPABILITY_MATRIX.md, which
 * traces each metric from physical sensor → firmware → wire contract → DB
 * column → repository → UI. `note` records the honest current state where a
 * link in that chain is not yet closed — nothing here implies a working
 * deployment.
 */
const HARDWARE_GROUPS = [
  {
    domain: "Nước",
    station: "Trạm 1",
    image: "/images/hardware/station-water-placeholder.svg",
    parts: [
      {
        part: "A02YYUW",
        role: "Cảm biến siêu âm đo khoảng cách tới mặt nước, từ đó suy ra mực nước.",
        note: null,
      },
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
    image: "/images/hardware/station-soil-placeholder.svg",
    parts: [
      {
        part: "ES-SM-THEC-01",
        role: "Đầu dò cắm trong đất, đo cùng lúc độ ẩm, độ dẫn điện và nhiệt độ của đất.",
        note: null,
      },
      { part: "ES-PH-SOIL-01", role: "Đầu dò đo độ pH của đất.", note: null },
      { part: "SHT30", role: "Cảm biến nhiệt độ và độ ẩm không khí ngay tại vườn.", note: null },
    ],
  },
  {
    domain: "Truyền dữ liệu",
    station: "Gateway",
    image: "/images/hardware/gateway-placeholder.svg",
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
      {
        part: "ESP32",
        role: "Vi điều khiển chạy trên cả ba thiết bị, đọc cảm biến và quản lý chu kỳ gửi dữ liệu.",
        note: null,
      },
    ],
  },
] as const;

const DATA_FLOW = [
  { step: "Đo", text: "Cảm biến tại trạm đọc giá trị theo chu kỳ, kèm trạng thái của chính cảm biến đó." },
  { step: "Truyền", text: "Trạm gửi số liệu thô qua LoRa về gateway — thiết bị duy nhất cần internet." },
  { step: "Lưu", text: "Gateway ký xác thực rồi gửi lên hệ thống; dữ liệu không hợp lệ bị từ chối thay vì lưu tạm." },
  { step: "Diễn giải", text: "Mỗi giá trị được gắn thời điểm đo, tình trạng thiết bị và nguồn gốc của nó." },
  { step: "Trình bày", text: "Kết quả hiển thị công khai, kể cả khi trạng thái đúng là “chưa có dữ liệu”." },
] as const;

const EXPLORE = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Quan trắc", text: "Xem mạng lưới và dữ liệu hiện có." },
  { href: "/report", icon: ClipboardList, label: "Báo cáo", text: "Gửi một quan sát từ hiện trường." },
  { href: "/", icon: Home, label: "Trang chủ", text: "Quay lại câu chuyện HORIZON." },
] as const;

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

export default function AboutPage() {
  const posts = getRecentPosts(5);
  const gallery = getGalleryItems();

  return (
    <PublicShell activePath="/about">
      {/* Hero — documentary, not the homepage's atmospheric composition. */}
      <section className="py-10 md:py-16">
        <div className="mx-auto max-w-[var(--width-content-wide)]">
          <div className="animate-entrance max-w-3xl space-y-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">Giới thiệu</p>
            <h1 className="text-[length:var(--text-title-editorial)] font-semibold leading-[1.12] tracking-tight">
              HORIZON là một mạng lưới quan trắc môi trường được thiết kế cho một pilot cộng đồng tại Cồn Hô.
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-muted">
              Trang này giải thích dự án đang xây dựng cái gì, vì sao, hệ thống hoạt động ra sao, và phần nào vẫn còn
              đang dang dở.
            </p>
            <dl className="flex flex-wrap gap-x-8 gap-y-3 pt-2 text-sm">
              {[
                { k: "Địa điểm", v: "Cồn Hô, Vĩnh Long" },
                { k: "Quy mô", v: "3 điểm quan trắc" },
                { k: "Giai đoạn", v: "Pilot — chưa triển khai thực địa" },
              ].map(({ k, v }) => (
                <div key={k}>
                  <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">{k}</dt>
                  <dd className="mt-1 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <div className="space-y-28 md:space-y-36">
        {/* 01 — Cồn Hô */}
        <Reveal stagger as="section" className="mx-auto max-w-[var(--width-reading)]">
          <ChapterHeading eyebrow="01 · Nơi chốn" title="Một cù lao nông nghiệp giữa sông." />
          <div className="mt-8 space-y-6 text-lg leading-relaxed text-muted">
            <p>
              Cồn Hô là một cù lao thuộc tỉnh Vĩnh Long, nằm giữa các nhánh sông ở đồng bằng sông Cửu Long. Đây là một
              dải đất hẹp — dài khoảng một cây số và rộng chừng ba trăm mét — nên gần như mọi điểm trên cồn đều cách
              mặt nước không xa.
            </p>
            <p>
              Chính hình dạng đó khiến nơi này đáng để quan trắc ở quy mô nhỏ. Trên một dải đất hẹp bao quanh bởi nước,
              điều kiện ở mép sông và ở giữa cồn không nhất thiết giống nhau, và cả hai đều thay đổi theo con nước.
            </p>
          </div>
        </Reveal>

        <section className="full-bleed">
          <Reveal className="h-spatial">
            <figure className="space-y-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- local static asset with known aspect ratio; next/image has previously failed to resolve in this project (see wordmark.tsx) */}
              <img
                src="/images/con-ho-station-map.png"
                alt="Bản đồ minh họa vị trí ba điểm quan trắc trên Cồn Hô: Trạm 1 gần sông, Trạm 2 giữa cồn, Gateway cuối cồn"
                width={1614}
                height={974}
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

        {/* 02 — Why observe */}
        <Reveal stagger as="section" className="mx-auto max-w-[var(--width-reading)]">
          <ChapterHeading eyebrow="02 · Vì sao quan trắc" title="Dữ liệu quy mô vùng không trả lời được câu hỏi tại chỗ." />
          <div className="mt-8 space-y-6 text-lg leading-relaxed text-muted">
            <p>
              Một bản tin cho cả tỉnh có thể nói hôm nay mặn hay không mặn. Nó không nói được nước ngay ngoài bờ vườn
              nhà mình lúc này thế nào, hay khác gì so với hôm qua.
            </p>
            <p>
              Khoảng cách giữa hai câu hỏi đó là lý do HORIZON tồn tại. Một mạng lưới nhỏ, đặt đúng nơi cần biết, có
              thể ghi lại những thay đổi mà dữ liệu quy mô lớn làm mịn đi mất.
            </p>
            <p>
              Nhưng đo được không đồng nghĩa với hiểu được. Một con số không tự nó thành một quyết định canh tác. Vì
              vậy dự án đặt trọng tâm ngang nhau vào hai việc: đo cho đúng, và trình bày sao cho người đọc biết mình
              đang nhìn thứ gì.
            </p>
          </div>
        </Reveal>

        {/* 03 — The network */}
        <Reveal stagger as="section" className="mx-auto max-w-[var(--width-content-wide)]">
          <ChapterHeading
            eyebrow="03 · Mạng lưới"
            title="Ba vai trò, không phải ba bản sao."
            lead="Mỗi điểm được thiết kế cho một nhiệm vụ khác nhau, thay vì đặt cùng một bộ cảm biến ở cả ba nơi."
          />
          <div className="mt-10 divide-y divide-border/60 border-y border-border/60">
            {PILOT_STATION_IDS.map((id, index) => {
              const profile = stationProfiles[id];
              const Icon = KIND_ICON[profile.kind];
              return (
                <Link
                  key={id}
                  href={`/s/${id}`}
                  className="group flex flex-col gap-4 py-7 transition-colors duration-[var(--motion-base)] hover:bg-muted/20 md:flex-row md:items-baseline md:gap-10 md:py-9"
                >
                  <div className="flex shrink-0 items-center gap-4 md:w-56">
                    <span className="text-[11px] tracking-[0.16em] text-muted [font-family:var(--font-data)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <Icon className="h-5 w-5 text-accent" aria-hidden />
                    <span className="text-xs uppercase tracking-[0.12em] text-muted [font-family:var(--font-data)]">
                      {id}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <h3 className="text-xl font-semibold tracking-tight md:text-2xl">{profile.name}</h3>
                    <p className="text-sm text-muted">{profile.location}</p>
                    <p className="max-w-2xl text-sm leading-relaxed text-muted">{profile.intro}</p>
                  </div>
                  <ArrowRight
                    className="hidden h-5 w-5 shrink-0 text-muted transition-transform duration-[var(--motion-base)] group-hover:translate-x-1 group-hover:text-accent md:block"
                    aria-hidden
                  />
                </Link>
              );
            })}
          </div>
        </Reveal>

        {/* 04 — Hardware */}
        <Reveal stagger as="section" className="mx-auto max-w-[var(--width-content-wide)]">
          <ChapterHeading
            eyebrow="04 · Phần cứng"
            title="Thiết bị được chọn theo câu hỏi cần trả lời."
            lead="Đây là thiết kế của hệ thống. Phần cứng chưa được lắp đặt ngoài thực địa — các sơ đồ dưới đây là hình minh họa kỹ thuật, không phải ảnh chụp thiết bị."
          />
          <div className="mt-12 space-y-16">
            {HARDWARE_GROUPS.map((group) => (
              <div key={group.domain} className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-12">
                <div className="overflow-hidden rounded-lg border border-border bg-muted/10">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local committed SVG diagram */}
                  <img src={group.image} alt={`Sơ đồ minh họa ${group.domain.toLowerCase()}`} className="w-full" />
                </div>
                <div className="space-y-6">
                  <div className="flex items-baseline gap-3">
                    <h3 className="text-2xl font-semibold tracking-tight">{group.domain}</h3>
                    <span className="text-xs uppercase tracking-[0.14em] text-muted [font-family:var(--font-data)]">
                      {group.station}
                    </span>
                  </div>
                  <dl className="divide-y divide-border/50 border-t border-border/50">
                    {group.parts.map(({ part, role, note }) => (
                      <div key={part} className="space-y-1.5 py-4">
                        <dt className="text-sm font-semibold [font-family:var(--font-data)]">{part}</dt>
                        <dd className="text-sm leading-relaxed text-muted">{role}</dd>
                        {note ? <dd className="text-sm leading-relaxed text-watch">{note}</dd> : null}
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* 05 — How data moves */}
        <Reveal stagger as="section" className="mx-auto max-w-[var(--width-content-wide)]">
          <ChapterHeading eyebrow="05 · Dòng dữ liệu" title="Từ một đầu dò đến một dòng trên màn hình." />
          <ol className="mt-10 grid gap-px overflow-hidden border-y border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
            {DATA_FLOW.map(({ step, text }, index) => (
              <li key={step} className="space-y-3 bg-background p-6">
                <span className="text-[11px] tracking-[0.16em] text-accent [font-family:var(--font-data)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="text-lg font-semibold tracking-tight">{step}</h3>
                <p className="text-sm leading-relaxed text-muted">{text}</p>
              </li>
            ))}
          </ol>
        </Reveal>

        {/* 06 — What the data can mean */}
        <Reveal stagger as="section" className="mx-auto max-w-[var(--width-reading)]">
          <ChapterHeading eyebrow="06 · Ý nghĩa" title="Một con số chưa phải là một kết luận." />
          <div className="mt-8 space-y-6 text-lg leading-relaxed text-muted">
            <p>
              Độ mặn 1,2‰ có thể là bình thường với cây này và đáng lo với cây khác. Cùng một giá trị, đọc ở hai thời
              điểm khác nhau trong con nước, cũng mang ý nghĩa khác nhau.
            </p>
            <p>
              Vì vậy mọi giá trị trong HORIZON đi kèm nguồn gốc của nó: đây là số đo trực tiếp, số liệu cũ, ngưỡng
              tham chiếu, hay dữ liệu minh họa. Người đọc cần phân biệt được “hệ thống đo và thấy ổn” với “hệ thống
              chưa đo được”.
            </p>
            <p>
              Các ngưỡng tham chiếu hiện có trong hệ thống đến từ ghi chú kỹ thuật nội bộ của dự án, chưa được đối
              chiếu với một nguồn khoa học độc lập. Giao diện nói rõ điều đó thay vì trình bày chúng như tiêu chuẩn
              đã được công nhận.
            </p>
          </div>
        </Reveal>

        {/* 07 — Gallery */}
        <section className="full-bleed">
          <Reveal className="h-spatial">
            <ChapterHeading
              eyebrow="07 · Thư viện"
              title="Hình ảnh dự án."
              lead="Hiện tại thư viện gồm sơ đồ kỹ thuật và hình minh họa do dự án tự dựng. Chưa có ảnh thực địa, và không hình nào ở đây được trình bày như ảnh tư liệu hiện trường."
            />
            <div className="mt-10">
              <GalleryStrip items={gallery} />
            </div>
          </Reveal>
        </section>

        {/* 08 — Field notes */}
        <Reveal as="section" id="ghi-chep" className="mx-auto max-w-[var(--width-content-wide)] scroll-mt-28">
          <ChapterHeading
            eyebrow="08 · Ghi chép"
            title="Ghi chép trong quá trình xây dựng."
            lead="Các bài viết về thiết kế, phương pháp và những giả định dự án đang kiểm chứng."
          />
          <div className="mt-10">
            <FieldNotesList posts={posts} />
          </div>
        </Reveal>

        {/* 09 — People */}
        <Reveal stagger as="section" className="mx-auto max-w-[var(--width-reading)]">
          <ChapterHeading eyebrow="09 · Dự án" title="Ai đang xây dựng HORIZON." />
          <div className="mt-8 space-y-6 text-lg leading-relaxed text-muted">
            <p>
              HORIZON được phát triển bởi Frogsleap Vietnam như một dự án thí điểm do người trẻ dẫn dắt, kết hợp giữa
              kỹ thuật và quan tâm tới môi trường địa phương.
            </p>
            <p>
              Đây là một dự án đang trong quá trình xây dựng. Phần nền tảng dữ liệu và giao diện đã hoạt động thật;
              phần thiết bị ngoài thực địa thì chưa. Trang này cố gắng nói rõ ranh giới đó ở mọi chỗ nó xuất hiện,
              thay vì trình bày một hệ thống hoàn chỉnh hơn thực tế.
            </p>
          </div>
        </Reveal>

        {/* 10 — Closing */}
        <Reveal stagger as="section" className="mx-auto max-w-[var(--width-reading)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">10 · Vì sao điều này quan trọng</p>
          <p className="mt-6 text-2xl font-semibold leading-snug tracking-tight md:text-3xl">
            Một vùng đất được hiểu rõ hơn khi những thay đổi của nó được ghi lại một cách trung thực — kể cả khi điều
            trung thực nhất lúc này là “chúng tôi chưa đo được”.
          </p>
          <p className="mt-6 text-base leading-relaxed text-muted">
            HORIZON không cố chứng minh một kết luận về môi trường. Nó đang thử xây một cách nhìn: đủ nhỏ để đặt đúng
            chỗ, đủ rõ ràng để người không chuyên vẫn đọc được, và đủ trung thực để biết mình còn thiếu gì.
          </p>
        </Reveal>

        {/* Final navigation */}
        <Reveal stagger as="section" className="mx-auto max-w-[var(--width-content-wide)] pb-8">
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
        </Reveal>
      </div>
    </PublicShell>
  );
}
