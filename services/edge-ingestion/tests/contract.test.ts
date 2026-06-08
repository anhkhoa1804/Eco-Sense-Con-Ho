import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { signPayload } from "../src/canonical.js";
import { ingestTelemetry } from "../src/ingest.js";
import { MockDb } from "../src/mockDb.js";
import type { IngestConfig } from "../src/ingest.js";
import type { IngestRequest, TelemetryPayloadV1 } from "../src/types.js";

const DEVICE_SECRET = "station-secret-01";
const NOW = 1_700_000_000;

const config: IngestConfig = {
  allowedContractVersion: "v1",
  maxTimestampDriftSeconds: 300,
  salinityWarningLevel: 1.2,
  salinityCriticalLevel: 1.8,
  lowBatteryVoltage: 3.6,
  lowSignalStrengthDbm: -95,
};

const otaCatalog = {
  STATION_01: { update_available: false },
};

function basePayload(overrides: Partial<TelemetryPayloadV1> = {}): TelemetryPayloadV1 {
  return {
    contract_version: "v1",
    device_id: "STATION_01",
    message_id: "contract-test-message-001",
    timestamp: NOW,
    salinity: 1.1,
    water_level: 50,
    fault_flags: 0,
    sensor_status: { ec_probe: "ok", ultrasonic: "ok" },
    battery_voltage: 3.9,
    signal_strength_dbm: -85,
    firmware_version: "1.0.2",
    ...overrides,
  };
}

async function buildRequest(payload: TelemetryPayloadV1, signature?: string): Promise<IngestRequest> {
  return {
    headers: {
      "x-device-id": payload.device_id,
      "x-timestamp": String(payload.timestamp),
      "x-signature": signature ?? await signPayload(payload, DEVICE_SECRET),
      "x-contract-version": payload.contract_version,
    },
    payload,
  };
}

describe("ingest contract", () => {
  it("accepts a valid signed payload", async () => {
    const db = new MockDb({ STATION_01: DEVICE_SECRET }, otaCatalog);
    const payload = basePayload();
    const response = await ingestTelemetry(await buildRequest(payload), db, config, NOW);

    assert.equal(response.ok, true);
    if (response.ok) {
      assert.equal(response.status, "inserted");
      assert.equal(response.station_id, "STATION_01");
    }

    const snapshot = db.getSnapshot();
    assert.equal(snapshot.environmentalReadings.length, 1);
    assert.equal(snapshot.auditLogs.at(-1)?.status, "accepted");
  });

  it("ignores duplicate message_id", async () => {
    const db = new MockDb({ STATION_01: DEVICE_SECRET }, otaCatalog);
    const payload = basePayload({ message_id: "contract-test-duplicate-001" });
    const request = await buildRequest(payload);

    const first = await ingestTelemetry(request, db, config, NOW);
    const second = await ingestTelemetry(request, db, config, NOW + 1);

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (first.ok && second.ok) {
      assert.equal(first.status, "inserted");
      assert.equal(second.status, "duplicate_ignored");
    }

    assert.equal(db.getSnapshot().environmentalReadings.length, 1);
    assert.equal(db.getSnapshot().auditLogs.filter((row) => row.status === "duplicate").length, 1);
  });

  it("rejects invalid signature", async () => {
    const db = new MockDb({ STATION_01: DEVICE_SECRET }, otaCatalog);
    const payload = basePayload({ message_id: "contract-test-bad-signature-001" });
    const response = await ingestTelemetry(await buildRequest(payload, "deadbeef"), db, config, NOW);

    assert.equal(response.ok, false);
    if (!response.ok) {
      assert.equal(response.error_code, "INVALID_SIGNATURE");
    }

    assert.equal(db.getSnapshot().environmentalReadings.length, 0);
    assert.equal(db.getSnapshot().auditLogs.at(-1)?.status, "invalid_signature");
  });

  it("rejects sensor fault payloads", async () => {
    const db = new MockDb({ STATION_01: DEVICE_SECRET }, otaCatalog);
    const payload = basePayload({
      message_id: "contract-test-sensor-fault-001",
      fault_flags: 1,
      sensor_status: { ec_probe: "fault", ultrasonic: "ok" },
    });
    const response = await ingestTelemetry(await buildRequest(payload), db, config, NOW);

    assert.equal(response.ok, false);
    if (!response.ok) {
      assert.equal(response.error_code, "SENSOR_FAULT");
    }

    assert.equal(db.getSnapshot().environmentalReadings.length, 0);
    assert.equal(db.getSnapshot().auditLogs.at(-1)?.status, "sensor_fault");
    assert.equal(db.getSnapshot().environmentalEvents.some((event) => event.event_type === "SENSOR_FAULT"), true);
  });

  it("rejects replay attack with timestamp too old", async () => {
    const db = new MockDb({ STATION_01: DEVICE_SECRET }, otaCatalog);
    const staleTimestamp = NOW - 600;
    const payload = basePayload({
      message_id: "contract-test-replay-old-001",
      timestamp: staleTimestamp,
    });
    const response = await ingestTelemetry(await buildRequest(payload), db, config, NOW);

    assert.equal(response.ok, false);
    if (!response.ok) {
      assert.equal(response.error_code, "TIMESTAMP_OUT_OF_WINDOW");
    }
    assert.equal(db.getSnapshot().auditLogs.at(-1)?.status, "expired_timestamp");
  });

  it("rejects replay attack with timestamp too far in the future", async () => {
    const db = new MockDb({ STATION_01: DEVICE_SECRET }, otaCatalog);
    const futureTimestamp = NOW + 600;
    const payload = basePayload({
      message_id: "contract-test-replay-future-001",
      timestamp: futureTimestamp,
    });
    const response = await ingestTelemetry(await buildRequest(payload), db, config, NOW);

    assert.equal(response.ok, false);
    if (!response.ok) {
      assert.equal(response.error_code, "TIMESTAMP_OUT_OF_WINDOW");
    }
    assert.equal(db.getSnapshot().auditLogs.at(-1)?.status, "expired_timestamp");
  });
});
