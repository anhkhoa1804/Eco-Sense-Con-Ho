import type * as React from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  cta?: React.ReactNode;
}

export function EmptyState({ title, description, cta }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-6 text-center shadow-xs sm:p-8">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-background text-accent">
        <span className="text-xl" aria-hidden>
          •
        </span>
      </div>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted">{description}</p>
      {cta && <div className="mt-5 flex justify-center">{cta}</div>}
    </div>
  );
}
