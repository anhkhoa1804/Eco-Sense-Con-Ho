export type SensorStatusValue = "ok" | "warn" | "fault";

export interface SensorStatus {
  ec_probe: SensorStatusValue;
  ultrasonic: SensorStatusValue;
}

export interface CalibrationInfo {
  k_value?: number;
  last_calibrated_at?: number;
}

export interface TelemetryPayloadV1 {
  contract_version: "v1";
  device_id: string;
  message_id: string;
  timestamp: number;
  salinity: number;
  water_level: number;
  fault_flags: number;
  sensor_status: SensorStatus;
  battery_voltage: number;
  signal_strength_dbm: number;
  firmware_version: string;
  temperature_c?: number;
  calibration?: CalibrationInfo;
}

export interface IngestHeaders {
  "x-device-id": string;
  "x-timestamp": string;
  "x-signature": string;
  "x-contract-version": string;
}

export interface IngestRequest {
  headers: IngestHeaders;
  payload: TelemetryPayloadV1;
}

export interface OtaInfo {
  update_available: boolean;
  target_version?: string;
  binary_url?: string;
  sha256?: string;
  size_bytes?: number;
}

export interface IngestSuccess {
  ok: true;
  status: "inserted" | "duplicate_ignored";
  station_id: string;
  message_id: string;
  server_timestamp: number;
  ota: OtaInfo;
}

export interface IngestFailure {
  ok: false;
  error_code:
    | "MISSING_FIELD"
    | "INVALID_SIGNATURE"
    | "TIMESTAMP_OUT_OF_WINDOW"
    | "DEVICE_NOT_REGISTERED"
    | "VALUE_OUT_OF_RANGE"
    | "SENSOR_FAULT"
    | "INTERNAL_ERROR";
  message: string;
  retryable: boolean;
}

export type IngestResponse = IngestSuccess | IngestFailure;

export interface EnvironmentalReadingRow {
  message_id: string;
  station_id: string;
  salinity: number;
  water_level: number;
  fault_flags: number;
  ec_probe_status: SensorStatusValue;
  ultrasonic_status: SensorStatusValue;
  timestamp: number;
}

export interface EnvironmentalEventRow {
  station_id: string;
  event_type: "HIGH_SALINITY" | "SENSOR_FAULT" | "LOW_BATTERY" | "OFFLINE";
  severity: "info" | "warning" | "critical";
  message_id?: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

export interface StationHealthRow {
  station_id: string;
  battery_voltage: number;
  signal_strength_dbm: number;
  firmware_version: string;
  timestamp: number;
}

export interface IngestionAuditLogRow {
  message_id: string;
  device_id: string;
  status:
    | "accepted"
    | "duplicate"
    | "invalid_signature"
    | "expired_timestamp"
    | "sensor_fault"
    | "device_not_registered"
    | "value_out_of_range"
    | "missing_field"
    | "contract_mismatch"
    | "internal_error";
  reason: string;
  timestamp: number;
}
