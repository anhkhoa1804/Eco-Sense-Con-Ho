import { cn } from "@/lib/utils";
import { StatusIndicator, type FreshnessState } from "@/components/ui/status-indicator";

interface MetricProps {
  label: string;
  value: string | number | null;
  unit?: string;
  status?: FreshnessState;
  detail?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const valueSize: Record<NonNullable<MetricProps["size"]>, string> = {
  sm: "text-xl",
  md: "text-2xl md:text-3xl",
  lg: "text-4xl md:text-5xl",
};

/** The single primitive for every numeric readout in the product — value + unit + label + provenance. */
export function Metric({ label, value, unit, status, detail, size = "md", className }: MetricProps) {
  const hasValue = value !== null && value !== undefined && value !== "";

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className={cn("font-semibold tracking-tight tabular-nums", valueSize[size])}>
        {hasValue ? value : "—"}
        {hasValue && unit ? <span className="ml-1 text-base font-normal text-muted">{unit}</span> : null}
      </p>
      {status ? <StatusIndicator status={status} detail={detail} compact /> : null}
    </div>
  );
}
