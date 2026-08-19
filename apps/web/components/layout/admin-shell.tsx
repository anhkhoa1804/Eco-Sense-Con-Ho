import type * as React from "react";
import { cn } from "@/lib/utils";
import { SiteHeader } from "@/components/layout/site-header";

interface AdminShellProps {
  email?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Admin's register of the one shared header system (SiteHeader) — same
 * brand shell as public, unmistakably operational context via the "／
 * Quản trị" label instead of public nav. No footer here: a dense
 * operational console, not a marketing surface (§4 explicitly allows
 * "minimal footer or none" for admin).
 */
export function AdminShell({ email, actions, children, className }: AdminShellProps) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader register="admin" adminEmail={email} adminActions={actions} />
      <main className={cn("mx-auto max-w-[var(--width-content-wide)] space-y-6 px-4 py-6", className)}>{children}</main>
    </div>
  );
}
