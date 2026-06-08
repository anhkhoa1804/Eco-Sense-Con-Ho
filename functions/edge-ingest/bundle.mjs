// src/config.ts
function resolveIngestConfig(env = process.env) {
  return {
    allowedContractVersion: env.DEFAULT_CONTRACT_VERSION ?? "v1",
    maxTimestampDriftSeconds: Number(env.MAX_TIMESTAMP_DRIFT_SECONDS ?? "300"),
    salinityWarningLevel: Number(env.SALINITY_WARNING_LEVEL ?? "1.2"),
    salinityCriticalLevel: Number(env.SALINITY_CRITICAL_LEVEL ?? "1.8"),
    lowBatteryVoltage: Number(env.LOW_BATTERY_VOLTAGE ?? "3.6"),
    lowSignalStrengthDbm: Number(env.LOW_SIGNAL_STRENGTH_DBM ?? "-95")
  };
}

// src/canonical.ts
function fmtNumber(value) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}
function buildCanonicalString(payload) {
  return [
    payload.device_id,
    payload.message_id,
    payload.timestamp.toString(),
    fmtNumber(payload.salinity),
    fmtNumber(payload.water_level),
    payload.fault_flags.toString(),
    payload.sensor_status.ec_probe,
    payload.sensor_status.ultrasonic,
    fmtNumber(payload.battery_voltage),
    payload.signal_strength_dbm.toString(),
    payload.firmware_version,
    payload.contract_version
  ].join("|");
}
async function signPayload(payload, deviceSecret) {
  const canonical = buildCanonicalString(payload);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(deviceSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(canonical));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// src/ingest.ts
function inRange(value, min, max) {
  return value >= min && value <= max;
}
function hasRequiredFields(payload) {
  return Boolean(
    payload.contract_version && payload.device_id && payload.message_id && Number.isFinite(payload.timestamp) && payload.firmware_version && payload.sensor_status?.ec_probe && payload.sensor_status?.ultrasonic
  );
}
function isFaulty(payload) {
  if (payload.fault_flags > 0) {
    return true;
  }
  return payload.sensor_status.ec_probe === "fault" || payload.sensor_status.ultrasonic === "fault";
}
function auditRow(payload, status, reason, timestamp) {
  return {
    message_id: payload.message_id ?? "",
    device_id: payload.device_id ?? "",
    status,
    reason,
    timestamp
  };
}
async function emitAlertEvents(db, payload, config, nowEpochSeconds) {
  const salinityWarningLevel = config.salinityWarningLevel ?? 1.2;
  const salinityCriticalLevel = config.salinityCriticalLevel ?? 1.8;
  const lowBatteryVoltage = config.lowBatteryVoltage ?? 3.6;
  const lowSignalStrengthDbm = config.lowSignalStrengthDbm ?? -95;
  const events = [];
  if (payload.salinity >= salinityCriticalLevel) {
    events.push({
      station_id: payload.device_id,
      event_type: "HIGH_SALINITY",
      severity: "critical",
      message_id: payload.message_id,
      details: { salinity: payload.salinity, threshold: salinityCriticalLevel },
      timestamp: nowEpochSeconds
    });
  } else if (payload.salinity >= salinityWarningLevel) {
    events.push({
      station_id: payload.device_id,
      event_type: "HIGH_SALINITY",
      severity: "warning",
      message_id: payload.message_id,
      details: { salinity: payload.salinity, threshold: salinityWarningLevel },
      timestamp: nowEpochSeconds
    });
  }
  if (payload.battery_voltage < lowBatteryVoltage) {
    events.push({
      station_id: payload.device_id,
      event_type: "LOW_BATTERY",
      severity: "warning",
      message_id: payload.message_id,
      details: { battery_voltage: payload.battery_voltage, threshold: lowBatteryVoltage },
      timestamp: nowEpochSeconds
    });
  }
  if (payload.signal_strength_dbm < lowSignalStrengthDbm) {
    events.push({
      station_id: payload.device_id,
      event_type: "OFFLINE",
      severity: "info",
      message_id: payload.message_id,
      details: { signal_strength_dbm: payload.signal_strength_dbm, threshold: lowSignalStrengthDbm },
      timestamp: nowEpochSeconds
    });
  }
  for (const event of events) {
    await db.insertEvent(event);
  }
}
async function ingestTelemetry(request, db, config, nowEpochSeconds = Math.floor(Date.now() / 1e3)) {
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
    if (Number.isNaN(headerTimestamp) || Math.abs(nowEpochSeconds - headerTimestamp) > config.maxTimestampDriftSeconds) {
      await db.insertAuditLog(auditRow(payload, "expired_timestamp", "timestamp is outside allowed drift window", nowEpochSeconds));
      return {
        ok: false,
        error_code: "TIMESTAMP_OUT_OF_WINDOW",
        message: "timestamp is outside allowed drift window",
        retryable: false
      };
    }
    if (!inRange(payload.salinity, 0, 50) || !inRange(payload.water_level, -100, 1e3) || !inRange(payload.battery_voltage, 2.5, 5.5) || !inRange(payload.signal_strength_dbm, -130, -30)) {
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
        timestamp: nowEpochSeconds
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
      timestamp: payload.timestamp
    });
    if (status === "inserted") {
      await db.insertHealth({
        station_id: payload.device_id,
        battery_voltage: payload.battery_voltage,
        signal_strength_dbm: payload.signal_strength_dbm,
        firmware_version: payload.firmware_version,
        timestamp: payload.timestamp
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
      ota
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    await db.insertAuditLog({
      message_id: request.payload.message_id ?? "",
      device_id: request.payload.device_id ?? "",
      status: "internal_error",
      reason: message,
      timestamp: nowEpochSeconds
    }).catch(() => void 0);
    return { ok: false, error_code: "INTERNAL_ERROR", message, retryable: true };
  }
}

// src/httpHandler.ts
function ingestResponseToHttp(result) {
  if (!result.ok) {
    const statusByCode = {
      MISSING_FIELD: 400,
      INVALID_SIGNATURE: 401,
      TIMESTAMP_OUT_OF_WINDOW: 400,
      DEVICE_NOT_REGISTERED: 404,
      VALUE_OUT_OF_RANGE: 400,
      SENSOR_FAULT: 422,
      INTERNAL_ERROR: 500
    };
    return { status: statusByCode[result.error_code], body: { ...result } };
  }
  return { status: 200, body: { ...result } };
}
async function handleIngestRequest(payload, headers, db, config, nowEpochSeconds = Math.floor(Date.now() / 1e3)) {
  const request = {
    headers: {
      "x-device-id": headers["x-device-id"] ?? "",
      "x-timestamp": headers["x-timestamp"] ?? "",
      "x-signature": headers["x-signature"] ?? "",
      "x-contract-version": headers["x-contract-version"] ?? ""
    },
    payload
  };
  const result = await ingestTelemetry(request, db, config, nowEpochSeconds);
  return ingestResponseToHttp(result);
}
async function handleIngestFromEnv(payload, headers, db, env, nowEpochSeconds = Math.floor(Date.now() / 1e3)) {
  return handleIngestRequest(payload, headers, db, resolveIngestConfig(env), nowEpochSeconds);
}

// src/supabaseDb.ts
var SupabaseDb = class _SupabaseDb {
  constructor(supabaseUrl, serviceRoleKey) {
    this.supabaseUrl = supabaseUrl;
    this.serviceRoleKey = serviceRoleKey;
  }
  static fromEnv(env = process.env) {
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Missing Supabase env vars");
    }
    return new _SupabaseDb(url.replace(/\/$/, ""), key);
  }
  async request(table, method, body, query = "") {
    const headers = {
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${this.serviceRoleKey}`,
      Accept: "application/json"
    };
    if (body !== void 0) {
      headers["Content-Type"] = "application/json";
    }
    const response = await fetch(`${this.supabaseUrl}/rest/v1/${table}${query}`, {
      method,
      headers,
      body: body === void 0 ? void 0 : JSON.stringify(body)
    });
    return { ok: response.ok, status: response.status, text: await response.text() };
  }
  async getDeviceSecret(deviceId) {
    const result = await this.request(
      "devices",
      "GET",
      void 0,
      `?device_id=eq.${encodeURIComponent(deviceId)}&select=device_secret,status&limit=1`
    );
    if (!result.ok) {
      return null;
    }
    const rows = JSON.parse(result.text);
    if (!Array.isArray(rows) || rows.length === 0) {
      return null;
    }
    if (rows[0].status && rows[0].status !== "active") {
      return null;
    }
    return rows[0].device_secret ?? null;
  }
  async insertEnvironmental(row) {
    const result = await this.request("environmental_readings", "POST", {
      message_id: row.message_id,
      station_id: row.station_id,
      salinity: row.salinity,
      water_level: row.water_level,
      fault_flags: row.fault_flags,
      ec_probe_status: row.ec_probe_status,
      ultrasonic_status: row.ultrasonic_status,
      timestamp: new Date(row.timestamp * 1e3).toISOString()
    });
    if (result.ok) {
      return "inserted";
    }
    if (result.status === 409 || result.text.includes("duplicate") || result.text.includes("23505")) {
      return "duplicate_ignored";
    }
    throw new Error(result.text || `insert failed with status ${result.status}`);
  }
  async insertEvent(row) {
    const result = await this.request("environmental_events", "POST", {
      station_id: row.station_id,
      event_type: row.event_type,
      severity: row.severity,
      message_id: row.message_id,
      details: row.details ?? {},
      timestamp: new Date(row.timestamp * 1e3).toISOString()
    });
    if (!result.ok) {
      throw new Error(result.text || `event insert failed with status ${result.status}`);
    }
  }
  async insertAuditLog(row) {
    await this.request("ingestion_audit_logs", "POST", {
      message_id: row.message_id,
      device_id: row.device_id,
      status: row.status,
      reason: row.reason,
      timestamp: new Date(row.timestamp * 1e3).toISOString()
    }).catch(() => void 0);
  }
  async insertHealth(row) {
    const result = await this.request("station_health_logs", "POST", {
      station_id: row.station_id,
      battery_voltage: row.battery_voltage,
      signal_strength_dbm: row.signal_strength_dbm,
      firmware_version: row.firmware_version,
      timestamp: new Date(row.timestamp * 1e3).toISOString()
    });
    if (!result.ok) {
      throw new Error(result.text || `health insert failed with status ${result.status}`);
    }
  }
  async touchDeviceSeen(deviceId, firmwareVersion, seenAt) {
    await this.request(
      "devices",
      "PATCH",
      { last_seen_at: new Date(seenAt * 1e3).toISOString(), firmware_version: firmwareVersion },
      `?device_id=eq.${encodeURIComponent(deviceId)}`
    ).catch(() => void 0);
  }
  async getActiveOta(deviceId) {
    const result = await this.request(
      "firmware_updates",
      "GET",
      void 0,
      `?device_id=eq.${encodeURIComponent(deviceId)}&active=eq.true&select=target_version,binary_url,sha256,size_bytes&limit=1`
    );
    if (!result.ok) {
      return { update_available: false };
    }
    const rows = JSON.parse(result.text);
    if (!Array.isArray(rows) || rows.length === 0) {
      return { update_available: false };
    }
    return {
      update_available: true,
      target_version: rows[0].target_version,
      binary_url: rows[0].binary_url,
      sha256: rows[0].sha256,
      size_bytes: rows[0].size_bytes
    };
  }
};

// src/edgeEntry.ts
async function processIngestHttp(payload, headers, env, nowEpochSeconds = Math.floor(Date.now() / 1e3)) {
  const db = SupabaseDb.fromEnv(env);
  return handleIngestFromEnv(payload, headers, db, env, nowEpochSeconds);
}
export {
  processIngestHttp
};
