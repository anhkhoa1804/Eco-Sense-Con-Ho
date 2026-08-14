import type * as React from "react";
import { Wordmark } from "@/components/ui/wordmark";
import { cn } from "@/lib/utils";

interface AdminShellProps {
  email?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Visual frame for admin, matching PublicShell's header/wordmark/max-width
 * language (REDESIGN_SPECIFICATION.md §8/§9) — a genuinely different
 * audience so it gets its own max-width, not zero shell and not a second
 * visual grammar.
 */
export function AdminShell({ email, actions, children, className }: AdminShellProps) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-4 px-4 py-4">
          <div>
            <Wordmark title="Horizon · Vận hành" titleAs="h1" titleSize="lg" href="/admin" />
            {email ? <p className="mt-1 text-sm text-muted">{email}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </div>
      </header>
      <main className={cn("mx-auto max-w-6xl space-y-6 px-4 py-6", className)}>{children}</main>
    </div>
  );
}
