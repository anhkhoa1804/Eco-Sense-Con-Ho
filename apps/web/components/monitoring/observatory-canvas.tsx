"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, FlaskConical, Radio, Send, Sprout, Waves } from "lucide-react";
import { MapStation, StationNetworkMap } from "@/components/dashboard/station-network-map";
import { ObservationLog } from "@/components/monitoring/observation-log";
import { SourceNote } from "@/components/ui/source-note";
import { QualityIndicator, relativeTimeVi, StatusIndicator, type FreshnessState } from "@/components/ui/status-indicator";
import { cn, severityLabel } from "@/lib/utils";
import type { StationKind } from "@/lib/stationProfile";
import type {
  ObservatoryAlert,
  ObservatoryMetric,
  ObservatoryReferenceItem,
  ObservatoryStation,
  ObservatoryViewModel,
} from "@/lib/monitoring/types";

const KIND_ICON: Record<StationKind, typeof Waves> = { water: Waves, soil: Sprout, gateway: Send };
const KIND_LABEL: Record<StationKind, string> = { water: "Nước", soil: "Đất", gateway: "Hạ tầng" };

const FRESHNESS_BAR: Record<FreshnessState, string> = {
  live: "bg-healthy",
  recent: "bg-healthy",
  stale: "bg-watch",
  offline: "bg-offline",
  never_connected: "bg-border-strong",
  unavailable: "bg-border-strong",
};

const SEVERITY_TONE: Record<ObservatoryAlert["severity"], string> = {
  info: "text-muted",
  warning: "text-watch",
  critical: "text-risk",
};

// ---------------------------------------------------------------------------
// Bento allocation
// ---------------------------------------------------------------------------

/**
 * Tailwind must be able to see every class it generates, so spans are looked
 * up from this static map rather than built as `lg:col-span-${n}`.
 */
const SPAN_CLASS: Record<number, string> = {
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  5: "lg:col-span-5",
  6: "lg:col-span-6",
  7: "lg:col-span-7",
  8: "lg:col-span-8",
  12: "lg:col-span-12",
};

/** How many of a station's readings actually carry a value right now. */
function populatedMetricCount(station: ObservatoryStation): number {
  const all = [
    station.primary,
    ...station.environment.flatMap((group) => group.metrics),
    ...station.device,
  ];
  return all.filter((metric) => metric.value !== null).length;
}

/**
 * Column spans for the two environmental instrument tiles, driven by how much
 * information each currently holds — not by what kind of node it is.
 *
 * The obvious rule ("soil is widest, it has six sensors") is wrong here:
 * production currently holds zero soil rows, so a kind-based allocation would
 * hand the wider tile to the emptier station and produce exactly the large
 * blank card this layout is meant to avoid. When neither has reported they are
 * equally uninformative and the band splits evenly, rather than inventing a
 * hierarchy the data does not support.
 */
function computeSensorSpans(stations: ObservatoryStation[]): number[] {
  const counts = stations.map(populatedMetricCount);

  if (stations.length !== 2) return stations.map(() => 12);
  if (counts[0] === counts[1]) return [6, 6];
  return counts[0] > counts[1] ? [7, 5] : [5, 7];
}

// ---------------------------------------------------------------------------
// Network header
// ---------------------------------------------------------------------------

function NetworkHeader({ network, stations }: { network: ObservatoryViewModel["network"]; stations: ObservatoryStation[] }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">Mạng lưới</p>
        <p className="max-w-xl text-xl font-semibold leading-snug tracking-tight md:text-2xl">
          <span className="[font-family:var(--font-data)]">{network.total}</span> trạm quan trắc ·{" "}
          {network.live > 0 ? (
            <>
              <span className="[font-family:var(--font-data)]">{network.live}</span> đang gửi dữ liệu
            </>
          ) : (
            <span className="text-muted">chưa trạm nào gửi dữ liệu</span>
          )}
        </p>
        <p className="text-sm text-muted">
          {network.lastObservationAt
            ? `Quan trắc gần nhất ${relativeTimeVi(network.lastObservationAt)}.`
            : "Hệ thống chưa nhận được quan trắc nào từ mạng lưới."}
        </p>
      </div>

      <div className="flex items-end gap-8">
        <div className="space-y-2">
          <div className="flex gap-1" aria-hidden>
            {stations.map((s) => (
              <span
                key={s.id}
                className={cn("h-1 w-10 rounded-full transition-colors duration-[var(--motion-medium)]", FRESHNESS_BAR[s.freshness])}
              />
            ))}
          </div>
          <p className="text-xs text-muted">
            {network.noData > 0 ? `${network.noData} chưa có dữ liệu` : null}
            {network.noData > 0 && network.offline > 0 ? " · " : null}
            {network.offline > 0 ? `${network.offline} mất kết nối` : null}
            {network.noData === 0 && network.offline === 0 ? "Toàn mạng đang hoạt động" : null}
          </p>
        </div>

        <div className="space-y-1 text-right">
          <p
            className={cn(
              "text-2xl font-semibold [font-family:var(--font-data)]",
              network.alertsNeedingAttention > 0 ? "text-watch" : "text-muted",
            )}
          >
            {network.alertsNeedingAttention}
          </p>
          <p className="text-xs uppercase tracking-[0.12em] text-muted">Cần chú ý</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Station cells
// ---------------------------------------------------------------------------

function MetricRow({ metric, dense = false }: { metric: ObservatoryMetric; dense?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={cn("text-muted", dense ? "text-xs" : "text-sm")}>{metric.label}</dt>
      <dd
        className={cn(
          "shrink-0 tabular-nums [font-family:var(--font-data)]",
          dense ? "text-xs" : "text-sm",
          metric.value === null ? "text-muted/70" : "font-semibold",
        )}
      >
        {metric.value === null ? "—" : `${metric.value}${metric.unit ? ` ${metric.unit}` : ""}`}
      </dd>
    </div>
  );
}

function StationCell({
  station,
  index,
  selected,
  onSelect,
  className,
}: {
  station: ObservatoryStation;
  index: number;
  selected: boolean;
  onSelect: () => void;
  className?: string;
}) {
  const Icon = KIND_ICON[station.kind];
  const isGateway = station.kind === "gateway";
  const hasValue = station.primary.value !== null;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        // A standalone tile now, not a cell inside one bordered field: each
        // station owns its own border so the row can carry unequal spans
        // without the shared grid lines making the widths look accidental.
        "bento-tile group flex flex-col gap-4 rounded-lg border p-5 text-left",
        "transition-colors duration-[var(--motion-base)]",
        selected ? "border-accent/40 bg-accent/[0.04]" : "border-border hover:bg-muted/15",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] tracking-[0.16em] text-muted [font-family:var(--font-data)]">
            {String(index + 1).padStart(2, "0")}
          </span>
          <Icon className={cn("h-4 w-4", selected ? "text-accent" : "text-muted")} aria-hidden />
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            {KIND_LABEL[station.kind]}
          </span>
        </div>
        <StatusIndicator status={station.freshness} compact />
      </div>

      <div className="space-y-0.5">
        <p className={cn("text-sm font-semibold tracking-tight", selected && "text-accent")}>{station.name}</p>
        <p className="text-xs text-muted">{station.location}</p>
      </div>

      {/* Primary instrument. The gateway deliberately renders prose instead of
          a large dash — it is infrastructure, and a giant empty numeral would
          imply a measurement that this node is not designed to take. */}
      {isGateway && !hasValue ? (
        <div className="flex-1 space-y-2 border-t border-border/50 pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Vai trò</p>
          <p className="text-sm leading-relaxed text-muted">{station.capabilityNote}</p>
        </div>
      ) : (
        <div className="flex-1 space-y-3 border-t border-border/50 pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{station.primary.label}</p>
          {hasValue ? (
            <p className="text-4xl font-semibold tracking-tight tabular-nums [font-family:var(--font-data)]">
              {station.primary.value}
              {station.primary.unit ? (
                <span className="ml-1.5 text-base font-normal text-muted [font-family:inherit]">
                  {station.primary.unit}
                </span>
              ) : null}
            </p>
          ) : (
            <p className="text-sm text-muted">Chưa có dữ liệu</p>
          )}

          {station.environment.map((group) => (
            <dl key={group.label} className="space-y-1.5 pt-1">
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted/80">{group.label}</p>
              {group.metrics.map((m) => (
                <MetricRow key={m.label} metric={m} dense />
              ))}
            </dl>
          ))}

          {station.device.length > 0 ? (
            <dl className="space-y-1.5 border-t border-border/40 pt-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted/80">Thiết bị</p>
              {station.device.map((m) => (
                <MetricRow key={m.label} metric={m} dense />
              ))}
            </dl>
          ) : null}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-3">
        {station.quality ? (
          <QualityIndicator status={station.quality} compact />
        ) : (
          <span className="text-[11px] text-muted">
            {station.timestamp ? `Cập nhật ${relativeTimeVi(station.timestamp)}` : "Chưa có phép đo"}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-accent opacity-0 transition-opacity duration-[var(--motion-base)] group-hover:opacity-100">
          Chi tiết
          <ArrowRight className="h-3 w-3" aria-hidden />
        </span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Compact panels
// ---------------------------------------------------------------------------

function AlertsPanel({ alerts }: { alerts: ObservatoryAlert[] }) {
  if (alerts.length === 0) {
    // Compressed to a single line — an empty alert list carries almost no
    // information and must not occupy a screen of vertical space.
    return (
      <div className="flex items-center gap-2.5 border-t border-border/60 py-4">
        <span className="h-1.5 w-1.5 rounded-full bg-healthy" aria-hidden />
        <p className="text-sm">
          <span className="font-medium">Không có cảnh báo</span>
          <span className="text-muted"> · mạng lưới không ghi nhận sự kiện nào cần chú ý</span>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-border/60 pt-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
        Cảnh báo · {alerts.length} đang hoạt động
      </p>
      <div className="divide-y divide-border/50">
        {alerts.map((alert) => (
          <div key={alert.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium">{alert.stationName}</p>
              <p className="text-sm text-muted">{alert.title}</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className={cn("font-semibold uppercase tracking-[0.08em]", SEVERITY_TONE[alert.severity])}>
                {severityLabel(alert.severity)}
              </span>
              <span className="text-muted [font-family:var(--font-data)]">
                {new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(
                  new Date(alert.timestamp),
                )}
              </span>
            </div>
          </div>
        ))}
      </div>
      <SourceNote provenance={alerts[0].provenance} />
    </div>
  );
}

const STANDING_META: Record<
  ObservatoryReferenceItem["standing"],
  { label: string; className: string }
> = {
  external: { label: "Nguồn quốc tế", className: "bg-accent/10 text-accent" },
  internal: { label: "Cấu hình dự án", className: "bg-muted/30 text-muted" },
  unverified: { label: "Chưa xác minh", className: "bg-watch-bg text-watch" },
};

function ReferencePanel({ reference }: { reference: ObservatoryReferenceItem[] }) {
  return (
    <div className="grid gap-x-10 gap-y-8 md:grid-cols-3">
      {reference.map((item) => {
        const meta = STANDING_META[item.standing];
        return (
          <div key={item.title} className="space-y-3 border-t border-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">{item.title}</p>
              <span
                className={cn(
                  "rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]",
                  meta.className,
                )}
              >
                {meta.label}
              </span>
            </div>

            {item.rows.length > 0 ? (
              <dl className="space-y-1.5">
                {item.rows.map((row) => (
                  <div key={row.range} className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm tabular-nums [font-family:var(--font-data)]">{row.range}</dt>
                    <dd className="text-sm text-muted">{row.meaning}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            <p className="text-sm leading-relaxed text-muted">{item.detail}</p>

            {item.sourceLabel ? (
              <p className="text-xs leading-relaxed text-muted">
                Nguồn:{" "}
                {item.sourceUrl ? (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent underline-offset-2 hover:underline"
                  >
                    {item.sourceLabel}
                  </a>
                ) : (
                  item.sourceLabel
                )}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

export function ObservatoryCanvas({ model }: { model: ObservatoryViewModel }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = model.stations.find((s) => s.id === selectedId) ?? null;

  const hasAlerts = model.alerts.length > 0;

  // Split by information TYPE, not by station number: the gateway reports
  // link health (infrastructure) while the other two report environment.
  // Grouping them that way is what makes the canvas read as an observatory
  // rather than a list of nodes.
  const infrastructure = model.stations.find((s) => s.kind === "gateway") ?? null;
  const sensors = model.stations.filter((s) => s.kind !== "gateway");
  const sensorSpans = computeSensorSpans(sensors);

  const mapStations: MapStation[] =
    model.mode === "real"
      ? model.stations.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, freshness: s.freshness }))
      : [];

  return (
    <div className="space-y-12 md:space-y-16">
      {model.mode === "demo" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-watch-bg px-5 py-4">
          <div className="flex items-center gap-3">
            <FlaskConical className="h-4 w-4 shrink-0 text-watch" aria-hidden />
            <p className="text-sm font-medium text-watch">
              DỮ LIỆU MINH HỌA — toàn bộ số liệu trên trang này là tổng hợp để trình bày giao diện, không phải quan
              trắc thật từ Cồn Hô.
            </p>
          </div>
          <Link href="/dashboard" className="shrink-0 text-xs font-medium text-watch underline-offset-2 hover:underline">
            Xem dữ liệu thật →
          </Link>
        </div>
      ) : null}

      {/*
        The bento proper — a 12-column field whose regions are sized by how
        much information they actually carry.

        Two things keep this from becoming decorative: every region is backed
        by real model data (there is no "network health" tile, because
        nothing in the model would fill one beyond what the summary already
        says), and every region collapses when its data is absent rather than
        holding open an empty rectangle.
      */}
      <section className="space-y-4">
        {/*
          BAND 1 — network & infrastructure.

          The gateway sits HERE, beside the network summary, not in a row with
          the two sensor stations. That single move is what stops the page
          reading as "three station boxes": the gateway is infrastructure —
          it reports link health, not environment — so grouping it with the
          network state makes the top band answer one question ("is the
          network up?") instead of listing nodes.
        */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="instrument-in bento-tile rounded-lg border border-border p-5 md:p-6 lg:col-span-7">
            <NetworkHeader network={model.network} stations={model.stations} />
          </div>

          {infrastructure ? (
            <StationCell
              station={infrastructure}
              index={model.stations.indexOf(infrastructure)}
              selected={selectedId === infrastructure.id}
              onSelect={() => setSelectedId(selectedId === infrastructure.id ? null : infrastructure.id)}
              className="instrument-in instrument-in-1 lg:col-span-5"
            />
          ) : null}
        </div>

        {/*
          BAND 2 — the environmental instruments. Two tiles, deliberately
          unequal: spans follow how many readings each actually carries right
          now (see computeSensorSpans), so the wider tile is always the one
          with more to show rather than the one whose station type sounds
          bigger.
        */}
        {sensors.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {sensors.map((station, i) => (
              <StationCell
                key={station.id}
                station={station}
                index={model.stations.indexOf(station)}
                selected={selectedId === station.id}
                onSelect={() => setSelectedId(selectedId === station.id ? null : station.id)}
                className={cn("instrument-in instrument-in-2", SPAN_CLASS[sensorSpans[i]])}
              />
            ))}
          </div>
        ) : null}

        {selected ? (
          <div className="animate-entrance flex flex-wrap items-center justify-between gap-4 rounded-lg border border-accent/30 bg-accent/[0.04] px-5 py-4">
            <div className="flex items-center gap-3">
              <Radio className="h-4 w-4 shrink-0 text-accent" aria-hidden />
              <p className="text-sm">
                <span className="font-semibold">{selected.name}</span>
                <span className="text-muted"> · {selected.location}</span>
              </p>
            </div>
            <div className="flex items-center gap-4">
              <SourceNote provenance={selected.primary.provenance} />
              <Link
                href={`/s/${selected.id}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
              >
                Trang trạm
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </div>
        ) : null}

      </section>

      {/*
        BAND 3 — time and events, side by side.

        The observation log answers "how has this been changing?" and the
        alert stream answers "what changed enough to notice?". They are two
        readings of the same axis, so they belong in one band rather than
        separated by half a page. The log keeps the dominant span because a
        chart converts width directly into resolution; the alert column does
        not.

        With no alerts the log takes the full band and the "all quiet" line
        drops to a single strip beneath it — an empty event list gets the
        space its information deserves, not a held-open rectangle.
      */}
      <section className="full-bleed">
        <div className="h-spatial">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className={cn("min-w-0", hasAlerts ? "lg:col-span-8" : "lg:col-span-12")}>
              <ObservationLog series={model.series} />
            </div>

            {hasAlerts ? (
              <div className="bento-tile rounded-lg border border-border p-5 lg:col-span-4">
                <AlertsPanel alerts={model.alerts} />
              </div>
            ) : null}
          </div>

          {hasAlerts ? null : (
            <div className="mt-4">
              <AlertsPanel alerts={model.alerts} />
            </div>
          )}
        </div>
      </section>

      {/* Map — spatial anchor, after the charts. */}
      <section className="full-bleed">
        <div className="h-spatial space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">Không gian</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Vị trí các trạm</h2>
            </div>
            <p className="text-xs text-muted">Cồn Hô · Vĩnh Long</p>
          </div>
          <StationNetworkMap
            stations={mapStations}
            variant="observatory"
            selectedStationId={selected?.id ?? undefined}
          />
        </div>
      </section>

      {/* References. */}
      <section className="space-y-6">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">Tham chiếu</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Cơ sở diễn giải số liệu</h2>
        </div>
        <ReferencePanel reference={model.reference} />
      </section>
    </div>
  );
}
