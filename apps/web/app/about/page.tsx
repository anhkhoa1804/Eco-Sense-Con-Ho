import Link from "next/link";
import { Suspense } from "react";
import { Send, Sprout, Waves } from "lucide-react";
import { MapStation, StationNetworkMap } from "@/components/dashboard/station-network-map";
import { PublicShell } from "@/components/layout/public-shell";
import { ObservatoryAct, ObservatoryShell } from "@/components/observatory/observatory-shell";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { RiverLine } from "@/components/ui/river-line";
import { Skeleton } from "@/components/ui/skeleton";
import { freshnessStatus } from "@/components/ui/status-indicator";
import { getPublicRepositories } from "@/lib/publicRead";
import { filterSnapshotsToPilotStations, PILOT_STATION_IDS } from "@/lib/publicStations";
import { stationProfiles, type StationKind } from "@/lib/stationProfile";

const KIND_ICON: Record<StationKind, typeof Waves> = {
  water: Waves,
  soil: Sprout,
  gateway: Send,
};

/** Real dimensions printed on public/images/con-ho-station-map.png — the same illustrative asset, not re-measured or invented here. */
const ISLAND_STATS = [
  { label: "Chiều dài", value: "~1.000 m" },
  { label: "Chiều ngang", value: "~300 m" },
  { label: "Diện tích", value: "~18–20 ha" },
];

async function StationsMap() {
  const context = getPublicRepositories();
  if (!context) return <StationNetworkMap stations={[]} variant="preview" />;

  try {
    const snapshots = await context.repos.readings.getSnapshots(context.scope);
    const pilotSnapshots = filterSnapshotsToPilotStations(snapshots);
    const mapStations: MapStation[] = pilotSnapshots.map((snapshot) => ({
      id: snapshot.station.id,
      name: stationProfiles[snapshot.station.id]?.name ?? snapshot.station.name,
      lat: snapshot.station.lat,
      lng: snapshot.station.lng,
      freshness: freshnessStatus(snapshot.reading?.timestamp ?? snapshot.health?.timestamp ?? null),
    }));
    return <StationNetworkMap stations={mapStations} variant="preview" />;
  } catch {
    return <StationNetworkMap stations={[]} variant="preview" />;
  }
}

function StationsMapFallback() {
  return <Skeleton className="h-[260px] w-full rounded-lg" />;
}

export default function AboutPage() {
  return (
    <PublicShell activePath="/about">
      <div className="full-bleed">
        <ObservatoryShell register="story">
          {/* 01 — Nơi chốn */}
          <ObservatoryAct id="place" eyebrow="01 · Nơi chốn" width="content">
            <div className="animate-entrance max-w-2xl space-y-6">
              <h1 className="text-display font-semibold tracking-tight md:text-6xl">
                Cồn Hô, một cù lao nông nghiệp giữa sông ở Vĩnh Long.
              </h1>
              <p className="text-lg leading-relaxed text-muted">
                Horizon là nền tảng quan trắc môi trường quy mô thí điểm, đặt tại Cồn Hô — một cộng đồng nông nghiệp
                trên cù lao thuộc tỉnh Vĩnh Long. Ba thiết bị thực địa đo mực nước, độ mặn và tình trạng đất; một
                gateway tổng hợp và chuyển tiếp dữ liệu đó về hệ thống.
              </p>
            </div>
          </ObservatoryAct>

          <ObservatoryAct width="full-bleed">
            <figure className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- plain <img>: local static asset, known aspect ratio; next/image has previously failed to resolve in this project (see wordmark.tsx) */}
              <img
                src="/images/con-ho-station-map.png"
                alt="Bản đồ minh họa vị trí ba điểm quan trắc trên Cồn Hô: Trạm 1 gần sông, Trạm 2 giữa cồn, Gateway cuối cồn"
                width={1614}
                height={974}
                className="w-full rounded-lg border border-border"
              />
              <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 text-sm text-muted">
                <span>Bản đồ minh họa, không phải ảnh vệ tinh — thể hiện vị trí tương đối của ba điểm quan trắc.</span>
                <span className="flex flex-wrap gap-x-4">
                  {ISLAND_STATS.map((stat) => (
                    <span key={stat.label}>
                      {stat.label} {stat.value}
                    </span>
                  ))}
                </span>
              </figcaption>
            </figure>
          </ObservatoryAct>

          {/* 02 — Dòng sông */}
          <ObservatoryAct id="river" eyebrow="02 · Dòng sông" width="reading">
            <p className="text-h2 leading-relaxed">
              Cồn Hô nằm giữa hai nhánh sông — nơi mực nước và độ mặn thay đổi theo con nước lên xuống. Horizon quan
              trắc đúng tại nơi sự thay đổi đó xảy ra, thay vì suy đoán từ xa.
            </p>
          </ObservatoryAct>

          <RiverLine className="mx-auto max-w-[var(--width-content-wide)] px-4" />

          {/* 03 — Con người */}
          <ObservatoryAct id="people" eyebrow="03 · Con người" width="reading">
            <p className="text-base leading-relaxed text-muted">
              Cồn Hô là một cộng đồng nông nghiệp. Horizon được xây dựng để nhiều người cùng nhìn vào một nguồn dữ
              liệu: người dân theo dõi điều kiện gần nơi mình sống, nhà nghiên cứu theo dõi xu hướng theo thời gian,
              và bất kỳ ai quan tâm — kể cả người chỉ đang đứng tại một trạm — đều có thể xem trạng thái ngay lập tức,
              không cần đăng nhập hay kiến thức kỹ thuật.
            </p>
          </ObservatoryAct>

          {/* 04 — Ba điểm quan trắc */}
          <ObservatoryAct
            id="stations"
            eyebrow="04 · Ba điểm quan trắc"
            title="Hai cảm biến, một gateway, cùng một câu chuyện."
            width="content"
          >
            <p className="max-w-2xl text-base leading-relaxed text-muted">
              Trạm 1 đo nước, Trạm 2 đo đất, Gateway tổng hợp và chuyển tiếp dữ liệu đó về hệ thống qua tín hiệu đã
              được xác thực.
            </p>
            <div className="grid gap-x-8 gap-y-12 sm:grid-cols-3">
              {PILOT_STATION_IDS.map((id, index) => {
                const profile = stationProfiles[id];
                const Icon = KIND_ICON[profile.kind];
                return (
                  <Link
                    key={id}
                    href={`/s/${id}`}
                    className="block space-y-4 border-t border-border/60 pt-6 transition-opacity duration-[var(--motion-base)] hover:opacity-70"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-eyebrow text-accent">{`0${index + 1}`}</span>
                      <IconTile>
                        <Icon className="h-5 w-5" aria-hidden />
                      </IconTile>
                    </div>
                    <div>
                      <p className="text-xl font-semibold tracking-tight">{profile.name}</p>
                      <p className="mt-1 text-sm text-muted">{profile.location}</p>
                      <p className="mt-2 text-sm leading-relaxed text-muted">{profile.intro}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
            <Suspense fallback={<StationsMapFallback />}>
              <StationsMap />
            </Suspense>
          </ObservatoryAct>

          {/* 05 — Vì sao điều này quan trọng */}
          <ObservatoryAct id="why" eyebrow="05 · Vì sao điều này quan trọng" width="reading">
            <div className="space-y-6">
              <h2 className="text-h1 font-semibold tracking-tight">
                Cồn Hô được kể bằng dữ liệu, không phải bằng tài liệu kỹ thuật.
              </h2>
              <p className="text-base leading-relaxed text-muted">
                Báo cáo hiện trường bổ sung ngữ cảnh; trạm và biểu đồ giúp kiểm chứng những gì đang thực sự diễn ra
                trên cồn.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/dashboard">Xem dữ liệu quan trắc</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/report">Gửi báo cáo hiện trường</Link>
                </Button>
              </div>
            </div>
          </ObservatoryAct>
        </ObservatoryShell>
      </div>
    </PublicShell>
  );
}
