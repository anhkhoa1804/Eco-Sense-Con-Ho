import type * as React from "react";
import { cn } from "@/lib/cn";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-xl bg-muted/50", className)} {...props} />;
}
