"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PublicShell } from "@/components/layout/public-shell";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PublicShell activePath="/dashboard">
      <Alert tone="critical">
        <h2 className="text-h1 font-semibold tracking-tight">Không thể tải bảng quan trắc</h2>
        <p className="mt-2 text-muted">Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại sau.</p>
        <Button className="mt-4" onClick={reset}>
          Tải lại
        </Button>
      </Alert>
    </PublicShell>
  );
}
