import type { FreshnessState } from "@/components/ui/status-indicator";

/**
 * Presentation-layer derivation only — NOT a new data model. Freshness and
 * quality remain the two independent axes defined in status-indicator.tsx
 * (see its own comment for why they're never merged); this answers one
 * narrower question — "which of a small number of visual treatments does a
 * measurement primitive use" — without inventing a competing state system.
 * Both source axes are still passed through and displayed by the caller;
 * this never discards information, only picks a rendering mode.
 *
 * FRONTEND_REBUILD_SPECIFICATION.md §9 defines the mapping this resolver
 * implements. It intentionally does not have an "error" mode: a reading can
 * be simultaneously fresh and faulty (QualityState is orthogonal), and that
 * fact is shown via QualityIndicator alongside the measurement, not by
 * overriding the measurement's own size/emphasis.
 */
export type MeasurementVisualState = "live" | "settled" | "stale" | "empty";

export function resolveMeasurementVisualState(
  freshness: FreshnessState,
  hasValue: boolean,
): MeasurementVisualState {
  if (!hasValue) return "empty";
  if (freshness === "live") return "live";
  if (freshness === "recent") return "settled";
  // stale | offline | never_connected | unavailable, but hasValue is true —
  // a real last reading exists, it's just not current. See §9's table:
  // "Real value, stale/offline" is one row, not four.
  return "stale";
}
