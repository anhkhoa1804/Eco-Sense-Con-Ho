import { BookOpen, CircleDashed, FlaskConical, History, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { relativeTimeVi } from "@/components/ui/status-indicator";
import type { DataOrigin, DataProvenance } from "@/lib/dataState";

const ORIGIN_ICON: Record<DataOrigin, typeof Radio> = {
  telemetry: Radio,
  historical: History,
  reference: BookOpen,
  demo: FlaskConical,
  unavailable: CircleDashed,
};

/**
 * The text this renders is the actual honesty boundary — never invent a
 * citation here. "reference" with no `source` set renders the explicit
 * "chưa xác minh" fallback rather than a plausible-looking blank.
 */
function sourceLabel(provenance: DataProvenance): string {
  const { origin, source, observedAt } = provenance;

  switch (origin) {
    case "telemetry":
      return source ? `Nguồn: ${source}` : "Nguồn: Dữ liệu quan trắc trực tiếp";
    case "historical":
      return observedAt
        ? `Quan trắc lần cuối · ${relativeTimeVi(observedAt)}`
        : "Dữ liệu quan trắc trước đó";
    case "reference":
      return source ? `Nguồn tham chiếu: ${source}` : "Chưa có nguồn tham chiếu được xác minh.";
    case "demo":
      return "Nguồn: Dữ liệu minh họa";
    case "unavailable":
      return "Chưa có dữ liệu";
  }
}

const ORIGIN_TONE: Record<DataOrigin, string> = {
  telemetry: "text-healthy",
  historical: "text-muted",
  reference: "text-accent",
  demo: "text-watch",
  unavailable: "text-muted",
};

interface SourceNoteProps {
  provenance: DataProvenance;
  /** compact (default): icon + one line. expanded: adds sourceUrl / verifiedAt when present. */
  expanded?: boolean;
  className?: string;
}

/**
 * The one place that decides how a value's origin gets described in text.
 * Every component that shows a threshold, reference range, or demo value
 * should go through this rather than hand-writing its own "Nguồn: ..."
 * string, so the wording cannot drift between surfaces.
 */
export function SourceNote({ provenance, expanded = false, className }: SourceNoteProps) {
  const Icon = ORIGIN_ICON[provenance.origin];
  const label = sourceLabel(provenance);

  return (
    <div className={cn("inline-flex items-start gap-1.5", className)}>
      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", ORIGIN_TONE[provenance.origin])} aria-hidden />
      <div className="space-y-0.5">
        <p className={cn("text-xs font-medium", ORIGIN_TONE[provenance.origin])}>
          {provenance.sourceUrl && expanded ? (
            <a href={provenance.sourceUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
              {label}
            </a>
          ) : (
            label
          )}
        </p>
        {expanded && provenance.note ? <p className="text-xs text-muted">{provenance.note}</p> : null}
        {expanded && provenance.verifiedAt ? (
          <p className="text-xs text-muted">Kiểm tra lần cuối · {relativeTimeVi(provenance.verifiedAt)}</p>
        ) : null}
      </div>
    </div>
  );
}
