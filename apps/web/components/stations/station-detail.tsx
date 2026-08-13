import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import {
  StationLiveChart,
  type StationLiveChartPoint,
  type StationLiveChartSeries,
} from "@/components/stations/station-live-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Metric } from "@/components/ui/metric";
import { SectionHeader } from "@/components/ui/section-header";
import { freshnessStatus, QualityIndicator, StatusIndicator, type QualityState } from "@/components/ui/status-indicator";
import { getPublicRepositories } from "@/lib/publicRead";
import { formatTimestamp } from "@/lib/utils";
import type { EnvironmentalReading, SensorStatus, Station, StationHealthLog, TrendPoint } from "@/types";

type StationKind = "water" | "soil" | "gateway";

const NO_DATA_LABEL = "Chưa có dữ liệu";

interface StationProfile {
  id: string;
  kind: StationKind;
  name: string;
  location: string;
  intro: string;
  chartTitle: string;
  chartNote: string;
  chartSeries: StationLiveChartSeries[];
}

const stationProfiles: Record<string, StationProfile> = {
  STATION_01: {
    id: "STATION_01",
    kind: "water",
    name: "Trạm 1 - Gần sông",
    location: "Khu ven sông Cồn Hô",
    intro: "Theo dõi mực nước, độ mặn và dấu hiệu triều cường để bà con nhận biết biến động của dòng nước sớm hơn.",
    chartTitle: "Diễn biến nước 24 giờ",
    chartNote: "So sánh mực nước và độ mặn tại khu gần sông.",
    chartSeries: [
      { key: "waterLevel", name: "Mực nước", color: "#0f766e", unit: "cm" },
      { key: "salinity", name: "Độ mặn", color: "#b45309", unit: "‰" },
    ],
  },
  STATION_02: {
    id: "STATION_02",
    kind: "soil",
    name: "Trạm 2 - Dữ liệu đất",
    location: "Khu canh tác giữa cồn",
    intro: "Đo EC đất và độ ẩm tương đối để hỗ trợ bà con chọn thời điểm tưới, chăm sóc và trồng trọt phù hợp.",
    chartTitle: "Diễn biến đất 24 giờ",
    chartNote: "Theo dõi EC đất cùng độ ẩm ước tính tại vùng canh tác.",
    chartSeries: [
      { key: "soilEc", name: "EC đất", color: "#166534", unit: "mS/cm" },
      { key: "waterLevel", name: "Độ ẩm đất", color: "#0f766e", unit: "%" },
    ],
  },
  STATION_03: {
    id: "STATION_03",
    kind: "gateway",
    name: "Trạm 3 - Gateway",
    location: "Điểm gửi dữ liệu cuối cồn",
    intro: "Tổng hợp dữ liệu từ các trạm và chuyển thông tin nhanh chóng về cho bà con qua các kênh liên lạc quen dùng.",
    chartTitle: "Trạng thái gửi dữ liệu 24 giờ",
    chartNote: "Theo dõi tỷ lệ gửi dữ liệu và tín hiệu kết nối của gateway.",
    chartSeries: [
      { key: "deliveryRate", name: "Tỷ lệ gửi", color: "#166534", unit: "%" },
      { key: "waterLevel", name: "Tín hiệu", color: "#0f766e", unit: "%" },
    ],
  },
};

function stationStatusLabel(status?: string): string {
  switch (status) {
    case "active":
      return "Đang hoạt động";
    case "maintenance":
      return "Bảo trì";
    case "offline":
    case "inactive":
      return "Ngoại tuyến";
    default:
      return "Không rõ trạng thái";
  }
}

function formatSalinityValue(value: number | null): string {
  return value === null ? NO_DATA_LABEL : `${value.toFixed(2)}‰`;
}

function formatWaterValue(value: number | null): string {
  return value === null ? NO_DATA_LABEL : `${Math.round(value)} cm`;
}

function formatVoltage(value: number | null): string {
  return value === null ? NO_DATA_LABEL : `${value.toFixed(2)} V`;
}

function formatSignal(value: number | null): string {
  return value === null ? NO_DATA_LABEL : `${value} dBm`;
}

function profileFor(stationId: string, station?: Station | null): StationProfile | null {
  if (stationProfiles[stationId]) return stationProfiles[stationId];
  if (!station) return null;

  return {
    id: station.id,
    kind: "water",
    name: station.name,
    location: "Điểm quan trắc Cồn Hô",
    intro: "Theo dõi dữ liệu môi trường tại trạm quan trắc.",
    chartTitle: "Diễn biến 24 giờ",
    chartNote: "Dữ liệu mới nhất được ghi nhận tại trạm.",
    chartSeries: [
      { key: "waterLevel", name: "Mực nước", color: "#0f766e", unit: "cm" },
      { key: "salinity", name: "Độ mặn", color: "#b45309", unit: "‰" },
    ],
  };
}

/**
 * Only "water" stations have real per-point trend data today
 * (environmental_readings carries salinity/water_level only). Soil and
 * gateway kinds have no backing columns yet — render the empty state
 * rather than inventing values for series the schema can't support.
 */
function chartDataFrom(profile: StationProfile, trend: TrendPoint[]): StationLiveChartPoint[] {
  if (profile.kind !== "water") {
    return [];
  }

  return trend.map((point) => ({
    label: new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date(point.timestamp)),
    salinity: Number(point.salinity.toFixed(2)),
    waterLevel: Number(point.water_level.toFixed(1)),
  }));
}

function readingSummary(
  profile: StationProfile,
  reading: EnvironmentalReading | null | undefined,
  threshold?: { warningLevel: number; criticalLevel: number } | null,
) {
  const salinity = reading?.salinity ?? null;
  const waterLevel = reading?.water_level ?? null;
  // Soil EC / moisture have no real column anywhere in the current schema —
  // never derive them from unrelated water fields.
  const soilEc: number | null = null;

  if (profile.kind === "soil") {
    return {
      salinity,
      waterLevel,
      soilEc,
      recommendation: "Chưa có dữ liệu đất thực tế từ trạm này để đưa ra khuyến nghị.",
      riskLabel: null as string | null,
    };
  }

  if (profile.kind === "gateway") {
    return {
      salinity,
      waterLevel,
      soilEc,
      recommendation: "Gateway đang ưu tiên gửi dữ liệu mới nhất về hệ thống để thông tin đến bà con nhanh chóng.",
      riskLabel: null as string | null,
    };
  }

  const criticalLevel = threshold?.criticalLevel ?? 1.8;
  const warningLevel = threshold?.warningLevel ?? 1.2;
  const riskLabel =
    salinity === null ? null : salinity >= criticalLevel ? "Nguy cơ cao" : salinity >= warningLevel ? "Đang tăng" : "An toàn";
  const recommendation =
    salinity === null
      ? "Chưa có dữ liệu độ mặn mới nhất từ trạm này."
      : salinity >= criticalLevel
        ? "Độ mặn đang cao, bà con nên hạn chế lấy nước trực tiếp cho cây nhạy mặn."
        : salinity >= warningLevel
          ? "Độ mặn có dấu hiệu tăng, nên theo dõi thêm trước khi tưới hoặc lấy nước."
          : "Dữ liệu nước đang ở mức tương đối ổn định, tiếp tục quan sát theo từng con nước.";

  return { salinity, waterLevel, soilEc, recommendation, riskLabel };
}

function sensorStatusLabel(status?: SensorStatus | null): string {
  switch (status) {
    case "ok":
      return "Hoạt động bình thường";
    case "warn":
      return "Cần chú ý";
    case "fault":
      return "Cần kiểm tra cảm biến";
    default:
      return "Chưa có dữ liệu";
  }
}

function qualityFor(profile: StationProfile, reading: EnvironmentalReading | null): QualityState {
  if (profile.kind !== "water" || !reading) return "valid";
  const hasFault = reading.fault_flags > 0 || reading.ec_probe_status === "fault" || reading.ultrasonic_status === "fault";
  return hasFault ? "error" : "valid";
}

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
}: {
  profile: StationProfile;
  reading: EnvironmentalReading | null;
  health: StationHealthLog | null;
  threshold?: { warningLevel: number; criticalLevel: number } | null;
}) {
  const summary = readingSummary(profile, reading, threshold);
  const signal = health?.signal_strength_dbm ?? null;
  const battery = health?.battery_voltage ?? null;

  const items =
    profile.kind === "soil"
      ? [
          { label: "EC đất", value: NO_DATA_LABEL },
          { label: "Độ ẩm đất", value: NO_DATA_LABEL },
          { label: "Tình trạng đất", value: NO_DATA_LABEL },
          { label: "Pin trạm", value: formatVoltage(battery) },
        ]
      : profile.kind === "gateway"
        ? [
            { label: "Tỷ lệ gửi", value: NO_DATA_LABEL },
            { label: "Tín hiệu", value: formatSignal(signal) },
            { label: "Pin gateway", value: formatVoltage(battery) },
            { label: "Kênh gửi", value: "SIM / Zalo" },
          ]
        : [
            { label: "Mực nước", value: formatWaterValue(summary.waterLevel) },
            { label: "Độ mặn", value: formatSalinityValue(summary.salinity) },
            { label: "Trạng thái nước", value: summary.riskLabel ?? NO_DATA_LABEL },
            { label: "Pin trạm", value: formatVoltage(battery) },
          ];

  return (
    <dl className="grid gap-6 border-y border-border/60 py-6 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Metric key={item.label} label={item.label} value={item.value} size="md" />
      ))}
    </dl>
  );
}

export async function StationDetail({ stationId }: { stationId: string }) {
  const context = getPublicRepositories();
  let station: Station | null = null;
  let reading: EnvironmentalReading | null = null;
  let health: StationHealthLog | null = null;
  let trend: TrendPoint[] = [];
  let threshold: { warningLevel: number; criticalLevel: number } | null = null;

  if (context) {
    const { repos, scope } = context;
    try {
      [station, reading, health, trend, threshold] = await Promise.all([
        repos.stations.getById(stationId, scope),
        repos.readings.getLatestByStation(stationId, scope),
        repos.readings.getLatestHealthByStation(stationId, scope),
        repos.readings.getTrend24h(stationId, scope),
        repos.readings.getDefaultSalinityThreshold(),
      ]);
    } catch {
      // Leave station/reading/health/trend/threshold at their honest "no data" defaults below.
    }
  }

  const profile = profileFor(stationId, station);
  if (!profile) {
    notFound();
  }

  const signal = health?.signal_strength_dbm ?? null;
  const battery = health?.battery_voltage ?? null;
  const latestTimestamp = reading?.timestamp ?? health?.timestamp ?? null;
  const summary = readingSummary(profile, reading, threshold);
  const chartData = chartDataFrom(profile, trend);
  const status = stationStatusLabel(station?.status);
  const statusVariant =
    station?.status === "maintenance" ? "watch" : station?.status === "inactive" ? "offline" : station?.status === "active" ? "healthy" : "offline";

  const quality = qualityFor(profile, reading);

  return (
    <div className="space-y-8">
      <section className="space-y-5">
        <div className="max-w-3xl">
          <p className="mb-3 text-xs uppercase tracking-[0.18em] text-accent">{profile.location}</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{profile.name}</h2>
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
            {reading ? (
              <QualityIndicator status={quality} compact />
            ) : (
              <p className="text-xs font-medium text-muted">Chưa có phép đo để đánh giá</p>
            )}
          </div>
        </div>
      </section>

      <StationMetrics profile={profile} reading={reading} health={health} threshold={threshold} />

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
            <p>Tín hiệu: {formatSignal(signal)}</p>
            <p>Pin: {formatVoltage(battery)}</p>
            {profile.kind !== "gateway" ? (
              <>
                <p>Cảm biến EC/độ mặn: {sensorStatusLabel(reading?.ec_probe_status)}</p>
                <p>Cảm biến mực nước/độ ẩm: {sensorStatusLabel(reading?.ultrasonic_status)}</p>
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
              className={`flex items-center justify-between border-b border-border/50 py-3 transition-opacity hover:opacity-70 ${item.id === profile.id ? "text-accent" : ""}`}
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
