"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SalinityChart } from "@/components/stations/salinity-chart";
import { MeasurementValue } from "@/components/ui/measurement-value";
import { relativeTimeVi, StatusIndicator, type FreshnessState } from "@/components/ui/status-indicator";
import { cn } from "@/lib/utils";
import type { PilotStationId } from "@/lib/publicStations";
import type { SalinityThreshold, TrendPoint } from "@/types";

const SHORT_LABEL: Record<PilotStationId, string> = {
  STATION_01: "Trạm 1",
  STATION_02: "Trạm 2",
  STATION_03: "Gateway",
};

export interface StationConsoleEntry {
  id: PilotStationId;
  name: string;
  needsAttention: boolean;
  freshness: FreshnessState;
  timestamp: string | null;
  primary: { label: string; value: string | null; unit?: string; emptyMessage?: string };
  secondary: { label: string; value: string }[];
}

function InstrumentSwitcher({
  stations,
  selectedId,
  onSelect,
}: {
  stations: StationConsoleEntry[];
  selectedId: PilotStationId;
  onSelect: (id: PilotStationId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Chọn trạm quan trắc"
      className="flex gap-1 overflow-x-auto border-b border-border/60"
    >
      {stations.map((station) => {
        const active = station.id === selectedId;
        return (
          <button
            key={station.id}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(station.id)}
            className={cn(
              "relative shrink-0 whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors duration-[var(--motion-base)]",
              active ? "text-accent" : "text-muted hover:text-foreground",
            )}
          >
            <span className="inline-flex items-center gap-2">
              {SHORT_LABEL[station.id]}
              {station.needsAttention ? (
                <span className="h-1.5 w-1.5 rounded-full bg-risk" aria-label="Cần chú ý" />
              ) : null}
            </span>
            {active ? (
              <span className="absolute inset-x-0 -bottom-px h-0.5 bg-accent" aria-hidden />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function StationConsole({
  stations,
  defaultStationId,
  waterTrend,
  threshold,
}: {
  stations: StationConsoleEntry[];
  defaultStationId: PilotStationId;
  waterTrend: TrendPoint[];
  threshold: SalinityThreshold | null;
}) {
  const [selectedId, setSelectedId] = useState<PilotStationId>(defaultStationId);
  const selected = stations.find((s) => s.id === selectedId) ?? stations[0];

  return (
    <div className="space-y-6">
      <InstrumentSwitcher stations={stations} selectedId={selectedId} onSelect={setSelectedId} />

      <div key={selected.id} className="animate-entrance space-y-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <p className="text-sm font-medium text-muted">{selected.name}</p>
          <Link
            href={`/s/${selected.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            Xem trang trạm
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        <MeasurementValue
          label={selected.primary.label}
          value={selected.primary.value}
          unit={selected.primary.unit}
          freshness={selected.freshness}
          freshnessDetail={selected.timestamp ? `Cập nhật ${relativeTimeVi(selected.timestamp)}` : undefined}
          emptyMessage={selected.primary.emptyMessage}
          size="xl"
        />

        {selected.secondary.length > 0 ? (
          <dl className="grid gap-6 border-t border-border/50 pt-6 sm:grid-cols-3">
            {selected.secondary.map((item) => (
              <div key={item.label} className="space-y-1.5">
                <dt className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{item.label}</dt>
                <dd className="text-xl font-semibold tracking-tight tabular-nums [font-family:var(--font-data)]">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="border-t border-border/50 pt-6">
          {selected.id === "STATION_01" ? (
            <SalinityChart data={waterTrend} stationName={selected.name} threshold={threshold} />
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/10 p-6">
              <StatusIndicator status="unavailable" compact />
              <p className="text-sm text-muted">
                Biểu đồ xu hướng hiện chỉ khả dụng cho trạm đo nước — {selected.name.toLowerCase()} chưa có nguồn dữ
                liệu theo chuỗi thời gian.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
