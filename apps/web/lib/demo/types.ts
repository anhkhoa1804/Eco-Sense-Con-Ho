/**
 * Demo/synthetic data shapes — local-only, for visual prototyping when the
 * real network has no telemetry. Every field here is scoped to a metric
 * already verified as a real firmware/backend capability (see the
 * capability matrix in the Phase A audit) — this file does not invent new
 * dimensions "because dashboards usually have them."
 *
 * Nothing in this module may use a real STATION_0x identity — see
 * observatoryDemoData.ts's own comment for why.
 */

export type DemoStationKind = "water" | "soil" | "gateway";

export interface DemoStationSnapshot {
  id: string;
  kind: DemoStationKind;
  label: string;
  observedAt: string;
  salinity?: number | null;
  waterLevel?: number | null;
  soilMoisturePct?: number | null;
  soilTempC?: number | null;
  soilEcMsCm?: number | null;
  soilPh?: number | null;
  airTempC?: number | null;
  airHumidityPct?: number | null;
  /** Demo only — real firmware never populates these today (see Phase A audit). Never render without an explicit demo label. */
  batteryVoltage?: number | null;
  signalStrengthDbm?: number | null;
}

export interface DemoTrendPoint {
  timestamp: string;
  salinity?: number;
  waterLevel?: number;
}

export interface DemoTrendSeries {
  stationLabel: string;
  points: DemoTrendPoint[];
}

export type DemoAlertSeverity = "info" | "warning" | "critical";

export interface DemoAlert {
  id: string;
  stationLabel: string;
  severity: DemoAlertSeverity;
  title: string;
  message: string;
  timestamp: string;
}

export interface DemoEnvironmentPoint {
  date: string;
  tideLevel?: number | null;
  salinity?: number | null;
}
