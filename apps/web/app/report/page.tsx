import { Suspense } from "react";
import { PageHero } from "@/components/layout/page-hero";
import { PublicShell } from "@/components/layout/public-shell";
import { ReportForm } from "@/components/report/report-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getI18n } from "@/lib/i18n/server";

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

export default async function ReportPage() {
  const { dict } = await getI18n();

  return (
    <PublicShell activePath="/report">
      {/*
        Progress/step context lives in the form's own rail rather than in a
        separate list of promises about what happens next — there is no
        public review or tracking workflow to promise.
      */}
      {/* Same grammar as About and Monitoring, and no `actions`: this page's
          call to action is the form immediately below it. A button in the
          hero here would only scroll the reader to something already on
          screen. The copy was also hardcoded Vietnamese and never
          translated — it now comes from the dictionary like every other
          hero. */}
      <PageHero
        scale="observatory"
        eyebrow={dict.report.eyebrow}
        title={dict.report.title}
        subtitle={dict.report.lead}
      />

      <section>
        <Suspense fallback={<ReportFallback />}>
          <ReportForm />
        </Suspense>
      </section>
    </PublicShell>
  );
}
