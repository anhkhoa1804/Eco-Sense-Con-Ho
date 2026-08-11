import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, Battery, Droplets, Radio, Send, Sprout, Waves } from "lucide-react";
import {
  StationLiveChart,
  type StationLiveChartPoint,
  type StationLiveChartSeries,
} from "@/components/stations/station-live-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPublicRepositories } from "@/lib/publicRead";
import { formatTimestamp } from "@/lib/utils";
import type { EnvironmentalReading, Station, StationHealthLog, TrendPoint } from "@/types";

type StationKind = "water" | "soil" | "gateway";

interface StationProfile {
  id: string;
  kind: StationKind;
  name: string;
  location: string;
  intro: string;
  chartTitle: string;
  chartNote: string;
  chartSeries: StationLiveChartSeries[];
  demo: {
    salinity: number;
    waterLevel: number;
    soilEc: number;
    battery: number;
    signal: number;
    deliveryRate: number;
  };
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
    demo: { salinity: 1.42, waterLevel: 52, soilEc: 1.02, battery: 3.91, signal: -72, deliveryRate: 96 },
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
    demo: { salinity: 1.18, waterLevel: 61, soilEc: 1.08, battery: 3.87, signal: -76, deliveryRate: 94 },
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
    demo: { salinity: 1.25, waterLevel: 88, soilEc: 1.0, battery: 3.95, signal: -68, deliveryRate: 98 },
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
      return "Đang hoạt động";
  }
}

function signalPercent(signalDbm: number): number {
  return Math.max(0, Math.min(100, Math.round(((signalDbm + 110) / 55) * 100)));
}

function formatSalinityValue(value: number): string {
  return `${value.toFixed(2)}‰`;
}

function formatWaterValue(value: number): string {
  return `${Math.round(value)} cm`;
}

function formatSoilEc(value: number): string {
  return `${value.toFixed(2)} mS/cm`;
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
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
    demo: { salinity: 1.2, waterLevel: 50, soilEc: 1, battery: 3.8, signal: -78, deliveryRate: 92 },
  };
}

function demoTrend(profile: StationProfile): TrendPoint[] {
  return Array.from({ length: 12 }, (_, index) => {
    const timestamp = new Date(Date.now() - (11 - index) * 2 * 60 * 60 * 1000).toISOString();
    const wave = Math.sin(index / 2) * 3;

    return {
      timestamp,
      salinity: Number((profile.demo.salinity + index * 0.03 + Math.max(0, wave) * 0.03).toFixed(2)),
      water_level: Number((profile.demo.waterLevel + wave + index * 0.6).toFixed(1)),
    };
  });
}

function soilEcFrom(reading: Pick<EnvironmentalReading, "salinity" | "water_level">, profile: StationProfile): number {
  if (profile.kind !== "soil") return profile.demo.soilEc;
  return Math.max(0.2, Number((reading.salinity * 0.72 + reading.water_level / 140).toFixed(2)));
}

function chartDataFrom(profile: StationProfile, trend: TrendPoint[], signal: number): StationLiveChartPoint[] {
  return trend.map((point, index) => {
    const label = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(
      new Date(point.timestamp),
    );
    const signalScore = signalPercent(signal) + (index % 3) - 1;

    return {
      label,
      salinity: Number(point.salinity.toFixed(2)),
      waterLevel:
        profile.kind === "soil"
          ? Math.max(25, Math.min(92, Number((point.water_level + 8).toFixed(1))))
          : profile.kind === "gateway"
            ? Math.max(0, Math.min(100, signalScore))
            : Number(point.water_level.toFixed(1)),
      soilEc: Number((point.salinity * 0.72 + point.water_level / 140).toFixed(2)),
      deliveryRate: Math.max(70, Math.min(100, profile.demo.deliveryRate - (index % 4) + 1)),
    };
  });
}

function readingSummary(profile: StationProfile, reading?: EnvironmentalReading | null) {
  const salinity = reading?.salinity ?? profile.demo.salinity;
  const waterLevel = reading?.water_level ?? profile.demo.waterLevel;
  const soilEc = reading ? soilEcFrom(reading, profile) : profile.demo.soilEc;

  if (profile.kind === "soil") {
    const recommendation =
      soilEc >= 1.4
        ? "EC đất đang cao, nên ưu tiên tưới rửa nhẹ và hạn chế bón thêm phân trong thời điểm này."
        : soilEc >= 0.9
          ? "Đất đang ở mức phù hợp, có thể tiếp tục chăm sóc và theo dõi thêm sau mỗi đợt nước."
          : "EC đất còn thấp, có thể cân nhắc bổ sung dinh dưỡng theo lịch canh tác.";

    return { salinity, waterLevel, soilEc, recommendation };
  }

  if (profile.kind === "gateway") {
    return {
      salinity,
      waterLevel,
      soilEc,
      recommendation: "Gateway đang ưu tiên gửi dữ liệu mới nhất về hệ thống để thông tin đến bà con nhanh chóng.",
    };
  }

  const recommendation =
    salinity >= 1.8
      ? "Độ mặn đang cao, bà con nên hạn chế lấy nước trực tiếp cho cây nhạy mặn."
      : salinity >= 1.2
        ? "Độ mặn có dấu hiệu tăng, nên theo dõi thêm trước khi tưới hoặc lấy nước."
        : "Dữ liệu nước đang ở mức tương đối ổn định, tiếp tục quan sát theo từng con nước.";

  return { salinity, waterLevel, soilEc, recommendation };
}

function MetricTile({
  title,
  value,
  note,
  icon: Icon,
}: {
  title: string;
  value: string;
  note: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <Icon className="h-5 w-5 text-accent" aria-hidden />
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">{note}</p>
      </CardContent>
    </Card>
  );
}

function StationMetrics({
  profile,
  reading,
  health,
}: {
  profile: StationProfile;
  reading: EnvironmentalReading | null;
  health: StationHealthLog | null;
}) {
  const summary = readingSummary(profile, reading);
  const signal = health?.signal_strength_dbm ?? profile.demo.signal;
  const battery = health?.battery_voltage ?? profile.demo.battery;

  if (profile.kind === "soil") {
    return (
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile title="EC đất" value={formatSoilEc(summary.soilEc)} note="Chỉ số dẫn điện của đất tại vùng canh tác." icon={Sprout} />
        <MetricTile title="Độ ẩm đất" value={formatPercent(summary.waterLevel)} note="Ước tính từ cảm biến đất của trạm 2." icon={Droplets} />
        <MetricTile title="Tình trạng đất" value={summary.soilEc >= 1.4 ? "Cần chú ý" : "Phù hợp"} note="Dùng để hỗ trợ quyết định tưới và chăm sóc." icon={Activity} />
        <MetricTile title="Pin trạm" value={`${battery.toFixed(2)} V`} note="Nguồn hiện tại của trạm đo đất." icon={Battery} />
      </section>
    );
  }

  if (profile.kind === "gateway") {
    return (
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile title="Tỷ lệ gửi" value={formatPercent(profile.demo.deliveryRate)} note="Tỷ lệ gói dữ liệu được gateway chuyển về hệ thống." icon={Send} />
        <MetricTile title="Tín hiệu" value={`${signal} dBm`} note="Cường độ kết nối SIM tại gateway." icon={Radio} />
        <MetricTile title="Pin gateway" value={`${battery.toFixed(2)} V`} note="Nguồn hoạt động của bộ gửi dữ liệu." icon={Battery} />
        <MetricTile title="Kênh gửi" value="SIM / Zalo" note="Kênh thông tin dự kiến để trả dữ liệu về cho bà con." icon={Activity} />
      </section>
    );
  }

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricTile title="Mực nước" value={formatWaterValue(summary.waterLevel)} note="Theo dõi triều cường và dao động nước ven sông." icon={Waves} />
      <MetricTile title="Độ mặn" value={formatSalinityValue(summary.salinity)} note="Dấu hiệu xâm nhập mặn ảnh hưởng sinh hoạt và canh tác." icon={Droplets} />
      <MetricTile title="Trạng thái nước" value={summary.salinity >= 1.8 ? "Cao" : "Theo dõi"} note="Đánh giá nhanh từ dữ liệu mới nhất." icon={Activity} />
      <MetricTile title="Pin trạm" value={`${battery.toFixed(2)} V`} note="Nguồn hiện tại của trạm ven sông." icon={Battery} />
    </section>
  );
}

export async function StationDetail({ stationId }: { stationId: string }) {
  const context = getPublicRepositories();
  let station: Station | null = null;
  let reading: EnvironmentalReading | null = null;
  let health: StationHealthLog | null = null;
  let trend: TrendPoint[] = [];

  if (context) {
    const { repos, scope } = context;
    [station, reading, health, trend] = await Promise.all([
      repos.stations.getById(stationId, scope),
      repos.readings.getLatestByStation(stationId, scope),
      repos.readings.getLatestHealthByStation(stationId, scope),
      repos.readings.getTrend24h(stationId, scope),
    ]);
  }

  const profile = profileFor(stationId, station);
  if (!profile) {
    notFound();
  }

  const effectiveTrend = trend.length > 0 ? trend : demoTrend(profile);
  const signal = health?.signal_strength_dbm ?? profile.demo.signal;
  const latestTimestamp = reading?.timestamp ?? health?.timestamp ?? new Date().toISOString();
  const summary = readingSummary(profile, reading);
  const chartData = chartDataFrom(profile, effectiveTrend, signal);
  const status = stationStatusLabel(station?.status);

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="success">{status}</Badge>
          <p className="text-sm text-muted">Cập nhật gần nhất: {formatTimestamp(latestTimestamp)}</p>
        </div>
        <div className="max-w-3xl">
          <p className="mb-3 text-xs uppercase tracking-[0.18em] text-accent">{profile.location}</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{profile.name}</h2>
          <p className="mt-3 text-lg leading-relaxed text-muted">{profile.intro}</p>
        </div>
      </section>

      <StationMetrics profile={profile} reading={reading} health={health} />

      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <StationLiveChart
          title={profile.chartTitle}
          note={profile.chartNote}
          data={chartData}
          series={profile.chartSeries}
        />
        <Card>
          <CardHeader>
            <CardTitle>Khuyến nghị nhanh</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="leading-relaxed text-muted">{summary.recommendation}</p>
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Thông tin kỹ thuật</p>
              <div className="mt-3 space-y-2 text-sm text-muted">
                <p>Mã trạm: {profile.id}</p>
                <p>Tín hiệu: {signal} dBm</p>
                <p>Pin: {(health?.battery_voltage ?? profile.demo.battery).toFixed(2)} V</p>
                {profile.kind !== "gateway" ? (
                  <>
                    <p>Cảm biến EC/độ mặn: {reading?.ec_probe_status ?? "ok"}</p>
                    <p>Cảm biến mực nước/độ ẩm: {reading?.ultrasonic_status ?? "ok"}</p>
                  </>
                ) : (
                  <>
                    <p>Kênh chính: SIM</p>
                    <p>Kênh thông báo: Zalo</p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {Object.values(stationProfiles).map((item) => (
          <Link key={item.id} href={`/s/${item.id}`} className="block rounded-2xl focus-visible:ring-2 focus-visible:ring-accent">
            <Card className={`h-full transition hover:border-accent/30 ${item.id === profile.id ? "border-accent/40 bg-accent/5" : ""}`}>
              <CardContent>
                <p className="text-sm font-medium text-accent">{item.name}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{item.location}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <section className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href="/dashboard">Về bản đồ quan trắc</Link>
        </Button>
        <Button asChild>
          <Link href={`/report?station=${encodeURIComponent(stationId)}`}>Báo cáo gần trạm này</Link>
        </Button>
      </section>
    </div>
  );
}
