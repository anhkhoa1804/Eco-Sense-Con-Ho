"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatSalinity } from "@/lib/utils";
import type { TrendPoint } from "@/types";

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

export function SalinityChart({ data, stationName }: { data: TrendPoint[]; stationName: string }) {
  const chartData = data.map((point) => ({
    ...point,
    label: new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date(point.timestamp)),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Diễn biến độ mặn 24 giờ</CardTitle>
        <p className="text-sm text-muted">{stationName}</p>
        <p className="text-sm text-muted">{summarizeTrend(data)}</p>
      </CardHeader>
      <CardContent className="h-72">
        {chartData.length === 0 ? (
          <p className="text-sm text-muted">Chưa có dữ liệu độ mặn trong 24 giờ gần nhất.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#e5eaed" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="#66707a" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                stroke="#66707a"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={["auto", "auto"]}
                tickFormatter={(value) => `${Number(value).toFixed(1)}`}
              />
              <Tooltip
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid #dbe3e6",
                  borderRadius: 12,
                  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
                }}
                labelStyle={{ color: "#12202a", fontWeight: 600 }}
                formatter={(value: number) => [formatSalinity(value), "Độ mặn"]}
              />
              <Line type="monotone" dataKey="salinity" stroke="#166534" strokeWidth={3} dot={false} name="Độ mặn" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
