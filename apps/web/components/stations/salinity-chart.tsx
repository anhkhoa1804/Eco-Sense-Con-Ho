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
import type { TrendPoint } from "@/types";

export function SalinityChart({ data, stationName }: { data: TrendPoint[]; stationName: string }) {
  const chartData = data.map((point) => ({
    ...point,
    label: new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date(point.timestamp)),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{stationName} — 24h salinity</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        {chartData.length === 0 ? (
          <p className="text-sm text-muted">No readings in the last 24 hours.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="#a8c1bb" fontSize={12} />
              <YAxis stroke="#a8c1bb" fontSize={12} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{ background: "#0d1a1f", border: "1px solid rgba(167,234,211,0.12)", borderRadius: 12 }}
                labelStyle={{ color: "#effbf6" }}
              />
              <Line type="monotone" dataKey="salinity" stroke="#77e0b7" strokeWidth={3} dot={false} name="Salinity ‰" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
