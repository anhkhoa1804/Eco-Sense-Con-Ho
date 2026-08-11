"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyComparisonPoint } from "@/types";

const formatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2,
});

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

function tooltipValue(value: number, name: string) {
  if (name === "Thủy triều") return [`${formatter.format(value)} cm`, name];
  if (name === "Độ mặn") return [`${formatter.format(value)}‰`, name];
  return [`${formatter.format(value)} mS/cm`, name];
}

export function DailyComparisonChart({ data }: { data: DailyComparisonPoint[] }) {
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>So sánh dữ liệu theo ngày</CardTitle>
        <p className="text-sm text-muted">Thủy triều, độ xâm nhập mặn và EC đất trong 7 ngày gần nhất.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#e5eaed" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" stroke="#66707a" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                stroke="#66707a"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatter.format(Number(value))}
              />
              <Tooltip
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid #dbe3e6",
                  borderRadius: 12,
                  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
                }}
                labelStyle={{ color: "#12202a", fontWeight: 600 }}
                formatter={(value, name) => tooltipValue(Number(value), String(name))}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
              <Bar dataKey="tideLevel" name="Thủy triều" fill="#0f766e" radius={[6, 6, 0, 0]} />
              <Bar dataKey="salinity" name="Độ mặn" fill="#b45309" radius={[6, 6, 0, 0]} />
              <Bar dataKey="soilEc" name="EC đất" fill="#166534" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2 pr-4 font-medium">Ngày</th>
                <th className="py-2 pr-4 font-medium">Thủy triều</th>
                <th className="py-2 pr-4 font-medium">Độ mặn</th>
                <th className="py-2 pr-4 font-medium">EC đất</th>
                <th className="py-2 pr-4 font-medium">Bản ghi</th>
              </tr>
            </thead>
            <tbody>
              {data.map((point) => (
                <tr key={point.date} className="border-b border-border/70 last:border-0">
                  <td className="py-2 pr-4 font-medium">{point.date}</td>
                  <td className="py-2 pr-4">{formatter.format(point.tideLevel)} cm</td>
                  <td className="py-2 pr-4">{formatter.format(point.salinity)}‰</td>
                  <td className="py-2 pr-4">{formatter.format(point.soilEc)} mS/cm</td>
                  <td className="py-2 pr-4 text-muted">{point.readingCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4">
          <h3 className="text-lg font-semibold tracking-tight">Bảng thông số tiêu chuẩn để ra quyết định</h3>
          <p className="mt-1 text-sm text-muted">
            Các ngưỡng này dùng cho vườn bưởi ở mức tham khảo ban đầu; khi có dữ liệu thực địa nhiều hơn có thể hiệu chỉnh lại.
          </p>
          <div className="mt-4 overflow-x-auto">
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
      </CardContent>
    </Card>
  );
}
