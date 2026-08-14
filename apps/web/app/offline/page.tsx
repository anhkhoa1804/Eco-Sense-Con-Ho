import { Card } from "@/components/ui/card";

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Card className="max-w-md text-center">
        <h1 className="text-h1 font-semibold tracking-tight">Bạn đang ngoại tuyến</h1>
        <p className="mt-2 text-muted">Các trang đã tải trước vẫn có thể xem. Hãy kết nối lại để nhận dữ liệu mới.</p>
      </Card>
    </div>
  );
}
