import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { MapStation, StationNetworkMap } from "@/components/dashboard/station-network-map";
import { MeasurementValue } from "@/components/ui/measurement-value";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { freshnessStatus, QualityIndicator, relativeTime, StatusIndicator } from "@/components/ui/status-indicator";
import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n";
import { stationText } from "@/lib/stationProfile";
import type { Dictionary } from "@/lib/i18n/vi";
import { getPublicRepositories } from "@/lib/publicRead";
import { isPilotStation, PILOT_STATION_IDS, stationHref } from "@/lib/publicStations";
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
 * Shown when no threshold is configured in `crop_thresholds`.
 *
 * These strings previously carried hardcoded numbers ("dưới 1.2‰…", "EC đất
 * dưới 1.5 mS/cm và độ ẩm 45–65%"). They were removed in Phase 4.1 after
 * tracing them to source:
 *
 *  - Their only origin is the informal "Grapefruit guidance" comment block in
 *    firmware/esp32-node/src/trạm 2.ino:26-29 — an engineering note that
 *    itself hedges ("should stay below *roughly* 1.5-2.0 mS/cm") and sits
 *    directly above a TODO stating the sensor scaling is still unconfirmed.
 *  - The "45–65%" soil-moisture range appears nowhere in that source at all;
 *    the firmware note only warns that moisture sustained above 80% risks
 *    root rot. That figure was unsupported even by the file it came from.
 *
 * Per the reference policy Monitoring now follows: where a value cannot be
 * defended, drop the number rather than print it under a disclaimer. Real
 * configured thresholds still drive the live evaluation path below — that is
 * genuine system configuration, not a claimed scientific standard.
 */
function staticReferenceNote(kind: "water" | "soil", dict: Dictionary): string {
  return kind === "water" ? dict.station.thresholdNotConfigured : dict.station.soilInterpretationPending;
}

function IdentityColumn({ profile, station, dict }: { profile: StationProfile; station: Station | null; dict: Dictionary }) {
  const text = stationText(profile.id, dict);
  const status = stationStatusLabel(station?.status, dict);
  const statusVariant =
    station?.status === "maintenance" ? "watch" : station?.status === "inactive" ? "offline" : station?.status === "active" ? "healthy" : "offline";

  return (
    <div className="space-y-4">
      <div>
        <p className="text-eyebrow uppercase tracking-[0.18em] text-accent">{text.location}</p>
        <h1 className="mt-1 text-[length:var(--text-title-instrument)] font-semibold leading-tight tracking-tight">{text.name}</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">{text.intro}</p>
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">{dict.station.operationalStatus}</p>
        <Badge variant={statusVariant}>{status}</Badge>
      </div>
    </div>
  );
}

function HealthColumn({
  quality,
  hasAnyMeasurement,
  secondary,
  dict,
}: {
  quality: ReturnType<typeof qualityFor>;
  hasAnyMeasurement: boolean;
  secondary: { label: string; value: string }[];
  dict: Dictionary;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">{dict.station.measurementQuality}</p>
        {hasAnyMeasurement ? (
          <QualityIndicator status={quality} dict={dict} compact />
        ) : (
          <p className="text-xs font-medium text-muted">{dict.station.noMeasurementToAssess}</p>
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
  const { dict, locale } = await getI18n();
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
  const freshnessDetail = latestTimestamp ? `${dict.common.updated} ${relativeTime(latestTimestamp, locale)}` : undefined;

  // Primary/secondary fields, kind-differentiated — never the same shape
  // forced across water/soil/gateway. Secondary values pass through
  // formatters that already render an honest "Chưa có dữ liệu" for null,
  // never a fabricated number.
  let primary: { label: string; value: string | null; unit?: string };
  let secondary: { label: string; value: string }[];

  if (profile.kind === "soil") {
    const moisture = soilReading?.soil_moisture_pct ?? null;
    primary = { label: dict.station.mSoilMoisture, value: moisture !== null ? moisture.toFixed(1) : null, unit: "%" };
    secondary = [
      { label: dict.station.mSoilEc, value: formatSoilEc(soilReading?.soil_ec_ms_cm ?? null) },
      { label: dict.station.mSoilPh, value: formatPh(soilReading?.soil_ph ?? null) },
      { label: dict.station.mSoilTemp, value: formatCelsius(soilReading?.soil_temp_c ?? null) },
      { label: dict.station.mAirTemp, value: formatCelsius(soilReading?.air_temp_c ?? null) },
      { label: dict.station.mAirHumidity, value: formatPercent(soilReading?.air_humidity_pct ?? null) },
      { label: dict.station.mBattery, value: formatVoltage(battery) },
    ];
  } else if (profile.kind === "gateway") {
    primary = {
      label: dict.station.mGatewaySignal,
      value: signal !== null ? String(signal) : null,
      unit: "dBm",
    };
    secondary = battery !== null ? [{ label: "Pin gateway", value: formatVoltage(battery) }] : [];
  } else {
    const salinity = reading?.salinity ?? null;
    primary = { label: dict.station.mSalinity, value: salinity !== null ? salinity.toFixed(2) : null, unit: "‰" };
    secondary = [
      { label: dict.station.mWaterLevel, value: formatWaterValue(reading?.water_level ?? null) },
      { label: dict.station.mStationSignal, value: formatSignal(signal) },
      { label: dict.station.mEcProbe, value: sensorStatusLabel(reading?.ec_probe_status) },
      { label: dict.station.mBattery, value: formatVoltage(battery) },
    ];
  }

  // crop_thresholds only ever carries a salinity threshold (readingRepository
  // .ts's getDefaultSalinityThreshold selects salinity_warning/critical_level
  // only) — there is no soil-specific threshold row, so a soil station can
  // never have a genuinely "live" evaluation, only the static reference.
  const evaluationNote: string | null =
    profile.kind === "water"
      ? !threshold
        ? staticReferenceNote("water", dict)
        : !reading
          ? dict.station.salinityNoData
          : reading.salinity >= threshold.criticalLevel
            ? dict.station.salinityHigh
            : reading.salinity >= threshold.warningLevel
              ? dict.station.salinityRising
              : dict.station.salinitySafe
      : profile.kind === "soil"
        ? staticReferenceNote("soil", dict)
        : null;
  const evaluationIsLive = profile.kind === "water" && threshold !== null && reading !== null;

  // This page only fetches the current station's row (getById above) — the
  // other pilot stations' real coordinates aren't loaded here, so the map
  // shows just this one station rather than inventing positions for the
  // others. (The full network map lives on /dashboard.)
  const mapStations: MapStation[] = station
    ? [{ id: profile.id, name: stationText(profile.id, dict).name, lat: station.lat, lng: station.lng, freshness }]
    : [];

  return (
    // `.h-content` — the same width primitive every other page uses, with
    // the same responsive `--gutter`. This page previously broke out to
    // `.full-bleed` only to immediately re-cap to almost the same width
    // through a separate, pre-rebrand layout system (ObservatoryShell/
    // ObservatoryAct) with its own fixed 16px gutter — a round trip that
    // bought nothing and left this page's left/right edges off the shared
    // grid at wider viewports. That component has no other caller and has
    // been removed along with this wrapper.
    <div className="h-content space-y-12">
      <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr_0.75fr] lg:items-start">
        <IdentityColumn profile={profile} station={station} dict={dict} />

        <div className="animate-entrance space-y-2 lg:border-x lg:border-border/50 lg:px-8">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{dict.station.primaryMetric}</p>
          <MeasurementValue dict={dict}
            label={primary.label}
            value={primary.value}
            unit={primary.unit}
            freshness={freshness}
            freshnessDetail={freshnessDetail}
            size="xl"
          />
        </div>

        <HealthColumn quality={quality} hasAnyMeasurement={hasAnyMeasurement} secondary={secondary} dict={dict} />
      </div>

      <div className="grid gap-8 border-t border-border/60 pt-8 lg:grid-cols-[1.35fr_0.65fr] lg:items-start">
        <div>
          {profile.kind === "water" ? (
            <StationLiveChart title={stationText(profile.id, dict).chartTitle} note={stationText(profile.id, dict).chartNote} data={chartData} series={profile.chartSeries} />
          ) : (
            <div className="space-y-2">
              <h3 className="text-xl font-semibold tracking-tight">{stationText(profile.id, dict).chartTitle}</h3>
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/10 p-6">
                <StatusIndicator status="unavailable" dict={dict} compact />
                <p className="text-sm text-muted">
                  {fmt(dict.station.chartWaterOnly, { station: profile.name.toLowerCase() })}

                </p>
              </div>
            </div>
          )}
        </div>

        {evaluationNote ? (
          <div className="space-y-4">
            <SectionHeader eyebrow={evaluationIsLive ? dict.station.evalLive : dict.station.evalStatic} title={dict.station.contextTitle} />
            <p className="text-sm leading-relaxed text-muted">{evaluationNote}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <SectionHeader eyebrow={dict.station.roleEyebrow} title={dict.station.gatewayTitle} />
            <p className="leading-relaxed text-muted">
              {dict.station.gatewayBody}

            </p>
          </div>
        )}
      </div>

      <div className="grid gap-8 border-t border-border/60 pt-8 lg:grid-cols-[0.6fr_0.4fr]">
        <div className="space-y-4">
          <SectionHeader eyebrow={dict.station.networkEyebrow} title={dict.station.otherStations} />
          <div className="space-y-0">
            {/* Filtered to the OTHER stations — a section headed "Trạm khác"
                previously listed the station you were already reading,
                linking to the current page and highlighting it as if it were
                a destination. Sourced from PILOT_STATION_IDS rather than
                Object.values(stationProfiles) so this list can never drift
                from the canonical three-node allowlist. */}
            {PILOT_STATION_IDS.filter((id) => id !== profile.id).map((id) => {
              const item = stationProfiles[id];
              return (
                <Link
                  key={id}
                  href={stationHref(id)}
                  className="flex items-center justify-between border-b border-border/50 py-3 transition-opacity duration-[var(--motion-base)] hover:opacity-70"
                >
                  <span className="font-medium">{item.name}</span>
                  <span className="text-sm text-muted">{item.location}</span>
                </Link>
              );
            })}
          </div>
        </div>
        <div className="space-y-4">
          <SectionHeader eyebrow={dict.station.locationEyebrow} title={dict.station.locationTitle} />
          <StationNetworkMap stations={mapStations} variant="preview" />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-border/60 pt-8">
        <Button asChild variant="outline">
          <Link href="/dashboard">{dict.station.backToMonitoring}</Link>
        </Button>
        <Button asChild className="gap-2">
          <Link href={`/report?station=${encodeURIComponent(stationId)}`}>
            {dict.station.reportNearby}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
