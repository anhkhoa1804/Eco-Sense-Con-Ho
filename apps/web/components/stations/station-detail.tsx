import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { MapStation, StationNetworkMap } from "@/components/dashboard/station-network-map";
import { ObservatoryAct, ObservatoryShell } from "@/components/observatory/observatory-shell";
import { MeasurementValue } from "@/components/ui/measurement-value";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { freshnessStatus, QualityIndicator, relativeTimeVi, StatusIndicator } from "@/components/ui/status-indicator";
import { getPublicRepositories } from "@/lib/publicRead";
import { isPilotStation } from "@/lib/publicStations";
import {
  chartDataFrom,
  formatCelsius,
  formatPercent,
  formatPh,
  formatSignal,
  formatSoilEc,
  formatVoltage,
  formatWaterValue,
  profileFor,
  qualityFor,
  sensorStatusLabel,
  stationProfiles,
  stationStatusLabel,
  type StationProfile,
} from "@/lib/stationProfile";
import type { EnvironmentalReading, SoilReading, Station, StationHealthLog, TrendPoint } from "@/types";
import { StationLiveChart } from "@/components/stations/station-live-chart";

/**
 * Static reference ranges — the exact numbers already shown on /dashboard's
 * "Tham chiếu tĩnh" table (daily-comparison-chart.tsx), not new invented
 * thresholds. Used only when `crop_thresholds` is unseeded (threshold ===
 * null), and always labeled as reference material — never presented as a
 * live risk assessment of this station's current reading. See
 * FRONTEND_REBUILD_SPECIFICATION.md R-3: seeding that table is a data
 * decision outside this rebuild's authority.
 */
const STATIC_REFERENCE_NOTE: Record<"water" | "soil", string> = {
  water: "Ngưỡng tham khảo cho vườn bưởi: dưới 1.2‰ là ổn định, 1.2–1.8‰ cần chú ý, trên 1.8‰ là nguy cơ cao. Hệ thống chưa cấu hình ngưỡng cảnh báo trực tiếp cho trạm này.",
  soil: "Ngưỡng tham khảo cho vườn bưởi: EC đất dưới 1.5 mS/cm và độ ẩm 45–65% là ổn định. Hệ thống chưa cấu hình ngưỡng cảnh báo trực tiếp cho trạm này.",
};

function IdentityColumn({ profile, station }: { profile: StationProfile; station: Station | null }) {
  const status = stationStatusLabel(station?.status);
  const statusVariant =
    station?.status === "maintenance" ? "watch" : station?.status === "inactive" ? "offline" : station?.status === "active" ? "healthy" : "offline";

  return (
    <div className="space-y-4">
      <div>
        <p className="text-eyebrow uppercase tracking-[0.18em] text-accent">{profile.location}</p>
        <h1 className="mt-1 text-h1 font-semibold tracking-tight">{profile.name}</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">{profile.intro}</p>
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Trạng thái vận hành</p>
        <Badge variant={statusVariant}>{status}</Badge>
      </div>
    </div>
  );
}

function HealthColumn({
  quality,
  hasAnyMeasurement,
  secondary,
}: {
  quality: ReturnType<typeof qualityFor>;
  hasAnyMeasurement: boolean;
  secondary: { label: string; value: string }[];
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Chất lượng đo</p>
        {hasAnyMeasurement ? (
          <QualityIndicator status={quality} compact />
        ) : (
          <p className="text-xs font-medium text-muted">Chưa có phép đo để đánh giá</p>
        )}
      </div>
      {secondary.length > 0 ? (
        <dl className="space-y-4 border-t border-border/50 pt-4">
          {secondary.map((item) => (
            <div key={item.label} className="flex items-baseline justify-between gap-4">
              <dt className="text-xs font-medium uppercase tracking-[0.12em] text-muted">{item.label}</dt>
              <dd className="text-sm font-semibold tabular-nums [font-family:var(--font-data)]">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

export async function StationDetail({ stationId }: { stationId: string }) {
  const context = getPublicRepositories();
  let station: Station | null = null;
  let reading: EnvironmentalReading | null = null;
  let health: StationHealthLog | null = null;
  let trend: TrendPoint[] = [];
  let threshold: { warningLevel: number; criticalLevel: number } | null = null;
  let soilReading: SoilReading | null = null;

  // Only water stations have environmental_readings rows and only soil
  // stations have soil_readings rows — a station is never both, so this
  // check (known from the static profile, before the station row itself
  // has even loaded) avoids querying a table this station can never have
  // data in.
  const isSoilStation = stationProfiles[stationId]?.kind === "soil";

  if (context) {
    const { repos, scope } = context;
    try {
      [station, reading, health, trend, threshold, soilReading] = await Promise.all([
        repos.stations.getById(stationId, scope),
        repos.readings.getLatestByStation(stationId, scope),
        repos.readings.getLatestHealthByStation(stationId, scope),
        repos.readings.getTrend24h(stationId, scope),
        repos.readings.getDefaultSalinityThreshold(),
        isSoilStation ? repos.readings.getLatestSoilReadingByStation(stationId, scope) : Promise.resolve(null),
      ]);
    } catch {
      // Leave station/reading/health/trend/threshold/soilReading at their honest "no data" defaults below.
    }
  }

  // Curated pilot allowlist, applied at this application layer per
  // FRONTEND_REBUILD_SPECIFICATION.md §3.6 — STATION_04/05 are simulator
  // fixtures, never a real operational node, so they 404 here exactly like
  // any other unknown station id rather than rendering a generic fallback.
  if (!isPilotStation(stationId)) {
    notFound();
  }

  const profile = profileFor(stationId, station);
  if (!profile) {
    notFound();
  }

  const signal = health?.signal_strength_dbm ?? null;
  const battery = health?.battery_voltage ?? null;
  const latestTimestamp = reading?.timestamp ?? soilReading?.timestamp ?? health?.timestamp ?? null;
  const freshness = freshnessStatus(latestTimestamp);
  const chartData = chartDataFrom(profile, trend);
  const quality = qualityFor(profile, reading);
  const hasAnyMeasurement = Boolean(reading || soilReading);
  const freshnessDetail = latestTimestamp ? `Cập nhật ${relativeTimeVi(latestTimestamp)}` : undefined;

  // Primary/secondary fields, kind-differentiated — never the same shape
  // forced across water/soil/gateway. Secondary values pass through
  // formatters that already render an honest "Chưa có dữ liệu" for null,
  // never a fabricated number.
  let primary: { label: string; value: string | null; unit?: string };
  let secondary: { label: string; value: string }[];

  if (profile.kind === "soil") {
    const moisture = soilReading?.soil_moisture_pct ?? null;
    primary = { label: "Độ ẩm đất", value: moisture !== null ? moisture.toFixed(1) : null, unit: "%" };
    secondary = [
      { label: "EC đất", value: formatSoilEc(soilReading?.soil_ec_ms_cm ?? null) },
      { label: "Độ pH đất", value: formatPh(soilReading?.soil_ph ?? null) },
      { label: "Nhiệt độ đất", value: formatCelsius(soilReading?.soil_temp_c ?? null) },
      { label: "Nhiệt độ không khí", value: formatCelsius(soilReading?.air_temp_c ?? null) },
      { label: "Độ ẩm không khí", value: formatPercent(soilReading?.air_humidity_pct ?? null) },
      { label: "Pin trạm", value: formatVoltage(battery) },
    ];
  } else if (profile.kind === "gateway") {
    primary = {
      label: "Tín hiệu gateway",
      value: signal !== null ? String(signal) : null,
      unit: "dBm",
    };
    secondary = battery !== null ? [{ label: "Pin gateway", value: formatVoltage(battery) }] : [];
  } else {
    const salinity = reading?.salinity ?? null;
    primary = { label: "Độ mặn", value: salinity !== null ? salinity.toFixed(2) : null, unit: "‰" };
    secondary = [
      { label: "Mực nước", value: formatWaterValue(reading?.water_level ?? null) },
      { label: "Tín hiệu trạm", value: formatSignal(signal) },
      { label: "Cảm biến EC/độ mặn", value: sensorStatusLabel(reading?.ec_probe_status) },
      { label: "Pin trạm", value: formatVoltage(battery) },
    ];
  }

  // crop_thresholds only ever carries a salinity threshold (readingRepository
  // .ts's getDefaultSalinityThreshold selects salinity_warning/critical_level
  // only) — there is no soil-specific threshold row, so a soil station can
  // never have a genuinely "live" evaluation, only the static reference.
  const evaluationNote: string | null =
    profile.kind === "water"
      ? !threshold
        ? STATIC_REFERENCE_NOTE.water
        : !reading
          ? "Chưa có số liệu độ mặn mới nhất để đánh giá theo ngưỡng đã cấu hình."
          : reading.salinity >= threshold.criticalLevel
            ? "Độ mặn đang cao, bà con nên hạn chế lấy nước trực tiếp cho cây nhạy mặn."
            : reading.salinity >= threshold.warningLevel
              ? "Độ mặn có dấu hiệu tăng, nên theo dõi thêm trước khi tưới hoặc lấy nước."
              : "Số liệu hiện đang trong ngưỡng an toàn đã cấu hình cho hệ thống."
      : profile.kind === "soil"
        ? STATIC_REFERENCE_NOTE.soil
        : null;
  const evaluationIsLive = profile.kind === "water" && threshold !== null && reading !== null;

  // This page only fetches the current station's row (getById above) — the
  // other pilot stations' real coordinates aren't loaded here, so the map
  // shows just this one station rather than inventing positions for the
  // others. (The full network map lives on /dashboard.)
  const mapStations: MapStation[] = station
    ? [{ id: profile.id, name: profile.name, lat: station.lat, lng: station.lng, freshness }]
    : [];

  return (
    <div className="full-bleed">
      <ObservatoryShell register="monitoring">
        <ObservatoryAct width="content">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr_0.75fr] lg:items-start">
            <IdentityColumn profile={profile} station={station} />

            <div className="animate-entrance space-y-2 lg:border-x lg:border-border/50 lg:px-8">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Chỉ số chính</p>
              <MeasurementValue
                label={primary.label}
                value={primary.value}
                unit={primary.unit}
                freshness={freshness}
                freshnessDetail={freshnessDetail}
                size="xl"
              />
            </div>

            <HealthColumn quality={quality} hasAnyMeasurement={hasAnyMeasurement} secondary={secondary} />
          </div>
        </ObservatoryAct>

        <ObservatoryAct width="content">
          <div className="grid gap-8 lg:grid-cols-[1.35fr_0.65fr] lg:items-start">
            <div className="border-t border-border/60 pt-6">
              {profile.kind === "water" ? (
                <StationLiveChart title={profile.chartTitle} note={profile.chartNote} data={chartData} series={profile.chartSeries} />
              ) : (
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold tracking-tight">{profile.chartTitle}</h3>
                  <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/10 p-6">
                    <StatusIndicator status="unavailable" compact />
                    <p className="text-sm text-muted">
                      Biểu đồ xu hướng hiện chỉ khả dụng cho trạm đo nước — {profile.name.toLowerCase()} chưa có nguồn dữ
                      liệu theo chuỗi thời gian.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {evaluationNote ? (
              <div className="space-y-4 border-t border-border/60 pt-6">
                <SectionHeader eyebrow={evaluationIsLive ? "Đánh giá" : "Tham chiếu tĩnh"} title="Bối cảnh" />
                <p className="text-sm leading-relaxed text-muted">{evaluationNote}</p>
              </div>
            ) : (
              <div className="space-y-4 border-t border-border/60 pt-6">
                <SectionHeader eyebrow="Vai trò" title="Thiết bị hạ tầng" />
                <p className="leading-relaxed text-muted">
                  Gateway không đo môi trường — thiết bị này tổng hợp dữ liệu từ Trạm 1 và Trạm 2 rồi chuyển tiếp về hệ
                  thống. Tín hiệu ở trên là kết nối của chính gateway, không phải một chỉ số môi trường.
                </p>
              </div>
            )}
          </div>
        </ObservatoryAct>

        <ObservatoryAct width="content">
          <div className="grid gap-8 lg:grid-cols-[0.6fr_0.4fr]">
            <div className="space-y-4">
              <SectionHeader eyebrow="Mạng lưới" title="Trạm khác" />
              <div className="space-y-0">
                {Object.values(stationProfiles).map((item) => (
                  <Link
                    key={item.id}
                    href={`/s/${item.id}`}
                    className={`flex items-center justify-between border-b border-border/50 py-3 transition-opacity duration-[var(--motion-base)] hover:opacity-70 ${item.id === profile.id ? "text-accent" : ""}`}
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="text-sm text-muted">{item.location}</span>
                  </Link>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <SectionHeader eyebrow="Vị trí" title="Bối cảnh địa lý" />
              <StationNetworkMap stations={mapStations} variant="preview" />
            </div>
          </div>
        </ObservatoryAct>

        <ObservatoryAct width="content">
          <div className="flex flex-wrap gap-3 border-t border-border/60 pt-6">
            <Button asChild variant="outline">
              <Link href="/dashboard">Về bảng quan trắc</Link>
            </Button>
            <Button asChild className="gap-2">
              <Link href={`/report?station=${encodeURIComponent(stationId)}`}>
                Báo cáo gần trạm này
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </ObservatoryAct>
      </ObservatoryShell>
    </div>
  );
}
