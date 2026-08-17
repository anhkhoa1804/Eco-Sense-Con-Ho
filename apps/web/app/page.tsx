import Link from "next/link";
import { cache, Suspense } from "react";
import { ArrowRight, Send, Sprout, Waves } from "lucide-react";
import { MapStation, StationNetworkMap } from "@/components/dashboard/station-network-map";
import { PublicShell } from "@/components/layout/public-shell";
import { ObservatoryAct, ObservatoryShell } from "@/components/observatory/observatory-shell";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { MeasurementValue } from "@/components/ui/measurement-value";
import { RiverLine } from "@/components/ui/river-line";
import { Skeleton } from "@/components/ui/skeleton";
import { freshnessStatus, relativeTimeVi, StatusIndicator, type FreshnessState } from "@/components/ui/status-indicator";
import { getPublicRepositories } from "@/lib/publicRead";
import { filterSnapshotsToPilotStations, PILOT_STATION_IDS, type PilotStationId } from "@/lib/publicStations";
import { formatSoilEc, formatWaterValue, stationProfiles, type StationKind } from "@/lib/stationProfile";
import type { SoilReading, StationReadingSnapshot } from "@/types";

export const revalidate = 60;

const KIND_ICON: Record<StationKind, typeof Waves> = {
  water: Waves,
  soil: Sprout,
  gateway: Send,
};

interface ObservatoryData {
  /** Already filtered to the curated 3-station pilot allowlist — never the raw 5-row DB response. */
  snapshots: StationReadingSnapshot[];
  soilReading: SoilReading | null;
}

/**
 * Single fetch, shared by both the hero (status rows + map) and the
 * telemetry act further down the page. Wrapped in React's cache() so the
 * two independent <Suspense> consumers don't double-query Supabase for the
 * same request — same underlying repository calls station-detail.tsx
 * already uses, just composed once per page render.
 */
const getObservatoryData = cache(async (): Promise<ObservatoryData | null> => {
  const context = getPublicRepositories();
  if (!context) return null;

  try {
    const { repos, scope } = context;
    const allSnapshots = await repos.readings.getSnapshots(scope);
    const [soilReading] = await Promise.all([repos.readings.getLatestSoilReadingByStation("STATION_02", scope)]);
    return { snapshots: filterSnapshotsToPilotStations(allSnapshots), soilReading };
  } catch {
    return null;
  }
});

/**
 * STATION_02 has no environmental_readings row — its real timestamp lives
 * on soil_readings instead. Kept kind-aware so soil freshness is never
 * silently read as "unavailable" just because the water-shaped fields are
 * empty.
 */
function latestTimestampFor(stationId: PilotStationId, data: ObservatoryData | null): string | null {
  if (stationProfiles[stationId].kind === "soil") {
    return data?.soilReading?.timestamp ?? null;
  }
  const snapshot = data?.snapshots.find((s) => s.station.id === stationId);
  return snapshot?.reading?.timestamp ?? snapshot?.health?.timestamp ?? null;
}

function freshnessCaption(timestamp: string | null): string | undefined {
  return timestamp ? `Cập nhật ${relativeTimeVi(timestamp)}` : undefined;
}

function StationStatusRow({ stationId, timestamp }: { stationId: PilotStationId; timestamp: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-sm font-medium">{stationProfiles[stationId].name}</span>
      <StatusIndicator status={freshnessStatus(timestamp)} compact />
    </div>
  );
}

/** Act 01 — OBSERVE. Real network state, never an aggregate "X/X LIVE" headline number. */
async function ObservatoryPulse() {
  const data = await getObservatoryData();

  const mapStations: MapStation[] = (data?.snapshots ?? []).map((snapshot) => ({
    id: snapshot.station.id,
    name: stationProfiles[snapshot.station.id]?.name ?? snapshot.station.name,
    lat: snapshot.station.lat,
    lng: snapshot.station.lng,
    freshness: freshnessStatus(latestTimestampFor(snapshot.station.id as PilotStationId, data)),
  }));

  return (
    <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
      <div className="animate-entrance space-y-6">
        <h1 className="max-w-xl text-display font-semibold tracking-tight md:text-6xl">
          Một hòn cồn, nhìn qua dữ liệu thật.
        </h1>
        <p className="max-w-lg text-lg leading-relaxed text-muted">
          Horizon ghi lại mực nước, độ mặn và tình trạng đất quanh Cồn Hô qua ba điểm quan trắc, cập nhật mỗi khi có
          dữ liệu mới.
        </p>
        <div className="divide-y divide-border/40 border-y border-border/40">
          {PILOT_STATION_IDS.map((id) => (
            <StationStatusRow key={id} stationId={id} timestamp={latestTimestampFor(id, data)} />
          ))}
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
      </div>

      <StationNetworkMap stations={mapStations} variant="full" />
    </div>
  );
}

function ObservatoryPulseFallback() {
  return (
    <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
      <div className="space-y-6">
        <Skeleton className="h-28 w-full max-w-xl" />
        <Skeleton className="h-16 w-full max-w-lg" />
        <Skeleton className="h-32 w-full" />
        <div className="flex gap-3">
          <Skeleton className="h-12 w-44 rounded-xl" />
          <Skeleton className="h-12 w-44 rounded-xl" />
        </div>
      </div>
      <Skeleton className="h-[340px] w-full rounded-lg" />
    </div>
  );
}

/** Act 02 — UNDERSTAND THE NETWORK. Verified metadata only; no invented geography. */
function NetworkNode({ stationId, index }: { stationId: PilotStationId; index: number }) {
  const profile = stationProfiles[stationId];
  const Icon = KIND_ICON[profile.kind];

  return (
    <Link
      href={`/s/${stationId}`}
      className="block space-y-4 border-t border-border/60 pt-6 transition-opacity duration-[var(--motion-base)] hover:opacity-70"
    >
      <div className="flex items-center justify-between">
        <span className="text-eyebrow text-accent">{`0${index}`}</span>
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
}

/** Act 03 — SEE THE SIGNAL. Domain-appropriate blocks, never a uniform metric grid. */
function TelemetryBlock({
  stationId,
  label,
  value,
  unit,
  freshness,
  freshnessDetail,
  emptyMessage,
  caption,
}: {
  stationId: PilotStationId;
  label: string;
  value: string | null;
  unit?: string;
  freshness: FreshnessState;
  freshnessDetail?: string;
  emptyMessage?: string;
  caption?: string;
}) {
  return (
    <div className="space-y-4 border-t border-border/60 pt-6">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">{stationProfiles[stationId].name}</p>
      <MeasurementValue
        label={label}
        value={value}
        unit={unit}
        freshness={freshness}
        freshnessDetail={freshnessDetail}
        emptyMessage={emptyMessage}
        size="lg"
      />
      {value !== null && caption ? <p className="text-sm text-muted">{caption}</p> : null}
      <Link
        href={`/s/${stationId}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
      >
        Xem trạm này
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}

async function ObservatorySignal() {
  const data = await getObservatoryData();

  return (
    <div className="grid gap-x-8 gap-y-12 sm:grid-cols-3">
      {PILOT_STATION_IDS.map((id) => {
        const profile = stationProfiles[id];
        const snapshot = data?.snapshots.find((s) => s.station.id === id);
        const timestamp = latestTimestampFor(id, data);
        const freshness = freshnessStatus(timestamp);
        const freshnessDetail = freshnessCaption(timestamp);

        if (profile.kind === "soil") {
          const moisture = data?.soilReading?.soil_moisture_pct ?? null;
          return (
            <TelemetryBlock
              key={id}
              stationId={id}
              label="Độ ẩm đất"
              value={moisture !== null ? moisture.toFixed(1) : null}
              unit="%"
              freshness={freshness}
              freshnessDetail={freshnessDetail}
              caption={`EC đất: ${formatSoilEc(data?.soilReading?.soil_ec_ms_cm ?? null)}`}
            />
          );
        }

        if (profile.kind === "gateway") {
          const signal = snapshot?.health?.signal_strength_dbm ?? null;
          return (
            <TelemetryBlock
              key={id}
              stationId={id}
              label="Tín hiệu gateway"
              value={signal !== null ? String(signal) : null}
              unit="dBm"
              freshness={freshness}
              freshnessDetail={freshnessDetail}
              emptyMessage="Gateway chưa báo cáo tín hiệu kết nối của chính nó."
            />
          );
        }

        const salinity = snapshot?.reading?.salinity ?? null;
        return (
          <TelemetryBlock
            key={id}
            stationId={id}
            label="Độ mặn"
            value={salinity !== null ? salinity.toFixed(2) : null}
            unit="‰"
            freshness={freshness}
            freshnessDetail={freshnessDetail}
            caption={`Mực nước: ${formatWaterValue(snapshot?.reading?.water_level ?? null)}`}
          />
        );
      })}
    </div>
  );
}

function ObservatorySignalFallback() {
  return (
    <div className="grid gap-x-8 gap-y-12 sm:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-4 border-t border-border/60 pt-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-16 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <PublicShell activePath="/">
      <div className="full-bleed">
        <ObservatoryShell register="story">
          <ObservatoryAct id="observatory" eyebrow="01 · Cồn Hô, Vĩnh Long" width="full-bleed">
            <Suspense fallback={<ObservatoryPulseFallback />}>
              <ObservatoryPulse />
            </Suspense>
            <RiverLine className="mt-16" />
          </ObservatoryAct>

          <ObservatoryAct
            id="network"
            eyebrow="02 · Mạng lưới quan trắc"
            title="Hai trạm đo, một gateway đưa dữ liệu về."
            width="content"
          >
            <p className="max-w-2xl text-base leading-relaxed text-muted">
              Trạm 1 và Trạm 2 ghi nhận dữ liệu tại chỗ quanh Cồn Hô; Gateway tổng hợp và chuyển tiếp thông tin đó về
              hệ thống.
            </p>
            <div className="grid gap-x-8 gap-y-12 sm:grid-cols-3">
              {PILOT_STATION_IDS.map((id, index) => (
                <NetworkNode key={id} stationId={id} index={index + 1} />
              ))}
            </div>
          </ObservatoryAct>

          <ObservatoryAct
            id="signal"
            eyebrow="03 · Tín hiệu thật"
            title="Chỉ số mới nhất từ từng trạm."
            width="content"
          >
            <p className="max-w-2xl text-base leading-relaxed text-muted">
              Mỗi trạm đo một loại dữ liệu khác nhau — số liệu hiển thị đúng như hệ thống ghi nhận, kể cả khi trạm
              chưa có dữ liệu.
            </p>
            <Suspense fallback={<ObservatorySignalFallback />}>
              <ObservatorySignal />
            </Suspense>
          </ObservatoryAct>

          <ObservatoryAct id="deeper" width="full-bleed">
            <div className="relative">
              <div
                aria-hidden
                className="absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 bg-[linear-gradient(180deg,rgba(14,95,138,0.05)_0%,rgba(47,168,92,0.06)_100%)]"
              />
              <div className="relative space-y-6 border-t border-border/60 py-20 text-center">
                <p className="text-eyebrow uppercase tracking-[0.18em] text-accent">04 · Đi sâu hơn</p>
                <h2 className="mx-auto max-w-2xl text-h1 font-semibold tracking-tight md:text-5xl">
                  Đi sâu hơn vào từng trạm quan trắc.
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
            </div>
          </ObservatoryAct>
        </ObservatoryShell>
      </div>
    </PublicShell>
  );
}
