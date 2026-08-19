"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SourceNote } from "@/components/ui/source-note";
import { cn } from "@/lib/utils";
import type { ObservationSeries, TrendMetric, TrendRange } from "@/lib/monitoring/types";

const RANGES: { key: TrendRange; label: string }[] = [
  { key: "24h", label: "24 giờ" },
  { key: "7d", label: "7 ngày" },
  { key: "30d", label: "30 ngày" },
];

/**
 * Units come from the schema (migration 019 / environmental_readings), not
 * from guessing at the field names. Only one metric is ever plotted at a
 * time, so these scales never share an axis.
 */
const METRICS: Record<TrendMetric, { label: string; unit: string; color: string; decimals: number }> = {
  salinity: { label: "Độ mặn", unit: "‰", color: "var(--color-salinity)", decimals: 2 },
  waterLevel: { label: "Mực nước", unit: "cm", color: "var(--color-water-level)", decimals: 0 },
  soilMoisture: { label: "Độ ẩm đất", unit: "%", color: "var(--color-accent-2)", decimals: 1 },
  soilEc: { label: "EC đất", unit: "mS/cm", color: "var(--color-healthy)", decimals: 2 },
  soilPh: { label: "Độ pH", unit: "", color: "var(--color-fault)", decimals: 1 },
  soilTemp: { label: "Nhiệt độ đất", unit: "°C", color: "var(--color-watch)", decimals: 1 },
  airTemp: { label: "Nhiệt độ không khí", unit: "°C", color: "var(--color-accent)", decimals: 1 },
  airHumidity: { label: "Độ ẩm không khí", unit: "%", color: "var(--color-water-level)", decimals: 1 },
};

/**
 * A data-aware y-domain. A salinity series clustered between 1.01 and 1.08
 * rendered on a 0-based axis is a flat line that hides every real movement,
 * so the axis is fitted to the data with ~12% headroom instead.
 *
 * The tradeoff is that a fitted axis can make small absolute changes look
 * dramatic, so the caller always prints the actual visible range next to the
 * chart — the sensitivity is disclosed rather than hidden. A flat series
 * (max === min) still gets a small symmetric band so it renders as a level
 * line rather than collapsing to zero height.
 */
function computeDomain(values: number[]): [number, number] | undefined {
  if (values.length === 0) return undefined;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 0.5;
    return [min - pad, max + pad];
  }
  const pad = (max - min) * 0.12;
  return [min - pad, max + pad];
}

function EmptyRange({ range }: { range: TrendRange }) {
  const label = RANGES.find((r) => r.key === range)?.label.toLowerCase() ?? "khoảng này";
  return (
    <div className="flex min-h-[220px] flex-col justify-center gap-2 border-t border-border py-8">
      <p className="text-sm font-semibold uppercase tracking-[0.08em]">Chưa có quan trắc trong {label} gần nhất</p>
      <p className="max-w-md text-sm leading-relaxed text-muted">
        Khi trạm gửi được số liệu trong khoảng thời gian này, biểu đồ sẽ xuất hiện ở đây. Không có đường nào được vẽ
        thay thế.
      </p>
    </div>
  );
}

export function ObservationLog({ series }: { series: Record<TrendRange, ObservationSeries> }) {
  const [range, setRange] = useState<TrendRange>("24h");
  const active = series[range];

  // Default to whichever metric this range actually has; never leave a
  // toggle selected for a metric with no data behind it.
  const [metric, setMetric] = useState<TrendMetric>("salinity");
  const shown: TrendMetric = active.availableMetrics.includes(metric)
    ? metric
    : (active.availableMetrics[0] ?? "salinity");

  const meta = METRICS[shown];

  const { data, domain } = useMemo(() => {
    const rows = active.points
      .map((p) => ({ label: p.label, value: p[shown] }))
      .filter((r): r is { label: string; value: number } => r.value !== null);
    return { data: rows, domain: computeDomain(rows.map((r) => r.value)) };
  }, [active, shown]);

  const hasData = data.length > 0;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">Nhật ký quan trắc</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Diễn biến theo thời gian</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {active.availableMetrics.length > 1
            ? active.availableMetrics.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMetric(key)}
                  aria-pressed={shown === key}
                  className={cn(
                    "rounded-sm px-3 py-1.5 text-xs font-medium transition-colors duration-[var(--motion-base)]",
                    shown === key ? "bg-accent/10 text-accent" : "text-muted hover:bg-muted/25 hover:text-foreground",
                  )}
                >
                  {METRICS[key].label}
                </button>
              ))
            : null}

          <div className="ml-1 flex items-center gap-0.5 rounded-sm border border-border p-0.5">
            {RANGES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setRange(key)}
                aria-pressed={range === key}
                className={cn(
                  "rounded-[3px] px-2.5 py-1 text-xs font-medium transition-colors duration-[var(--motion-base)]",
                  range === key ? "bg-accent text-background" : "text-muted hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {hasData ? (
        <div key={`${range}-${shown}`} className="animate-entrance space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p className="text-sm font-medium">
              {meta.label}
              {/* pH is unitless — render no empty parentheses for it. */}
              {meta.unit ? <span className="ml-1.5 text-muted">({meta.unit})</span> : null}
            </p>
            {domain ? (
              // The visible range is stated because the axis is fitted to the
              // data, not zero-based — the reader needs to see the scale to
              // judge whether a movement is large or small.
              <p className="text-xs text-muted [font-family:var(--font-data)]">
                {`Trục hiển thị ${domain[0].toFixed(meta.decimals)} – ${domain[1].toFixed(meta.decimals)}${meta.unit ? ` ${meta.unit}` : ""}`}
              </p>
            ) : null}
          </div>

          <div className="h-[300px] w-full md:h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="obsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={meta.color} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={meta.color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="var(--color-muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  stroke="var(--color-muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  domain={domain ?? ["auto", "auto"]}
                  tickFormatter={(v) => Number(v).toFixed(meta.decimals)}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 10,
                    fontSize: 13,
                  }}
                  formatter={(value: number) => [
                    `${Number(value).toFixed(meta.decimals)}${meta.unit ? ` ${meta.unit}` : ""}`,
                    meta.label,
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={meta.color}
                  strokeWidth={2}
                  fill="url(#obsFill)"
                  dot={false}
                  animationDuration={420}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <SourceNote provenance={active.provenance} />
            <p className="text-xs text-muted">{data.length} quan trắc</p>
          </div>
        </div>
      ) : (
        <EmptyRange range={range} />
      )}
    </section>
  );
}
