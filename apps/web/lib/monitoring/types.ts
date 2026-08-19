import type { FreshnessState, QualityState } from "@/components/ui/status-indicator";
import type { DataProvenance } from "@/lib/dataState";
import type { StationKind } from "@/lib/stationProfile";

/**
 * One coherent observatory model — the Monitoring page never assembles
 * dozens of unrelated repository results itself. Both the real and demo
 * builders (buildObservatory.ts) return exactly this shape, so the canvas
 * components render identically regardless of mode; only the data (and its
 * per-field DataProvenance) differs. This is what makes "never mix real
 * salinity with demo battery inside the same station" enforceable — the
 * whole model carries one `mode`, not a per-field flag a component could
 * forget to check.
 */

export interface ObservatoryMetric {
  label: string;
  value: string | null;
  unit?: string;
  provenance: DataProvenance;
}

export interface ObservatoryEnvironmentGroup {
  /** "Đất" | "Không khí" | "Nước" — only groups structurally relevant to the station's kind are ever present. */
  label: string;
  metrics: ObservatoryMetric[];
}

export interface ObservatoryStation {
  id: string;
  kind: StationKind;
  name: string;
  location: string;
  lat: number;
  lng: number;
  freshness: FreshnessState;
  quality: QualityState | null;
  needsAttention: boolean;
  timestamp: string | null;
  /** The station's headline instrument reading. */
  primary: ObservatoryMetric;
  /** Kind-specific supporting readings, grouped by domain — never a uniform shape across water/soil/gateway. */
  environment: ObservatoryEnvironmentGroup[];
  /**
   * Battery/signal. Structurally separate from `environment` because its
   * real-mode behaviour differs in kind, not just value: no current firmware
   * populates these for a relayed station, so real mode always leaves this
   * empty and the UI shows one honest capability note instead of a row of
   * blanks. Demo mode fills it normally, always origin "demo".
   */
  device: ObservatoryMetric[];
  /**
   * Gateway only — a short statement of what this node does and what can
   * currently be known about it. Never a fabricated uptime/throughput.
   */
  capabilityNote: string | null;
}

// ---------------------------------------------------------------------------
// Observation log
// ---------------------------------------------------------------------------

/** Ranges backed by real repository methods — see buildObservatory for the mapping. */
export type TrendRange = "24h" | "7d" | "30d";

/**
 * Chartable metrics. Water metrics come from `environmental_readings`; the
 * six soil/air metrics come from `soil_readings` via getSoilTrend.
 *
 * A metric appearing here does not mean it will be offered — the series
 * declares `availableMetrics` per range, and the selector only renders
 * options that actually have values behind them.
 */
export type TrendMetric =
  | "salinity"
  | "waterLevel"
  | "soilMoisture"
  | "soilEc"
  | "soilPh"
  | "soilTemp"
  | "airTemp"
  | "airHumidity";

export interface ObservationPoint {
  /** Pre-formatted x-axis label — hour for 24h, date for 7d/30d. */
  label: string;
  salinity: number | null;
  waterLevel: number | null;
  soilMoisture: number | null;
  soilEc: number | null;
  soilPh: number | null;
  soilTemp: number | null;
  airTemp: number | null;
  airHumidity: number | null;
}

export interface ObservationSeries {
  points: ObservationPoint[];
  /** Metrics with at least one real value in this range — drives which toggles render. */
  availableMetrics: TrendMetric[];
  provenance: DataProvenance;
}

export interface ObservatoryAlert {
  id: string;
  stationName: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  timestamp: string;
  provenance: DataProvenance;
}

/**
 * A reference entry's evidentiary standing. Kept distinct from DataOrigin:
 * that describes where a *measurement* came from; this describes how well a
 * *guideline* is supported. Collapsing them would let an internal engineering
 * assumption inherit the visual authority of a cited standard.
 */
export type ReferenceStanding = "external" | "internal" | "unverified";

export interface ObservatoryReferenceItem {
  title: string;
  standing: ReferenceStanding;
  /** Threshold rows. Empty when no number can be responsibly shown. */
  rows: { range: string; meaning: string }[];
  /** Prose shown when rows are empty, or as a caveat alongside them. */
  detail: string;
  sourceLabel: string | null;
  sourceUrl: string | null;
}

export interface ObservatoryNetworkState {
  total: number;
  live: number;
  offline: number;
  noData: number;
  alertsNeedingAttention: number;
  /** Newest observation across the whole network, or null when nothing has ever arrived. */
  lastObservationAt: string | null;
  provenance: DataProvenance;
}

export interface ObservatoryViewModel {
  mode: "real" | "demo";
  network: ObservatoryNetworkState;
  stations: ObservatoryStation[];
  /** Precomputed for every range so switching is instant and refetch-free. */
  series: Record<TrendRange, ObservationSeries>;
  alerts: ObservatoryAlert[];
  reference: ObservatoryReferenceItem[];
}
