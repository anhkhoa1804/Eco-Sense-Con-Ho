import { Suspense } from "react";
import { PublicShell } from "@/components/layout/public-shell";
import { ReportForm } from "@/components/report/report-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function ReportFallback() {
  return <Skeleton className="h-96 w-full max-w-lg" />;
}

export default function ReportPage() {
  return (
    <PublicShell activePath="/report">
      <section className="mb-6 max-w-3xl">
        <p className="mb-3 text-xs uppercase tracking-[0.18em] text-accent">Báo cáo hiện trường</p>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Ghi nhận quan sát về môi trường mà không cần tài khoản</h2>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          Báo cáo của bạn giúp theo dõi xói lở, ngập nước, ô nhiễm và các dấu hiệu bất thường khác trên Cồn Hô.
        </p>
      </section>

      <section className="mb-8 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Vì sao nên báo cáo?</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted">
            Báo cáo giúp cộng đồng nhìn thấy sớm những thay đổi tại bờ sông, khu dân cư và khu du lịch.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quyền riêng tư</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted">
            Không cần tài khoản. Vị trí chỉ dùng cho ngữ cảnh báo cáo và phục vụ việc đối chiếu hiện trường.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sau khi gửi</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted">
            Báo cáo sẽ được xem xét trước khi chuyển sang quy trình xử lý hoặc xác minh tiếp theo.
          </CardContent>
        </Card>
      </section>

      <div className="max-w-lg">
        <Suspense fallback={<ReportFallback />}>
          <ReportForm />
        </Suspense>
      </div>
    </PublicShell>
  );
}
