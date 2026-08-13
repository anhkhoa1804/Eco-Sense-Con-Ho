import { Suspense } from "react";
import { CheckCircle2, Camera, MapPinned, ShieldCheck } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { ReportForm } from "@/components/report/report-form";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const steps = [
  { icon: MapPinned, title: "Định vị", desc: "GPS hoặc mã trạm giúp xác định vị trí báo cáo." },
  { icon: Camera, title: "Mô tả", desc: "Cho biết điều gì đã thay đổi và ở đâu." },
  { icon: ShieldCheck, title: "Xem xét", desc: "Báo cáo được kiểm tra trước khi xử lý." },
  { icon: CheckCircle2, title: "Xác nhận", desc: "Lưu lại mã tham chiếu để theo dõi sau." },
];

function ReportFallback() {
  return <Skeleton className="h-[640px] w-full rounded-xl" />;
}

export default function ReportPage() {
  return (
    <PublicShell activePath="/report">
      <section className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
        <div className="space-y-8">
          <div className="flex flex-wrap gap-2">
            <Badge variant="healthy">Ưu tiên di động</Badge>
            <Badge variant="default">Báo cáo hiện trường</Badge>
          </div>

          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.22em] text-accent">Khoa học công dân</p>
            <h2 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">
              Ghi nhận hiện trường như một ứng dụng di động cao cấp.
            </h2>
            <p className="max-w-2xl text-base leading-relaxed text-muted">
              Báo cáo ngắn, rõ và ưu tiên thao tác bằng một tay. Vị trí, mô tả, và xác nhận được trình bày theo nhịp đọc
              tự nhiên thay vì một biểu mẫu dài.
            </p>
          </div>

          <div className="grid gap-6 border-t border-border/60 pt-6 sm:grid-cols-2">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="flex gap-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">0{index + 1} · {step.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <Suspense fallback={<ReportFallback />}>
            <ReportForm />
          </Suspense>
        </div>
      </section>
    </PublicShell>
  );
}
