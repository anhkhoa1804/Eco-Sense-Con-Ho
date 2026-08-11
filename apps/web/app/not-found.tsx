import Link from "next/link";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <PublicShell>
      <EmptyState
        title="Không tìm thấy trang này"
        description="Đường dẫn không tồn tại hoặc trạm quan trắc đã được đổi mã. Quay lại bảng quan trắc để xem danh sách trạm hiện có."
        cta={
          <Button asChild>
            <Link href="/dashboard">Về bảng quan trắc</Link>
          </Button>
        }
      />
    </PublicShell>
  );
}
