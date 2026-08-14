import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { StationLiveChart } from "@/components/stations/station-live-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Metric } from "@/components/ui/metric";
import { SectionHeader } from "@/components/ui/section-header";
import { freshnessStatus, QualityIndicator, relativeTimeVi, StatusIndicator } from "@/components/ui/status-indicator";
import { getPublicRepositories } from "@/lib/publicRead";
import {
  chartDataFrom,
  formatCelsius,
  formatPercent,
  formatPh,
  formatSalinityValue,
  formatSignal,
  formatSoilEc,
  formatVoltage,
  formatWaterValue,
  NO_DATA_LABEL,
  profileFor,
  qualityFor,
  readingSummary,
  sensorStatusLabel,
  stationProfiles,
  stationStatusLabel,
  type StationProfile,
} from "@/lib/stationProfile";
import { formatTimestamp } from "@/lib/utils";
import type { EnvironmentalReading, SoilReading, Station, StationHealthLog, TrendPoint } from "@/types";

/**
 * Bare metric grid with top/bottom rules instead of one card per value —
 * matches the dashboard's global-status pattern (Phase D: station detail
 * was the audit's worst "boxes inside boxes" offender, four independently
 * bordered+shadowed cards for what's really one reading).
 */
function StationMetrics({
  profile,
  reading,
  health,
  threshold,
  soilReading,
  latestTimestamp,
}: {
  profile: StationProfile;
  reading: EnvironmentalReading | null;
  health: StationHealthLog | null;
  threshold?: { warningLevel: number; criticalLevel: number } | null;
  soilReading?: SoilReading | null;
  latestTimestamp: string | null;
}) {
  const summary = readingSummary(profile, reading, threshold, soilReading);
  const signal = health?.signal_strength_dbm ?? null;
  const battery = health?.battery_voltage ?? null;

  // One reading per station type carries the field decision (irrigate now?
  // is the water safe?) — that one gets visual weight, the rest support it.
  const hero =
    profile.kind === "soil"
      ? { label: "Độ ẩm đất", value: formatPercent(soilReading?.soil_moisture_pct ?? null) }
      : profile.kind === "gateway"
        ? { label: "Tín hiệu", value: formatSignal(signal) }
        : { label: "Độ mặn", value: formatSalinityValue(summary.salinity) };

  // The dominant-metric treatment only earns its size when there's a real
  // reading behind it — an absence rendered at display size reads as a
  // measurement, not a gap. Checked on the raw value, not the formatted
  // NO_DATA_LABEL string, so this can never drift out of sync with it.
  const heroRawValue =
    profile.kind === "soil" ? (soilReading?.soil_moisture_pct ?? null) : profile.kind === "gateway" ? signal : summary.salinity;
  const heroHasData = heroRawValue !== null && heroRawValue !== undefined;
  const freshness = freshnessStatus(latestTimestamp);
  const isStale = freshness === "stale" || freshness === "offline";

  const secondary =
    profile.kind === "soil"
      ? [
          { label: "EC đất", value: formatSoilEc(soilReading?.soil_ec_ms_cm ?? null) },
          { label: "Độ pH đất", value: formatPh(soilReading?.soil_ph ?? null) },
          { label: "Pin trạm", value: formatVoltage(battery) },
        ]
      : profile.kind === "gateway"
        ? [
            { label: "Tỷ lệ gửi", value: NO_DATA_LABEL },
            { label: "Pin gateway", value: formatVoltage(battery) },
            { label: "Kênh gửi", value: "SIM / Zalo" },
          ]
        : [
            { label: "Mực nước", value: formatWaterValue(summary.waterLevel) },
            { label: "Trạng thái nước", value: summary.riskLabel ?? NO_DATA_LABEL },
            { label: "Pin trạm", value: formatVoltage(battery) },
          ];

  return (
    <div className="space-y-6 border-y border-border/60 py-6">
      {heroHasData ? (
        <div className="space-y-2">
          <Metric label={isStale ? `Giá trị gần nhất · ${hero.label}` : hero.label} value={hero.value} size="xl" />
          {isStale ? (
            <StatusIndicator
              status={freshness}
              detail={latestTimestamp ? `Cập nhật ${relativeTimeVi(latestTimestamp)}` : undefined}
            />
          ) : (
            <p className="text-sm text-muted">
              {latestTimestamp ? `Cập nhật ${relativeTimeVi(latestTimestamp)}` : "Chưa có bản ghi đo nào"}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/10 p-6">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{hero.label}</p>
          <p className="text-lg font-semibold tracking-tight">Chưa có dữ liệu đo</p>
          <p className="text-sm leading-relaxed text-muted">
            Trạm chưa gửi bản ghi nào để hiển thị {hero.label.toLowerCase()}. Số liệu sẽ xuất hiện ở đây ngay khi trạm
            kết nối và đo được.
          </p>
        </div>
      )}
      <dl className="grid gap-6 border-t border-border/50 pt-6 sm:grid-cols-3">
        {secondary.map((item) => (
          <Metric key={item.label} label={item.label} value={item.value} size="sm" />
        ))}
      </dl>
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

  const profile = profileFor(stationId, station);
  if (!profile) {
    notFound();
  }

  const signal = health?.signal_strength_dbm ?? null;
  const latestTimestamp = reading?.timestamp ?? soilReading?.timestamp ?? health?.timestamp ?? null;
  const summary = readingSummary(profile, reading, threshold, soilReading);
  const chartData = chartDataFrom(profile, trend);
  const status = stationStatusLabel(station?.status);
  const statusVariant =
    station?.status === "maintenance" ? "watch" : station?.status === "inactive" ? "offline" : station?.status === "active" ? "healthy" : "offline";

  const quality = qualityFor(profile, reading);
  const hasAnyMeasurement = Boolean(reading || soilReading);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="max-w-3xl">
          <p className="mb-3 text-eyebrow uppercase tracking-[0.18em] text-accent">{profile.location}</p>
          <h1 className="text-h1 font-semibold tracking-tight">{profile.name}</h1>
          <p className="mt-3 text-lg leading-relaxed text-muted">{profile.intro}</p>
        </div>

        {/* Three independent axes, never collapsed into one badge — see docs/TELEMETRY_STATE_MODEL.md */}
        <div className="grid gap-4 border-y border-border/60 py-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Trạng thái vận hành</p>
            <Badge variant={statusVariant}>{status}</Badge>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Độ mới dữ liệu</p>
            <StatusIndicator
              status={freshnessStatus(latestTimestamp)}
              detail={latestTimestamp ? formatTimestamp(latestTimestamp) : "Không có bản ghi đo nào"}
              compact
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Chất lượng đo</p>
            {hasAnyMeasurement ? (
              <QualityIndicator status={quality} compact />
            ) : (
              <p className="text-xs font-medium text-muted">Chưa có phép đo để đánh giá</p>
            )}
          </div>
        </div>
      </section>

      <StationMetrics
        profile={profile}
        reading={reading}
        health={health}
        threshold={threshold}
        soilReading={soilReading}
        latestTimestamp={latestTimestamp}
      />

      <section className="grid gap-8 lg:grid-cols-[1.35fr_0.65fr]">
        <StationLiveChart
          title={profile.chartTitle}
          note={profile.chartNote}
          data={chartData}
          series={profile.chartSeries}
        />
        <div className="space-y-4">
          <SectionHeader eyebrow="Đề xuất" title="Khuyến nghị nhanh" />
          <p className="leading-relaxed text-muted">{summary.recommendation}</p>
          <div className="space-y-2 border-t border-border/50 pt-4 text-sm text-muted">
            <p>Mã trạm: {profile.id}</p>
            {profile.kind !== "gateway" ? <p>Tín hiệu: {formatSignal(signal)}</p> : null}
            {profile.kind === "water" ? (
              <>
                <p>Cảm biến EC/độ mặn: {sensorStatusLabel(reading?.ec_probe_status)}</p>
                <p>Cảm biến mực nước/độ ẩm: {sensorStatusLabel(reading?.ultrasonic_status)}</p>
              </>
            ) : profile.kind === "soil" ? (
              <>
                <p>Nhiệt độ không khí: {formatCelsius(soilReading?.air_temp_c ?? null)}</p>
                <p>Độ ẩm không khí: {formatPercent(soilReading?.air_humidity_pct ?? null)}</p>
                <p>Nhiệt độ đất: {formatCelsius(soilReading?.soil_temp_c ?? null)}</p>
              </>
            ) : (
              <>
                <p>Kênh chính: SIM</p>
                <p>Kênh thông báo: Zalo</p>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
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
      </section>

      <section className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href="/dashboard">Về bản đồ quan trắc</Link>
        </Button>
        <Button asChild className="gap-2">
          <Link href={`/report?station=${encodeURIComponent(stationId)}`}>
            Báo cáo gần trạm này
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </section>
    </div>
  );
}
