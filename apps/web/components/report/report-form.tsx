"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const CATEGORIES = [
  { value: "erosion", label: "Xói lở bờ sông" },
  { value: "flooding", label: "Ngập nước / thủy triều" },
  { value: "pollution", label: "Ô nhiễm" },
  { value: "infrastructure", label: "Hư hại hạ tầng" },
  { value: "sensor", label: "Lỗi trạm quan trắc" },
  { value: "other", label: "Khác" },
] as const;

export function ReportForm() {
  const searchParams = useSearchParams();
  const stationFromQuery = searchParams.get("station") ?? "";

  const [category, setCategory] = useState<string>("erosion");
  const [description, setDescription] = useState("");
  const [stationId, setStationId] = useState(stationFromQuery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessId(null);

    let lat: number | undefined;
    let lng: number | undefined;

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 60000 });
        });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      } catch {
        // Tiếp tục; vị trí trạm sẽ được dùng phía máy chủ nếu có stationId.
      }
    }

    const res = await fetch("/api/public/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        description,
        lat,
        lng,
        stationId: stationId.trim() || undefined,
      }),
    });

    const response = (await res.json()) as { ok?: boolean; id?: string };
    setLoading(false);

    if (!res.ok) {
      setError("Không thể gửi báo cáo. Vui lòng thử lại sau.");
      return;
    }

    setSuccessId(response.id ?? "đã-gửi");
    setDescription("");
  }

  if (successId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cảm ơn bạn</CardTitle>
          <CardDescription>Báo cáo của bạn đã được ghi nhận.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted">
            <p>Tham chiếu: {successId}</p>
            <p className="mt-1">Hệ thống sẽ đưa báo cáo vào quy trình kiểm tra trước khi xử lý.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/dashboard">Về bảng quan trắc</Link>
            </Button>
            <Button variant="outline" onClick={() => setSuccessId(null)}>
              Gửi báo cáo khác
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Báo cáo hiện trường</CardTitle>
        <CardDescription>
          Không cần tài khoản. Báo cáo giúp theo dõi xói lở, ngập nước, ô nhiễm và hư hại môi trường.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category">Loại hiện trạng</Label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="station">Mã trạm liên quan (không bắt buộc)</Label>
            <input
              id="station"
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
              placeholder="Ví dụ: STATION_02"
              className="flex h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Mô tả quan sát</Label>
            <textarea
              id="description"
              required
              minLength={10}
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Bạn nhìn thấy gì, ở đâu, và khi nào?"
              className="flex w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          {error ? (
            <p className="text-sm text-critical" role="alert">
              {error}
            </p>
          ) : null}
          <p className="text-xs leading-relaxed text-muted">
            Vị trí sẽ được dùng cho ngữ cảnh báo cáo. Nếu không cấp GPS, bạn có thể điền mã trạm để hệ thống đối chiếu.
          </p>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Đang gửi..." : "Gửi báo cáo"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
