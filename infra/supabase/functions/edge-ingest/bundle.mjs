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
  const str = (v) => v !== void 0 && v !== null ? String(v) : "";
  const num = (v) => typeof v === "number" ? fmtNumber(v) : "";
  return [
    str(payload.device_id),
    str(payload.message_id),
    str(payload.timestamp),
    num(payload.salinity),
    num(payload.water_level),
    str(payload.fault_flags),
    str(payload.sensor_status?.ec_probe),
    str(payload.sensor_status?.ultrasonic),
    num(payload.battery_voltage),
    str(payload.signal_strength_dbm),
    str(payload.firmware_version),
    str(payload.contract_version)
  ].join("|");
}
function buildSoilCanonicalString(payload) {
  const str = (v) => v !== void 0 && v !== null ? String(v) : "";
  const num = (v) => typeof v === "number" ? fmtNumber(v) : "";
  const soil = payload.soil;
  return [
    str(payload.device_id),
    str(payload.message_id),
    str(payload.timestamp),
    "soil",
    num(soil?.air_temp_c),
    num(soil?.air_humidity_pct),
    num(soil?.soil_temp_c),
    num(soil?.soil_moisture_pct),
    num(soil?.soil_ec_ms_cm),
    num(soil?.soil_ph),
    str(payload.fault_flags),
    str(payload.firmware_version),
    str(payload.contract_version)
  ].join("|");
}
function selectCanonicalString(payload) {
  return payload.reading_kind === "soil" ? buildSoilCanonicalString(payload) : buildCanonicalString(payload);
}
async function signPayload(payload, deviceSecret) {
  const canonical = selectCanonicalString(payload);
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
function timingSafeEqualHex(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// src/ingest.ts
function inRange(value, min, max) {
  return value >= min && value <= max;
}
function readingKind(payload) {
  return payload.reading_kind === "soil" ? "soil" : "water";
}
function hasRequiredFields(payload) {
  const baseFieldsOk = Boolean(
    payload.contract_version && payload.device_id && payload.message_id && Number.isFinite(payload.timestamp) && payload.firmware_version && Number.isFinite(payload.fault_flags)
  );
  if (!baseFieldsOk) {
    return false;
  }
  if (readingKind(payload) === "soil") {
    const soil = payload.soil;
    if (!soil) {
      return false;
    }
    return [soil.air_temp_c, soil.air_humidity_pct, soil.soil_temp_c, soil.soil_moisture_pct, soil.soil_ec_ms_cm, soil.soil_ph].some(
      (v) => typeof v === "number" && Number.isFinite(v)
    );
  }
  return Boolean(
    payload.sensor_status?.ec_probe && payload.sensor_status?.ultrasonic && Number.isFinite(payload.salinity) && Number.isFinite(payload.water_level)
  );
}
function isFaulty(payload) {
  if (readingKind(payload) === "soil") {
    return false;
  }
  if (payload.fault_flags > 0) {
    return true;
  }
  return payload.sensor_status?.ec_probe === "fault" || payload.sensor_status?.ultrasonic === "fault";
}
function soilValuesInRange(payload) {
  const soil = payload.soil;
  if (!soil) {
    return false;
  }
  const checks = [
    [soil.air_temp_c, -10, 60],
    [soil.air_humidity_pct, 0, 100],
    [soil.soil_temp_c, -10, 60],
    [soil.soil_moisture_pct, 0, 100],
    [soil.soil_ec_ms_cm, 0, 20],
    [soil.soil_ph, 0, 14]
  ];
  return checks.every(([value, min, max]) => value === null || inRange(value, min, max));
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
  if (readingKind(payload) === "water" && typeof payload.salinity === "number") {
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
  }
  if (typeof payload.battery_voltage === "number" && payload.battery_voltage < lowBatteryVoltage) {
    events.push({
      station_id: payload.device_id,
      event_type: "LOW_BATTERY",
      severity: "warning",
      message_id: payload.message_id,
      details: { battery_voltage: payload.battery_voltage, threshold: lowBatteryVoltage },
      timestamp: nowEpochSeconds
    });
  }
  if (typeof payload.signal_strength_dbm === "number" && payload.signal_strength_dbm < lowSignalStrengthDbm) {
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
    const kind = readingKind(payload);
    if (!hasRequiredFields(payload)) {
      await db.insertAuditLog(auditRow(payload, "missing_field", "required field missing", nowEpochSeconds));
      return { ok: false, error_code: "MISSING_FIELD", message: "required field missing", retryable: false };
    }
    if (payload.contract_version !== config.allowedContractVersion) {
      await db.insertAuditLog(auditRow(payload, "contract_mismatch", "unsupported contract version", nowEpochSeconds));
      return { ok: false, error_code: "MISSING_FIELD", message: "unsupported contract version", retryable: false };
    }
    const headerContractVersion = request.headers["x-contract-version"];
    if (headerContractVersion && headerContractVersion !== payload.contract_version) {
      await db.insertAuditLog(auditRow(payload, "contract_mismatch", "x-contract-version header does not match payload.contract_version", nowEpochSeconds));
      return { ok: false, error_code: "MISSING_FIELD", message: "x-contract-version header does not match payload.contract_version", retryable: false };
    }
    const authenticatingDeviceId = request.headers["x-device-id"];
    if (!authenticatingDeviceId) {
      await db.insertAuditLog(auditRow(payload, "missing_field", "missing x-device-id header", nowEpochSeconds));
      return { ok: false, error_code: "MISSING_FIELD", message: "missing x-device-id header", retryable: false };
    }
    const knownSecret = await db.getDeviceSecret(authenticatingDeviceId);
    if (!knownSecret) {
      await db.insertAuditLog(auditRow(payload, "device_not_registered", "unknown or inactive authenticating device", nowEpochSeconds));
      return { ok: false, error_code: "DEVICE_NOT_REGISTERED", message: "unknown or inactive authenticating device", retryable: false };
    }
    const expectedSig = await signPayload(payload, knownSecret);
    if (!timingSafeEqualHex(expectedSig, request.headers["x-signature"] ?? "")) {
      await db.insertAuditLog(auditRow(payload, "invalid_signature", "signature verification failed", nowEpochSeconds));
      return { ok: false, error_code: "INVALID_SIGNATURE", message: "signature verification failed", retryable: false };
    }
    if (authenticatingDeviceId !== payload.device_id && !await db.isDeviceRegistered(payload.device_id)) {
      await db.insertAuditLog(auditRow(payload, "device_not_registered", "attributed station is not a known, active device", nowEpochSeconds));
      return { ok: false, error_code: "DEVICE_NOT_REGISTERED", message: "attributed station is not a known, active device", retryable: false };
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
        retryable: false
      };
    }
    const valuesInRange = kind === "soil" ? soilValuesInRange(payload) : inRange(payload.salinity, 0, 50) && inRange(payload.water_level, -100, 1e3) && (typeof payload.battery_voltage !== "number" || inRange(payload.battery_voltage, 2.5, 5.5)) && (typeof payload.signal_strength_dbm !== "number" || inRange(payload.signal_strength_dbm, -130, -30));
    if (!valuesInRange) {
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
    const status = kind === "soil" ? await db.insertSoilReading({
      message_id: payload.message_id,
      station_id: payload.device_id,
      air_temp_c: payload.soil?.air_temp_c ?? null,
      air_humidity_pct: payload.soil?.air_humidity_pct ?? null,
      soil_temp_c: payload.soil?.soil_temp_c ?? null,
      soil_moisture_pct: payload.soil?.soil_moisture_pct ?? null,
      soil_ec_ms_cm: payload.soil?.soil_ec_ms_cm ?? null,
      soil_ph: payload.soil?.soil_ph ?? null,
      fault_flags: payload.fault_flags,
      timestamp: payload.timestamp
    }) : await db.insertEnvironmental({
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
      try {
        if (typeof payload.battery_voltage === "number" || typeof payload.signal_strength_dbm === "number") {
          await db.insertHealth({
            station_id: payload.device_id,
            battery_voltage: payload.battery_voltage ?? null,
            signal_strength_dbm: payload.signal_strength_dbm ?? null,
            firmware_version: payload.firmware_version,
            timestamp: payload.timestamp
          });
        }
        await db.touchDeviceSeen(payload.device_id, payload.firmware_version, nowEpochSeconds);
        await emitAlertEvents(db, payload, config, nowEpochSeconds);
        await db.insertAuditLog(auditRow(payload, "accepted", "payload inserted", nowEpochSeconds));
      } catch (sideEffectError) {
        const message = sideEffectError instanceof Error ? sideEffectError.message : "unexpected error";
        await db.insertAuditLog(auditRow(payload, "accepted", `payload inserted; side effect failed: ${message}`, nowEpochSeconds)).catch(() => void 0);
      }
    } else {
      await db.insertAuditLog(auditRow(payload, "duplicate", "duplicate message_id ignored", nowEpochSeconds));
    }
    const ota = await db.getActiveOta(payload.device_id).catch(() => ({ update_available: false }));
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
  async isDeviceRegistered(deviceId) {
    const result = await this.request(
      "devices",
      "GET",
      void 0,
      `?device_id=eq.${encodeURIComponent(deviceId)}&select=status&limit=1`
    );
    if (!result.ok) {
      return false;
    }
    const rows = JSON.parse(result.text);
    if (!Array.isArray(rows) || rows.length === 0) {
      return false;
    }
    return !rows[0].status || rows[0].status === "active";
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
  async insertSoilReading(row) {
    const result = await this.request("soil_readings", "POST", {
      message_id: row.message_id,
      station_id: row.station_id,
      air_temp_c: row.air_temp_c,
      air_humidity_pct: row.air_humidity_pct,
      soil_temp_c: row.soil_temp_c,
      soil_moisture_pct: row.soil_moisture_pct,
      soil_ec_ms_cm: row.soil_ec_ms_cm,
      soil_ph: row.soil_ph,
      fault_flags: row.fault_flags,
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
