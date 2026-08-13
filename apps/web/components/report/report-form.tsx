"use client";

import Link from "next/link";
import { MapPin, ImagePlus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const CATEGORIES = [
  { value: "erosion", label: "Xói lở bờ sông" },
  { value: "flooding", label: "Ngập lụt / thủy triều" },
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
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; demo: boolean } | null>(null);

  async function handleGetLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Trình duyệt không hỗ trợ định vị.");
      return;
    }

    setLocating(true);
    setError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          maximumAge: 60000,
          enableHighAccuracy: true,
        });
      });
      setLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    } catch {
      setError("Không thể lấy vị trí. Vui lòng cấp quyền hoặc thử lại.");
    } finally {
      setLocating(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const res = await fetch("/api/public/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        description,
        lat: location?.lat,
        lng: location?.lng,
        stationId: stationId.trim() || undefined,
      }),
    });

    const response = (await res.json()) as { ok?: boolean; id?: string; demo?: boolean };
    setLoading(false);

    if (!res.ok) {
      setError("Không thể gửi báo cáo. Vui lòng thử lại sau.");
      return;
    }

    setResult({ id: response.id ?? "đã-gửi", demo: response.demo === true });
    setDescription("");
    setLocation(null);
  }

  if (result) {
    return (
      <div className="space-y-6 rounded-xl bg-background">
        <div className="space-y-3">
          <Badge variant={result.demo ? "watch" : "healthy"} className="w-fit">
            {result.demo ? "Đã lưu tạm" : "Đã gửi"}
          </Badge>
          <h3 className="text-3xl font-semibold tracking-tight">Cảm ơn bạn</h3>
          {result.demo ? (
            <p className="max-w-2xl text-sm leading-relaxed text-muted">
              Hệ thống hiện chưa kết nối được tới cơ sở dữ liệu chính, nên báo cáo của bạn đang được lưu tạm trên máy
              chủ này thay vì lưu trong Supabase. Nội dung bạn gửi là thật và sẽ được đội vận hành xem, nhưng có thể
              không được giữ lâu dài — vui lòng gửi lại khi hệ thống kết nối ổn định nếu vấn đề vẫn còn.
            </p>
          ) : (
            <p className="max-w-2xl text-sm leading-relaxed text-muted">
              Báo cáo của bạn đã được ghi nhận trong cơ sở dữ liệu. Chúng tôi sẽ dùng nó để bổ sung ngữ cảnh cho mạng
              lưới quan trắc.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-3 rounded-lg bg-muted/25 px-5 py-5">
          <p className="text-sm text-muted">Tham chiếu: <span className="font-medium text-foreground">{result.id}</span></p>
          <p className="text-sm text-muted">Trạng thái: chờ xem xét</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/dashboard">Về bảng quan trắc</Link>
          </Button>
          <Button variant="outline" onClick={() => setResult(null)}>
            Gửi báo cáo khác
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.22em] text-accent">Field report</p>
        <h3 className="text-3xl font-semibold tracking-tight">Ghi nhận một thay đổi trên đảo.</h3>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Ghi ngắn, rõ và đủ ngữ cảnh. Nếu không có GPS, bạn vẫn có thể gửi báo cáo bằng cách nhập mã trạm liên quan.
        </p>
      </div>

      <div className="space-y-3">
        <Label id="category-label" className="text-sm font-medium">Loại hiện trạng</Label>
        <div role="radiogroup" aria-labelledby="category-label" className="flex flex-wrap gap-2">
          {CATEGORIES.map((item) => {
            const active = category === item.value;
            return (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setCategory(item.value)}
                className={cn(
                  "rounded-full px-4 py-3 text-sm font-medium transition-colors duration-[var(--motion-base)]",
                  active
                    ? "bg-accent/10 text-accent"
                    : "bg-muted/25 text-foreground hover:bg-muted/40",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">Vị trí hiện trường</Label>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleGetLocation}
            disabled={locating || loading}
            className="h-12 rounded-full px-5"
          >
            <MapPin className={cn("h-4 w-4", locating && "animate-pulse")} />
            {locating ? "Đang định vị..." : location ? "Đã lấy vị trí GPS" : "Lấy vị trí hiện tại"}
          </Button>
          {location && (
            <p className="text-sm text-muted">
              {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
            </p>
          )}
        </div>
        <Input
          id="station"
          value={stationId}
          onChange={(e) => setStationId(e.target.value)}
          placeholder="Không có GPS? Nhập mã trạm gần nhất, ví dụ STATION_02"
          className="h-12 rounded-full bg-background px-5 text-sm"
          aria-label="Mã trạm liên quan"
          aria-invalid={!!error}
          aria-describedby={error ? "form-error" : undefined}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="description" className="text-sm font-medium">
            Mô tả quan sát
          </Label>
          <span className="text-xs uppercase tracking-[0.14em] text-muted">Bắt buộc</span>
        </div>
        <Textarea
          id="description"
          required
          minLength={10}
          rows={6}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Bạn nhìn thấy gì, ở đâu, và khi nào?"
          className="min-h-[180px] rounded-lg bg-background px-5 py-4 text-base"
          aria-invalid={!!error}
          aria-describedby={error ? "form-error" : undefined}
        />
      </div>

      <div className="flex items-start gap-3 rounded-lg bg-muted/10 px-5 py-4">
        <ImagePlus className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
        <p className="text-sm text-muted">
          Chưa hỗ trợ đính kèm ảnh — hãy mô tả càng cụ thể càng tốt (vị trí, hiện trạng, mức độ) để thay thế.
        </p>
      </div>

      {location ? (
        <div className="rounded-lg bg-muted/20 px-5 py-4 text-sm text-muted">
          <p className="font-medium text-foreground">Xem trước vị trí</p>
          <p className="mt-1">
            Báo cáo hiện được ghim tại {location.lat.toFixed(4)}, {location.lng.toFixed(4)}.
          </p>
        </div>
      ) : null}

      {error ? (
        <p id="form-error" className="text-sm text-critical" role="alert">
          {error}
        </p>
      ) : null}

      <p className="text-xs leading-relaxed text-muted">
        Vị trí sẽ được dùng cho ngữ cảnh báo cáo. Nếu không cấp GPS, bạn có thể điền mã trạm để hệ thống đối chiếu.
      </p>

      <div className="sticky bottom-4 z-20 -mx-4 bg-background/90 px-4 pb-2 pt-4 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0">
        <Button
          type="submit"
          className="h-14 w-full rounded-full text-base"
          disabled={loading || locating}
        >
          {loading ? "Đang gửi..." : "Gửi báo cáo"}
        </Button>
      </div>
    </form>
  );
}
