"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/ui/empty-state";
import { formatSalinity } from "@/lib/utils";
import type { SalinityThreshold, TrendPoint } from "@/types";

function summarizeTrend(data: TrendPoint[]): string {
  if (data.length < 2) {
    return "Chưa đủ dữ liệu để mô tả xu hướng.";
  }

  const first = data[0].salinity;
  const last = data[data.length - 1].salinity;
  const delta = last - first;

  if (Math.abs(delta) < 0.05) {
    return "Độ mặn khá ổn định trong 24 giờ qua.";
  }

  if (delta > 0) {
    return `Độ mặn tăng khoảng ${formatSalinity(delta)} trong 24 giờ qua.`;
  }

  return `Độ mặn giảm khoảng ${formatSalinity(Math.abs(delta))} trong 24 giờ qua.`;
}

export function SalinityChart({
  data,
  stationName,
  threshold,
}: {
  data: TrendPoint[];
  stationName: string;
  threshold: SalinityThreshold | null;
}) {
  const chartData = data.map((point) => ({
    ...point,
    label: new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(point.timestamp)),
  }));

  return (
    <section className="w-full space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-accent">{stationName}</p>
          <h3 className="text-3xl font-semibold tracking-tight">Diễn biến độ mặn 24 giờ</h3>
          <p className="max-w-3xl text-sm leading-relaxed text-muted">{summarizeTrend(data)}</p>
        </div>
        {threshold ? (
          <div className="text-sm text-muted">
            <p className="uppercase tracking-[0.14em]">Ngưỡng</p>
            <p>
              Cảnh báo {formatSalinity(threshold.warningLevel)} · Nguy cơ cao {formatSalinity(threshold.criticalLevel)}
            </p>
          </div>
        ) : null}
      </div>

      <div className="relative h-[22rem] overflow-hidden rounded-[32px] bg-[linear-gradient(180deg,rgba(15,23,42,0.02)_0%,rgba(15,23,42,0)_100%)] ring-1 ring-border/70">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center">
            <EmptyState
              title="Chưa đủ dữ liệu để vẽ biểu đồ"
              description="Biểu đồ sẽ hiển thị khi trạm gửi đủ dữ liệu trong khoảng thời gian này."
            />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 28, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="salinityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(15, 139, 141, 0.45)" />
                  <stop offset="100%" stopColor="rgba(15, 139, 141, 0.02)" />
                </linearGradient>
                <linearGradient id="waterGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(21, 128, 61, 0.24)" />
                  <stop offset="100%" stopColor="rgba(21, 128, 61, 0.02)" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="var(--color-muted)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="var(--color-muted)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={["auto", "auto"]}
                tickFormatter={(value) => `${Number(value).toFixed(1)}`}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 20,
                  boxShadow: "0 20px 40px rgba(15, 23, 42, 0.08)",
                }}
                labelStyle={{ color: "var(--color-foreground)", fontWeight: 600 }}
                formatter={(value: number, name: string) => [
                  `${Number(value).toFixed(2)} ${name === "water_level" ? "cm" : "‰"}`,
                  name === "water_level" ? "Mực nước" : "Độ mặn",
                ]}
              />
              {threshold ? (
                <>
                  <ReferenceLine
                    y={threshold.warningLevel}
                    stroke="var(--color-watch)"
                    strokeDasharray="5 5"
                    label={{
                      value: "Cần chú ý",
                      fill: "var(--color-watch)",
                      fontSize: 12,
                      position: "insideTopRight",
                    }}
                  />
                  <ReferenceLine
                    y={threshold.criticalLevel}
                    stroke="var(--color-threshold)"
                    strokeDasharray="5 5"
                    label={{
                      value: "Nguy cơ cao",
                      fill: "var(--color-threshold)",
                      fontSize: 12,
                      position: "insideTopRight",
                    }}
                  />
                </>
              ) : null}
              <Area
                type="monotone"
                dataKey="salinity"
                stroke="var(--color-salinity)"
                fill="url(#salinityGradient)"
                fillOpacity={1}
                strokeWidth={3}
                dot={false}
                name="salinity"
              />
              <Area
                type="monotone"
                dataKey="water_level"
                stroke="var(--color-accent-2)"
                fill="url(#waterGradient)"
                fillOpacity={1}
                strokeWidth={2}
                dot={false}
                name="water_level"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
