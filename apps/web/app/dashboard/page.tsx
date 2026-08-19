import Link from "next/link";
import { Suspense } from "react";
import { FlaskConical } from "lucide-react";
import { getObservatoryViewModel } from "@/lib/monitoring/buildObservatory";
import { ObservatoryCanvas } from "@/components/monitoring/observatory-canvas";
import { PublicShell } from "@/components/layout/public-shell";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { Button } from "@/components/ui/button";
import DashboardLoading from "./loading";

export const revalidate = 60;

// Demo mode: ?mode=demo. Never activated silently — it takes an explicit,
// visible query param, defaults to real, makes no repository calls
// (buildDemoObservatory() is pure local data), and carries no persistent
// state. It exists for design review, presentations, and visual QA of what
// the observatory looks like with telemetry flowing; the canvas renders an
// unmissable banner whenever it is active.
function resolveMode(raw: string | string[] | undefined): "real" | "demo" {
  return raw === "demo" ? "demo" : "real";
}

async function MonitoringContent({ mode }: { mode: "real" | "demo" }) {
  const model = await getObservatoryViewModel(mode);
  return <ObservatoryCanvas model={model} />;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const params = await searchParams;
  const mode = resolveMode(params.mode);

  return (
    <PublicShell activePath="/dashboard">
      {/* Deliberately tight above the canvas: at 1440×900 every pixel spent
          here pushes the three stations and the trend surface below the fold,
          which is the one thing this page must show immediately. */}
      <div className="space-y-6 py-3 md:py-5">
        <div className="space-y-4">
          <InstallPrompt />
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">Quan trắc trực tiếp</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Đài quan trắc</h1>
                {mode === "demo" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-sm bg-watch-bg px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-watch">
                    <FlaskConical className="h-3 w-3" aria-hidden />
                    Dữ liệu minh họa
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" size="sm">
                <Link href="/report">Gửi báo cáo hiện trường</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/about">Về dự án</Link>
              </Button>
            </div>
          </div>
        </div>

        <Suspense fallback={<DashboardLoading />}>
          <MonitoringContent mode={mode} />
        </Suspense>
      </div>
    </PublicShell>
  );
}
