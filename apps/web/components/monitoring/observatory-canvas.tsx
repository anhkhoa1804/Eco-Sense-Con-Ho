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
        "group flex flex-col gap-4 bg-background p-5 text-left transition-colors duration-[var(--motion-base)]",
        selected ? "bg-accent/[0.04]" : "hover:bg-muted/20",
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

      {/* Network + three stations — one bordered field, unequal cells. */}
      <section className="space-y-5">
        <NetworkHeader network={model.network} stations={model.stations} />

        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
          {model.stations.map((station, index) => (
            <StationCell
              key={station.id}
              station={station}
              index={index}
              selected={selectedId === station.id}
              onSelect={() => setSelectedId(selectedId === station.id ? null : station.id)}
              // The soil node spans two columns on wide screens: it carries
              // six measurements to the water node's two, so equal widths
              // would either crush it or leave the others padded with air.
              className={cn(station.kind === "soil" && "lg:col-span-2")}
            />
          ))}
        </div>

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

        <AlertsPanel alerts={model.alerts} />
      </section>

      {/* Observation log and map are the two surfaces allowed to exceed the
          shell's text width on very wide screens — a chart and a map gain real
          information from extra pixels, whereas the station cells and the
          reference prose do not. Below ~1560 the cap is wider than the
          viewport, so this collapses to exactly the shell width and nothing
          changes at 1440 or below. */}
      <div className="full-bleed">
        <div className="mx-auto max-w-[min(1560px,calc(100vw-8rem))] px-4">
          <ObservationLog series={model.series} />
        </div>
      </div>

      {/* Map — spatial anchor, after the charts. */}
      <section className="full-bleed">
        <div className="mx-auto max-w-[min(1560px,calc(100vw-8rem))] space-y-5 px-4">
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
