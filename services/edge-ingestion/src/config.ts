import type { IngestConfig } from "./ingest.js";

export function resolveIngestConfig(env: Record<string, string | undefined> = process.env): IngestConfig {
  return {
    allowedContractVersion: env.DEFAULT_CONTRACT_VERSION ?? "v1",
    maxTimestampDriftSeconds: Number(env.MAX_TIMESTAMP_DRIFT_SECONDS ?? "300"),
    salinityWarningLevel: Number(env.SALINITY_WARNING_LEVEL ?? "1.2"),
    salinityCriticalLevel: Number(env.SALINITY_CRITICAL_LEVEL ?? "1.8"),
    lowBatteryVoltage: Number(env.LOW_BATTERY_VOLTAGE ?? "3.6"),
    lowSignalStrengthDbm: Number(env.LOW_SIGNAL_STRENGTH_DBM ?? "-95"),
  };
}

export function parseDeviceSecretsJson(env: Record<string, string | undefined> = process.env): Record<string, string> {
  const raw = env.DEVICE_SECRETS_JSON ?? '{"STATION_01":"station-secret-01","STATION_02":"station-secret-02"}';
  return JSON.parse(raw) as Record<string, string>;
}
