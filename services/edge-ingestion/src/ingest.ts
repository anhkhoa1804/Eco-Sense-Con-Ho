import { signPayload } from "./canonical.js";
import type { DbPort } from "./dbPort.js";
import type { IngestRequest, IngestResponse, IngestionAuditLogRow, EnvironmentalEventRow, TelemetryPayloadV1 } from "./types.js";

export interface IngestConfig {
  allowedContractVersion: string;
  maxTimestampDriftSeconds: number;
  salinityWarningLevel?: number;
  salinityCriticalLevel?: number;
  lowBatteryVoltage?: number;
  lowSignalStrengthDbm?: number;
}

function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

function hasRequiredFields(payload: TelemetryPayloadV1): boolean {
  return Boolean(
    payload.contract_version &&
      payload.device_id &&
      payload.message_id &&
      Number.isFinite(payload.timestamp) &&
      payload.firmware_version &&
      payload.sensor_status?.ec_probe &&
      payload.sensor_status?.ultrasonic &&
      Number.isFinite(payload.salinity) &&
      Number.isFinite(payload.water_level) &&
      Number.isFinite(payload.fault_flags) &&
      Number.isFinite(payload.battery_voltage) &&
      Number.isFinite(payload.signal_strength_dbm),
  );
}

function isFaulty(payload: TelemetryPayloadV1): boolean {
  if (payload.fault_flags > 0) {
    return true;
  }

  return payload.sensor_status.ec_probe === "fault" || payload.sensor_status.ultrasonic === "fault";
}

function auditRow(payload: TelemetryPayloadV1, status: IngestionAuditLogRow["status"], reason: string, timestamp: number): IngestionAuditLogRow {
  return {
    message_id: payload.message_id ?? "",
    device_id: payload.device_id ?? "",
    status,
    reason,
    timestamp,
  };
}

async function emitAlertEvents(db: DbPort, payload: TelemetryPayloadV1, config: IngestConfig, nowEpochSeconds: number): Promise<void> {
  const salinityWarningLevel = config.salinityWarningLevel ?? 1.2;
  const salinityCriticalLevel = config.salinityCriticalLevel ?? 1.8;
  const lowBatteryVoltage = config.lowBatteryVoltage ?? 3.6;
  const lowSignalStrengthDbm = config.lowSignalStrengthDbm ?? -95;

  const events: EnvironmentalEventRow[] = [];

  if (payload.salinity >= salinityCriticalLevel) {
    events.push({
      station_id: payload.device_id,
      event_type: "HIGH_SALINITY",
      severity: "critical",
      message_id: payload.message_id,
      details: { salinity: payload.salinity, threshold: salinityCriticalLevel },
      timestamp: nowEpochSeconds,
    });
  } else if (payload.salinity >= salinityWarningLevel) {
    events.push({
      station_id: payload.device_id,
      event_type: "HIGH_SALINITY",
      severity: "warning",
      message_id: payload.message_id,
      details: { salinity: payload.salinity, threshold: salinityWarningLevel },
      timestamp: nowEpochSeconds,
    });
  }

  if (payload.battery_voltage < lowBatteryVoltage) {
    events.push({
      station_id: payload.device_id,
      event_type: "LOW_BATTERY",
      severity: "warning",
      message_id: payload.message_id,
      details: { battery_voltage: payload.battery_voltage, threshold: lowBatteryVoltage },
      timestamp: nowEpochSeconds,
    });
  }

  if (payload.signal_strength_dbm < lowSignalStrengthDbm) {
    events.push({
      station_id: payload.device_id,
      event_type: "OFFLINE",
      severity: "info",
      message_id: payload.message_id,
      details: { signal_strength_dbm: payload.signal_strength_dbm, threshold: lowSignalStrengthDbm },
      timestamp: nowEpochSeconds,
    });
  }

  for (const event of events) {
    await db.insertEvent(event);
  }
}

export async function ingestTelemetry(
  request: IngestRequest,
  db: DbPort,
  config: IngestConfig,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
): Promise<IngestResponse> {
  try {
    const payload = request.payload;

    if (!hasRequiredFields(payload)) {
      await db.insertAuditLog(auditRow(payload, "missing_field", "required field missing", nowEpochSeconds));
      return { ok: false, error_code: "MISSING_FIELD", message: "required field missing", retryable: false };
    }

    if (payload.contract_version !== config.allowedContractVersion) {
      await db.insertAuditLog(auditRow(payload, "contract_mismatch", "unsupported contract version", nowEpochSeconds));
      return { ok: false, error_code: "MISSING_FIELD", message: "unsupported contract version", retryable: false };
    }

    const knownSecret = await db.getDeviceSecret(payload.device_id);
    if (!knownSecret) {
      await db.insertAuditLog(auditRow(payload, "device_not_registered", "unknown device", nowEpochSeconds));
      return { ok: false, error_code: "DEVICE_NOT_REGISTERED", message: "unknown device", retryable: false };
    }

    const expectedSig = await signPayload(payload, knownSecret);
    if (expectedSig !== request.headers["x-signature"]) {
      await db.insertAuditLog(auditRow(payload, "invalid_signature", "signature verification failed", nowEpochSeconds));
      return { ok: false, error_code: "INVALID_SIGNATURE", message: "signature verification failed", retryable: false };
    }

    const headerTimestamp = Number.parseInt(request.headers["x-timestamp"], 10);
    const isHeaderValid = !Number.isNaN(headerTimestamp) && Math.abs(nowEpochSeconds - headerTimestamp) <= config.maxTimestampDriftSeconds;
    const isPayloadValid = Math.abs(nowEpochSeconds - payload.timestamp) <= config.maxTimestampDriftSeconds;

    if (!isHeaderValid || !isPayloadValid) {
      const reason = !isHeaderValid ? "header timestamp is outside allowed drift window" : "payload timestamp is outside allowed drift window";
      await db.insertAuditLog(auditRow(payload, "expired_timestamp", reason, nowEpochSeconds));
      return {
        ok: false,
        error_code: "TIMESTAMP_OUT_OF_WINDOW",
        message: reason,
        retryable: false,
      };
    }

    if (
      !inRange(payload.salinity, 0, 50) ||
      !inRange(payload.water_level, -100, 1000) ||
      !inRange(payload.battery_voltage, 2.5, 5.5) ||
      !inRange(payload.signal_strength_dbm, -130, -30)
    ) {
      await db.insertAuditLog(auditRow(payload, "value_out_of_range", "value out of accepted range", nowEpochSeconds));
      return { ok: false, error_code: "VALUE_OUT_OF_RANGE", message: "value out of accepted range", retryable: false };
    }

    if (isFaulty(payload)) {
      await db.insertAuditLog(auditRow(payload, "sensor_fault", "sensor fault reported by node", nowEpochSeconds));
      await db.insertEvent({
        station_id: payload.device_id,
        event_type: "SENSOR_FAULT",
        severity: "critical",
        message_id: payload.message_id,
        details: { fault_flags: payload.fault_flags, sensor_status: payload.sensor_status },
        timestamp: nowEpochSeconds,
      });
      return { ok: false, error_code: "SENSOR_FAULT", message: "sensor fault reported by node", retryable: false };
    }

    const status = await db.insertEnvironmental({
      message_id: payload.message_id,
      station_id: payload.device_id,
      salinity: payload.salinity,
      water_level: payload.water_level,
      fault_flags: payload.fault_flags,
      ec_probe_status: payload.sensor_status.ec_probe,
      ultrasonic_status: payload.sensor_status.ultrasonic,
      timestamp: payload.timestamp,
    });

    if (status === "inserted") {
      await db.insertHealth({
        station_id: payload.device_id,
        battery_voltage: payload.battery_voltage,
        signal_strength_dbm: payload.signal_strength_dbm,
        firmware_version: payload.firmware_version,
        timestamp: payload.timestamp,
      });
      await db.touchDeviceSeen(payload.device_id, payload.firmware_version, nowEpochSeconds);
      await emitAlertEvents(db, payload, config, nowEpochSeconds);
      await db.insertAuditLog(auditRow(payload, "accepted", "payload inserted", nowEpochSeconds));
    } else {
      await db.insertAuditLog(auditRow(payload, "duplicate", "duplicate message_id ignored", nowEpochSeconds));
    }

    const ota = await db.getActiveOta(payload.device_id);

    return {
      ok: true,
      status,
      station_id: payload.device_id,
      message_id: payload.message_id,
      server_timestamp: nowEpochSeconds,
      ota,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    await db.insertAuditLog({
      message_id: request.payload.message_id ?? "",
      device_id: request.payload.device_id ?? "",
      status: "internal_error",
      reason: message,
      timestamp: nowEpochSeconds,
    }).catch(() => undefined);
    return { ok: false, error_code: "INTERNAL_ERROR", message, retryable: true };
  }
}
