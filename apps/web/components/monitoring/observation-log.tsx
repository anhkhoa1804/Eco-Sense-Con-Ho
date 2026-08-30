"use client";

import { useMemo, useState } from "react";
import { Activity, ChevronDown } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDict } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ObservationSeries, TrendMetric, TrendRange } from "@/lib/monitoring/types";

const RANGES = [
  { key: "24h", dictKey: "range24h" },
  { key: "7d", dictKey: "range7d" },
  { key: "30d", dictKey: "range30d" },
] as const satisfies readonly { key: TrendRange; dictKey: "range24h" | "range7d" | "range30d" }[];

/**
 * Units come from the schema (migration 019 / environmental_readings), not
 * from guessing at the field names. Only one metric is ever plotted at a
 * time, so these scales never share an axis.
 */
const METRICS: Record<TrendMetric, { unit: string; color: string; decimals: number }> = {
  salinity: { unit: "‰", color: "var(--color-salinity)", decimals: 2 },
  waterLevel: { unit: "cm", color: "var(--color-water-level)", decimals: 0 },
  soilMoisture: { unit: "%", color: "var(--color-accent-2)", decimals: 1 },
  soilEc: { unit: "mS/cm", color: "var(--color-healthy)", decimals: 2 },
  soilPh: { unit: "", color: "var(--color-fault)", decimals: 1 },
  soilTemp: { unit: "°C", color: "var(--color-watch)", decimals: 1 },
  airTemp: { unit: "°C", color: "var(--color-accent)", decimals: 1 },
  airHumidity: { unit: "%", color: "var(--color-water-level)", decimals: 1 },
};

/**
 * A data-aware y-domain. A salinity series clustered between 1.01 and 1.08
 * rendered on a 0-based axis is a flat line that hides every real movement,
 * so the axis is fitted to the data with headroom instead.
 *
 * The headroom is 18%, not the 12% it started at, and the extra 6 points are
 * bought for the composition rather than the statistics: at 12% the fitted
 * domain put the topmost and bottommost y ticks hard against the plot's own
 * edges, so the first tick label sat on the rounded corner and the last one
 * on the x-axis line. Widening the domain moves the extreme ticks inward and
 * gives the plot the vertical inset the rest of the Bento has.
 *
 * The tradeoff of fitting at all is that small absolute changes look larger,
 * which the axis labels disclose by printing the real values. A flat series
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
  const pad = (max - min) * 0.18;
  return [min - pad, max + pad];
}

/**
 * One of the chart's two controls.
 *
 * A native `<select>`, deliberately. The thing it replaced was a rail of up
 * to eight text pills — every metric exposed simultaneously, which put more
 * labels in the chart box than the plot had room for and made the box read
 * as a control panel that happened to contain a chart. A popover menu would
 * have solved that too, at the cost of writing focus management, keyboard
 * handling and a portal for a job the platform already does correctly on
 * every device including touch.
 *
 * The chevron is drawn rather than left to the UA so the two controls match
 * each other across browsers; `appearance-none` removes the native one.
 */
function ControlSelect<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: T;
  onChange: (next: T) => void;
  options: readonly { value: T; label: string }[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="w-full appearance-none truncate rounded-md border border-border bg-card/70 py-1 pl-2 pr-6 text-[11px] font-medium text-foreground outline-none transition-colors duration-[var(--motion-base)] hover:border-foreground-subtle focus-visible:ring-2 focus-visible:ring-accent md:text-xs"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-foreground-subtle"
        aria-hidden
      />
    </div>
  );
}

/**
 * A quiet line, not a held-open rectangle. This used to reserve 220px of
 * empty chart canvas for a two-line message — harmless in demo mode, where
 * there is almost always a series to show, but real mode with no telemetry
 * yet turned that into the tallest, emptiest thing on the page.
 */
function EmptyRange({ range }: { range: TrendRange }) {
  const dict = useDict();
  const dictKey = RANGES.find((r) => r.key === range)?.dictKey;
  const label = (dictKey ? dict.chart[dictKey] : dict.chart.thisRange).toLowerCase();
  return (
    <p className="flex flex-1 items-center text-sm leading-relaxed text-muted">
      {fmt(dict.chart.noObservationsIn, { range: label })}
    </p>
  );
}

export function ObservationLog({ series }: { series: Record<TrendRange, ObservationSeries> }) {
  const dict = useDict();
  const [range, setRange] = useState<TrendRange>("24h");
  const active = series[range];

  // Default to whichever metric this range actually has; never leave a
  // control showing a metric with no data behind it.
  const [metric, setMetric] = useState<TrendMetric>("salinity");
  const shown: TrendMetric = active.availableMetrics.includes(metric)
    ? metric
    : (active.availableMetrics[0] ?? "salinity");

  const meta = METRICS[shown];

  const metricOptions = useMemo(
    () =>
      (active.availableMetrics.length > 0 ? active.availableMetrics : [shown]).map((key) => ({
        value: key,
        label: dict.chart.metrics[key],
      })),
    [active.availableMetrics, shown, dict],
  );

  const rangeOptions = useMemo(
    () => RANGES.map(({ key, dictKey }) => ({ value: key, label: dict.chart[dictKey] })),
    [dict],
  );

  const { data, domain } = useMemo(() => {
    const rows = active.points
      .map((p) => ({ label: p.label, value: p[shown] }))
      .filter((r): r is { label: string; value: number } => r.value !== null);
    return { data: rows, domain: computeDomain(rows.map((r) => r.value)) };
  }, [active, shown]);

  const hasData = data.length > 0;

  return (
    // `min-h-0` lets this column actually shrink inside the Bento cell.
    // Without it a flex child refuses to go below its content height, the
    // section overflows the fixed grid row, and the parent's overflow-hidden
    // silently amputates the bottom of the plot.
    <section className="flex h-full min-h-0 flex-col gap-2">
      {/* ONE header row: the box's label on the left, its two controls on
          the right — the same shape as every other box in the Bento, where
          the right of the header row is where a box states its current
          state. It cost the plot a whole row to have the controls sit under
          the label, and the label is 7 characters wide; there was never a
          reason for them to be on separate lines.

          The controls also ARE the title. A "Độ mặn · 24 giờ" line printed
          exactly what the two selects read, so of the two, the instance that
          also does something is the one that stayed. */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-foreground-muted">
          <Activity className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate text-[11px] font-semibold uppercase tracking-[0.12em]">
            {dict.chart.boxLabel}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <ControlSelect
            value={shown}
            onChange={setMetric}
            options={metricOptions}
            ariaLabel={dict.chart.metricControl}
            className="w-[7.5rem] sm:w-[9.5rem]"
          />
          <ControlSelect
            value={range}
            onChange={setRange}
            options={rangeOptions}
            ariaLabel={dict.chart.rangeControl}
            className="w-[4.75rem] sm:w-[5.25rem]"
          />
        </div>
      </div>

      {hasData ? (
        <div key={`${range}-${shown}`} className="animate-entrance flex min-h-0 flex-1 flex-col">
          {/* The plot, and nothing else. Three text lines used to bracket it
              — an axis-range sentence, a source line and an observation
              count. The first restated in prose what the y-axis already
              draws; the other two were metadata about the chart rather than
              the measurement.

              The margins here are the plot's INSET, and they are the reason
              the axis labels no longer touch the box. `margin` holds the
              drawing area off all four edges; `XAxis padding` additionally
              holds the first and last data points off the left and right
              ends, so the earliest and latest tick labels sit inside the
              plot instead of hanging over its corners. */}
          <div className="min-h-[110px] w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              {/* `top: 18` is measured, not chosen: at 10 the highest y tick
                  label sat 2px below the SVG's top edge, which inside a
                  rounded box reads as the number touching the border. */}
              <AreaChart data={data} margin={{ top: 18, right: 12, left: 0, bottom: 4 }}>
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
                  padding={{ left: 14, right: 12 }}
                  tickMargin={8}
                />
                <YAxis
                  stroke="var(--color-muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={46}
                  tickMargin={6}
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
                    dict.chart.metrics[shown],
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
        </div>
      ) : (
        <EmptyRange range={range} />
      )}
    </section>
  );
}
