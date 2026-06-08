"use client";

import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/layout/app-shell";

export default function StationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppShell activePath="/stations">
      <div className="rounded-2xl border border-critical/30 bg-critical/10 p-6">
        <h2 className="font-serif text-2xl">Station unavailable</h2>
        <p className="mt-2 text-muted">{error.message}</p>
        <Button className="mt-4" onClick={reset}>
          Retry
        </Button>
      </div>
    </AppShell>
  );
}
