"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SectionHeader } from "@/components/ui/section-header";
import type { DailyComparisonPoint } from "@/types";

const formatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2,
});

/**
 * Two separate small-multiple charts, not one combo chart — tide level
 * (cm) and salinity (‰) are different physical measurements at different
 * scales, and forcing them onto one shared bar axis would visually flatten
 * whichever series has the smaller range. `soilEc` is deliberately excluded
 * — environmental_readings never writes it (readingRepository.ts), so it is
 * always null; rendering it would be an empty chart wearing a real label.
 */
const metricConfigs = [
  { key: "tideLevel", name: "Thủy triều", unit: "cm", color: "#0f766e" },
  { key: "salinity", name: "Độ mặn", unit: "‰", color: "#b45309" },
] as const;

const standardRows = [
  {
    metric: "EC đất",
    good: "< 1.5 mS/cm",
    watch: "1.5 - 2.0 mS/cm",
    danger: "> 2.0 mS/cm",
    action: "EC cao thì giảm bón phân hóa học, tránh tưới bằng nguồn nước mặn và theo dõi mép lá, hoa, quả non.",
  },
  {
    metric: "Độ ẩm đất",
    good: "45 - 65%",
    watch: "65 - 80% hoặc 30 - 45%",
    danger: "> 80% kéo dài hoặc < 30%",
    action: "Bưởi chịu úng kém. Đất quá ẩm thì dừng bơm, kiểm tra thoát nước và nguy cơ vàng lá thối rễ.",
  },
  {
    metric: "pH đất",
    good: "5.5 - 6.5",
    watch: "5.0 - 5.5 hoặc 6.5 - 7.0",
    danger: "< 5.0 hoặc > 7.0",
    action: "pH lệch làm rễ khó hút dinh dưỡng. Đất chua/kiềm cần xử lý theo hướng dẫn kỹ thuật trước khi bón tiếp.",
  },
  {
    metric: "Độ mặn nước",
    good: "< 1.2‰",
    watch: "1.2 - 1.8‰",
    danger: "> 1.8‰",
    action: "Độ mặn nước tăng thì hạn chế lấy nước tưới trực tiếp, nhất là khi cây ra hoa hoặc đang nuôi quả non.",
  },
  {
    metric: "Mực nước",
    good: "Ổn định, chưa sát bờ",
    watch: "Tăng nhanh trong 2-3 ngày",
    danger: "Gần tràn bờ, ngập gốc",
    action: "Mực nước tăng nhanh thì kiểm tra bờ bao, miệng cống, đường thoát nước và hạn chế thao tác lúc đỉnh triều.",
  },
];

function tooltipValue(value: number | null | undefined, name: string) {
  if (value === null || value === undefined) return ["Chưa có dữ liệu", name];
  if (name === "Thủy triều") return [`${formatter.format(value)} cm`, name];
  if (name === "Độ mặn") return [`${formatter.format(value)}‰`, name];
  return [`${formatter.format(value)} mS/cm`, name];
}

function cellValue(value: number | null, unit: string): string {
  return value === null ? "—" : `${formatter.format(value)} ${unit}`;
}

function ReferenceTable() {
  return (
    <div className="space-y-4 border-t border-border pt-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Tham chiếu tĩnh</p>
        <h3 className="mt-1 text-lg font-semibold tracking-tight">Bảng thông số tiêu chuẩn để ra quyết định</h3>
        <p className="mt-1 text-sm text-muted">
          Các ngưỡng này dùng cho vườn bưởi ở mức tham khảo ban đầu; khi có dữ liệu thực địa nhiều hơn có thể hiệu chỉnh lại.
        </p>
      </div>
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 pr-4 font-medium">Thông số</th>
              <th className="py-2 pr-4 font-medium text-accent">Tốt</th>
              <th className="py-2 pr-4 font-medium text-warning">Cần chú ý</th>
              <th className="py-2 pr-4 font-medium text-critical">Nguy hiểm</th>
              <th className="py-2 pr-4 font-medium">Nên làm gì</th>
            </tr>
          </thead>
          <tbody>
            {standardRows.map((row) => (
              <tr key={row.metric} className="border-b border-border/70 last:border-0 align-top">
                <td className="py-3 pr-4 font-medium">{row.metric}</td>
                <td className="py-3 pr-4">{row.good}</td>
                <td className="py-3 pr-4">{row.watch}</td>
                <td className="py-3 pr-4">{row.danger}</td>
                <td className="py-3 pr-4 leading-relaxed text-muted">{row.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DailyComparisonChart({ data }: { data: DailyComparisonPoint[] }) {
  // getDailyComparison always returns 7 date-bucketed rows, even with no
  // readings — so an array-length check never actually catches the empty
  // case. Check for a real value instead of an empty array. This only gates
  // the live 7-day comparison; the reference table below is static content
  // and stays visible regardless of live-data availability.
  const hasAnyValue = data.some((point) => point.salinity !== null || point.tideLevel !== null);

  return (
    <section className="space-y-6 border-t border-border/60 pt-8">
      <SectionHeader eyebrow="7 ngày gần nhất" title="So sánh dữ liệu theo ngày" />

      {!hasAnyValue ? (
        <p className="text-sm text-muted">Chưa có đủ dữ liệu trong 7 ngày gần nhất để so sánh.</p>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2">
            {metricConfigs.map((metric) => (
              <div key={metric.key} className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
                  {metric.name} <span className="normal-case text-muted/70">({metric.unit})</span>
                </p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#e5eaed" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" stroke="#66707a" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis
                        stroke="#66707a"
                        fontSize={10}
                        width={30}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => formatter.format(Number(value))}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#ffffff",
                          border: "1px solid #dbe3e6",
                          borderRadius: "var(--radius-md)",
                          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
                        }}
                        labelStyle={{ color: "#12202a", fontWeight: 600 }}
                        formatter={(value) =>
                          tooltipValue(value === null || value === undefined ? null : Number(value), metric.name)
                        }
                      />
                      <Bar
                        dataKey={metric.key}
                        name={metric.name}
                        fill={metric.color}
                        radius={[4, 4, 0, 0]}
                        animationDuration={400}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>

          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="py-2 pr-4 font-medium">Ngày</th>
                  <th className="py-2 pr-4 font-medium">Thủy triều</th>
                  <th className="py-2 pr-4 font-medium">Độ mặn</th>
                  <th className="py-2 pr-4 font-medium">Bản ghi</th>
                </tr>
              </thead>
              <tbody>
                {data.map((point) => (
                  <tr key={point.date} className="border-b border-border/70 last:border-0">
                    <td className="py-2 pr-4 font-medium">{point.date}</td>
                    <td className="py-2 pr-4">{cellValue(point.tideLevel, "cm")}</td>
                    <td className="py-2 pr-4">{point.salinity === null ? "—" : `${formatter.format(point.salinity)}‰`}</td>
                    <td className="py-2 pr-4 text-muted">{point.readingCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ReferenceTable />
    </section>
  );
}
