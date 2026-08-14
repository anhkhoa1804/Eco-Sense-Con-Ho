import { Suspense } from "react";
import { CheckCircle2, Camera, MapPinned, ShieldCheck } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { ReportForm } from "@/components/report/report-form";
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
      {/*
        Mobile-first order: concise context → primary form → supporting steps
        (field users shouldn't scroll past explanation to reach the task).
        DOM order matches that directly; lg: placement re-composes into the
        original two-column layout for desktop via explicit grid position,
        not `order` — so the visual desktop result is unchanged.
      */}
      <section className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-x-12 lg:gap-y-8">
        <div className="space-y-4 lg:col-start-1 lg:row-start-1">
          <p className="text-eyebrow uppercase tracking-[0.22em] text-accent">Khoa học công dân</p>
          <h1 className="max-w-3xl text-h1 font-semibold tracking-tight">
            Ghi nhận hiện trường như một ứng dụng di động cao cấp.
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted">
            Báo cáo ngắn, rõ và ưu tiên thao tác bằng một tay. Vị trí, mô tả, và xác nhận được trình bày theo nhịp đọc
            tự nhiên thay vì một biểu mẫu dài.
          </p>
        </div>

        <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <Suspense fallback={<ReportFallback />}>
            <ReportForm />
          </Suspense>
        </div>

        <div className="grid gap-6 border-t border-border/60 pt-6 sm:grid-cols-2 lg:col-start-1 lg:row-start-2">
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
      </section>
    </PublicShell>
  );
}
