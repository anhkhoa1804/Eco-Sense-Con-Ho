import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  unit: string;
  status: "healthy" | "watch" | "risk" | "offline" | "fault";
  statusLabel: string;
  freshness: string;
  trend?: string;
  className?: string;
}

export function MetricCard({
  label,
  value,
  unit,
  status,
  statusLabel,
  freshness,
  trend,
  className,
}: MetricCardProps) {
  const statusVariant = status;

  return (
    <div
      className={cn("space-y-3", className)}
      role="region"
      aria-label={`${label}, value ${value} ${unit}, status ${statusLabel}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <Badge variant={statusVariant}>{statusLabel}</Badge>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-4xl font-semibold tracking-tight tabular-nums md:text-5xl">{value}</span>
        <span className="text-xl font-medium text-muted-foreground md:text-2xl">{unit}</span>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <p>{freshness}</p>
        {trend && <span className="h-px w-8 bg-border" aria-hidden />}
        {trend && <p className="font-medium text-accent">{trend}</p>}
      </div>
    </div>
  );
}
