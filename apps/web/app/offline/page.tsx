export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Bạn đang ngoại tuyến</h1>
        <p className="mt-2 text-muted">Các trang đã tải trước vẫn có thể xem. Hãy kết nối lại để nhận dữ liệu mới.</p>
      </div>
    </div>
  );
}
