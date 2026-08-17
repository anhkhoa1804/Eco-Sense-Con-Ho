import Link from "next/link";
import { Suspense } from "react";
import { DailyComparisonChart } from "@/components/dashboard/daily-comparison-chart";
import { MapStation, StationNetworkMap } from "@/components/dashboard/station-network-map";
import { PublicShell } from "@/components/layout/public-shell";
import { StationConsole, type StationConsoleEntry } from "@/components/monitoring/station-console";
import { ObservatoryAct, ObservatoryShell } from "@/components/observatory/observatory-shell";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { freshnessStatus, StatusIndicator, type FreshnessState } from "@/components/ui/status-indicator";
import { getPublicRepositories } from "@/lib/publicRead";
import {
  filterSnapshotsToPilotStations,
  isPilotStation,
  latestPilotTimestamp,
  PILOT_STATION_IDS,
  type PilotStationId,
} from "@/lib/publicStations";
import {
  formatCelsius,
  formatPh,
  formatSignal,
  formatSoilEc,
  formatVoltage,
  formatWaterValue,
  stationProfiles,
} from "@/lib/stationProfile";
import { eventTitle, severityLabel } from "@/lib/utils";
import type { DailyComparisonPoint, EnvironmentalEvent, SalinityThreshold, SoilReading, StationReadingSnapshot, TrendPoint } from "@/types";
import DashboardLoading from "./loading";

export const revalidate = 60;

interface MonitoringData {
  snapshots: StationReadingSnapshot[];
  soilReading: SoilReading | null;
  waterTrend: TrendPoint[];
  dailyComparison: DailyComparisonPoint[];
  alerts: EnvironmentalEvent[];
  threshold: SalinityThreshold | null;
}

async function getMonitoringData(): Promise<MonitoringData | null> {
  const context = getPublicRepositories();
  if (!context) return null;

  try {
    const { repos, scope } = context;
    const [allSnapshots, soilReading, dailyComparison, recentAlerts, threshold] = await Promise.all([
      repos.readings.getSnapshots(scope),
      repos.readings.getLatestSoilReadingByStation("STATION_02", scope),
      repos.readings.getDailyComparison(scope),
      repos.alerts.getRecent(10, scope),
      repos.readings.getDefaultSalinityThreshold(),
    ]);
    // Only STATION_01 (water) has a real trend source — environmental_readings
    // never carries soil or gateway rows, so a per-station trend fetch would
    // just be a guaranteed-empty query for the other two.
    const waterTrend = await repos.readings.getTrend24h("STATION_01", scope);

    return {
      snapshots: filterSnapshotsToPilotStations(allSnapshots),
      soilReading,
      waterTrend,
      dailyComparison,
      alerts: recentAlerts.filter((alert) => isPilotStation(alert.station_id)),
      threshold,
    };
  } catch {
    return null;
  }
}

function freshnessBucket(freshness: FreshnessState): "live" | "offline" | "noData" {
  if (freshness === "live" || freshness === "recent") return "live";
  if (freshness === "stale" || freshness === "offline") return "offline";
  return "noData";
}

function buildStationEntries(data: MonitoringData | null, alertStationIds: Set<string>): StationConsoleEntry[] {
  return PILOT_STATION_IDS.map((id) => {
    const profile = stationProfiles[id];
    const snapshot = data?.snapshots.find((s) => s.station.id === id);
    const timestamp = latestPilotTimestamp(id, snapshot, data?.soilReading ?? null);
    const freshness = freshnessStatus(timestamp);
    const needsAttention = alertStationIds.has(id) || freshness === "offline";

    if (profile.kind === "soil") {
      const soil = data?.soilReading ?? null;
      const moisture = soil?.soil_moisture_pct ?? null;
      return {
        id,
        name: profile.name,
        needsAttention,
        freshness,
        timestamp,
        primary: { label: "Độ ẩm đất", value: moisture !== null ? moisture.toFixed(1) : null, unit: "%" },
        secondary: [
          { label: "EC đất", value: formatSoilEc(soil?.soil_ec_ms_cm ?? null) },
          { label: "Độ pH đất", value: formatPh(soil?.soil_ph ?? null) },
          { label: "Nhiệt độ đất", value: formatCelsius(soil?.soil_temp_c ?? null) },
        ],
      };
    }

    if (profile.kind === "gateway") {
      const signal = snapshot?.health?.signal_strength_dbm ?? null;
      const battery = snapshot?.health?.battery_voltage ?? null;
      return {
        id,
        name: profile.name,
        needsAttention,
        freshness,
        timestamp,
        primary: {
          label: "Tín hiệu gateway",
          value: signal !== null ? String(signal) : null,
          unit: "dBm",
          emptyMessage: "Gateway chưa báo cáo tín hiệu kết nối của chính nó.",
        },
        secondary: battery !== null ? [{ label: "Pin gateway", value: formatVoltage(battery) }] : [],
      };
    }

    const reading = snapshot?.reading ?? null;
    return {
      id,
      name: profile.name,
      needsAttention,
      freshness,
      timestamp,
      primary: { label: "Độ mặn", value: reading ? reading.salinity.toFixed(2) : null, unit: "‰" },
      secondary: [
        { label: "Mực nước", value: formatWaterValue(reading?.water_level ?? null) },
        { label: "Tín hiệu trạm", value: formatSignal(snapshot?.health?.signal_strength_dbm ?? null) },
        { label: "Pin trạm", value: formatVoltage(snapshot?.health?.battery_voltage ?? null) },
      ],
    };
  });
}

function pickDefaultStation(entries: StationConsoleEntry[]): PilotStationId {
  return (
    entries.find((entry) => entry.needsAttention)?.id ??
    entries.find((entry) => entry.primary.value !== null)?.id ??
    entries[0].id
  );
}

function NetworkStateBar({ entries }: { entries: StationConsoleEntry[] }) {
  const counts = { live: 0, offline: 0, noData: 0 };
  for (const entry of entries) counts[freshnessBucket(entry.freshness)] += 1;

  const items = [
    { label: "Trạm quan trắc", value: entries.length },
    { label: "Trực tiếp", value: counts.live },
    { label: "Mất kết nối", value: counts.offline },
    { label: "Chưa có dữ liệu", value: counts.noData },
  ];

  return (
    <div className="grid grid-cols-2 gap-6 border-y border-border/60 py-6 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="space-y-1.5">
          <p className="text-4xl font-semibold tracking-tight tabular-nums [font-family:var(--font-data)]">
            {item.value}
          </p>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

function NetworkHealth({
  entries,
  snapshots,
  alerts,
}: {
  entries: StationConsoleEntry[];
  snapshots: StationReadingSnapshot[];
  alerts: EnvironmentalEvent[];
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-4">
        <SectionHeader eyebrow="Tình trạng mạng lưới" title="Tín hiệu từng trạm" />
        <div className="divide-y divide-border/50">
          {entries.map((entry) => {
            const snapshot = snapshots.find((s) => s.station.id === entry.id);
            return (
              <div key={entry.id} className="flex items-center justify-between gap-4 py-3">
                <span className="text-sm font-medium">{entry.name}</span>
                <div className="flex items-center gap-4 text-sm text-muted">
                  <span className="hidden sm:inline">{formatSignal(snapshot?.health?.signal_strength_dbm ?? null)}</span>
                  <span className="hidden sm:inline">{formatVoltage(snapshot?.health?.battery_voltage ?? null)}</span>
                  <StatusIndicator status={entry.freshness} compact />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeader eyebrow="Bất thường" title="Cảnh báo gần đây" />
        {alerts.length === 0 ? (
          <EmptyState
            title="Không có cảnh báo mới"
            description="Mạng lưới đang vận hành bình thường. Cảnh báo sẽ xuất hiện ở đây khi một trạm cần chú ý."
          />
        ) : (
          <div className="divide-y divide-border/50">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{stationProfiles[alert.station_id]?.name ?? alert.station_id}</p>
                  <p className="mt-1 text-sm text-muted">{eventTitle(alert.event_type)}</p>
                </div>
                <div className="shrink-0 text-right text-sm">
                  <p className="font-medium">{severityLabel(alert.severity)}</p>
                  <p className="text-muted">
                    {new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(
                      new Date(alert.timestamp),
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

async function MonitoringContent() {
  const data = await getMonitoringData();

  if (!data) {
    return (
      <ObservatoryAct width="content">
        <EmptyState
          title="Chưa kết nối dữ liệu trực tiếp"
          description="Bảng quan trắc chưa được cấu hình kết nối tới Supabase trên môi trường này, nên không có số liệu thật để hiển thị. Không có bản đồ, biểu đồ hay chỉ số nào bên dưới là dữ liệu thực."
        />
      </ObservatoryAct>
    );
  }

  const alertStationIds = new Set(data.alerts.map((alert) => alert.station_id));
  const entries = buildStationEntries(data, alertStationIds);
  const defaultStationId = pickDefaultStation(entries);

  const mapStations: MapStation[] = data.snapshots.map((snapshot) => ({
    id: snapshot.station.id,
    name: stationProfiles[snapshot.station.id]?.name ?? snapshot.station.name,
    lat: snapshot.station.lat,
    lng: snapshot.station.lng,
    freshness: freshnessStatus(latestPilotTimestamp(snapshot.station.id as PilotStationId, snapshot, data.soilReading)),
  }));

  return (
    <>
      <ObservatoryAct width="content">
        <div className="space-y-6">
          <InstallPrompt />
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-eyebrow uppercase tracking-[0.18em] text-accent">Quan trắc trực tiếp</p>
              <h1 className="mt-1 text-h1 font-semibold tracking-tight">Bảng quan trắc</h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" size="sm">
                <Link href="/report">Gửi báo cáo hiện trường</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/about">Xem câu chuyện dự án</Link>
              </Button>
            </div>
          </div>
          <NetworkStateBar entries={entries} />
        </div>
      </ObservatoryAct>

      <ObservatoryAct width="content">
        <StationConsole
          stations={entries}
          defaultStationId={defaultStationId}
          waterTrend={data.waterTrend}
          threshold={data.threshold}
        />
      </ObservatoryAct>

      <ObservatoryAct width="content">
        <SectionHeader eyebrow="Mạng lưới trạm" title="Vị trí quan trắc" />
      </ObservatoryAct>
      {/* The map is the one element on this page that earns real edge-to-edge
          width (§13: "maps/charts can expand") — ObservatoryAct's own
          full-bleed mode only bleeds the section background, not its content
          (see observatory-shell.tsx), so the map needs its own .full-bleed
          wrapper to actually widen past --width-content-wide. */}
      <div className="full-bleed min-w-0 px-4">
        <StationNetworkMap stations={mapStations} variant="full" />
      </div>

      <ObservatoryAct width="content">
        <DailyComparisonChart data={data.dailyComparison} />
      </ObservatoryAct>

      <ObservatoryAct width="content">
        <NetworkHealth entries={entries} snapshots={data.snapshots} alerts={data.alerts} />
      </ObservatoryAct>
    </>
  );
}

export default function DashboardPage() {
  return (
    <PublicShell activePath="/dashboard">
      <div className="full-bleed">
        <ObservatoryShell register="monitoring">
          <Suspense fallback={<DashboardLoading />}>
            <MonitoringContent />
          </Suspense>
        </ObservatoryShell>
      </div>
    </PublicShell>
  );
}
