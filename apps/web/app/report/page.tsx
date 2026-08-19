import { Suspense } from "react";
import { PublicShell } from "@/components/layout/public-shell";
import { ReportForm } from "@/components/report/report-form";
import { Skeleton } from "@/components/ui/skeleton";

function ReportFallback() {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,0.26fr)_minmax(0,0.74fr)] lg:gap-16">
      <Skeleton className="h-40 w-full" />
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <PublicShell activePath="/report">
      {/*
        No explanatory hero: on mobile the reporter reaches the first real
        control within one screen. The old page opened with two competing
        headlines and three paragraphs describing the design itself before
        any field appeared. Progress/step context now lives in the form's own
        rail rather than in a separate list of promises about what happens
        next — there is no public review or tracking workflow to promise.
      */}
      <section className="space-y-10 py-2 md:py-6">
        <header className="max-w-2xl space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">Ghi nhận hiện trường</p>
          <h1 className="text-h1 font-semibold tracking-tight">Ghi nhận một thay đổi trên đảo.</h1>
          <p className="text-base leading-relaxed text-muted">
            Chọn trạm gần bạn nhất, mô tả điều bạn thấy, rồi gửi.
          </p>
        </header>

        <Suspense fallback={<ReportFallback />}>
          <ReportForm />
        </Suspense>
      </section>
    </PublicShell>
  );
}
