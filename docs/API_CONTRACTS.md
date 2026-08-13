# API Contracts

## Scope

This document defines the v1 telemetry contract between field devices and the HORIZON ingestion service. Public and admin application APIs may evolve separately, but they must preserve the product principles in the handbook: trustworthy data, clear status, access control, and fast UI.

This is the ONE canonical ingestion contract — see
[`ARCHITECTURE_DECISIONS.md`](ARCHITECTURE_DECISIONS.md) §1 for why the
previously-separate `/api/public/gateway` route was removed rather than
kept as a second path.

## Telemetry ingestion endpoint

Endpoint:

```text
POST {SUPABASE_URL}/functions/v1/edge-ingest
```

## Gateway authentication

Supabase API gateway requires either or both of these headers depending on deployment configuration:

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer {SUPABASE_ANON_KEY}` |
| `apikey` | `{SUPABASE_ANON_KEY}` |

Device HMAC is validated inside the edge function. Gateway authentication and device authentication are separate controls.

## Request headers

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | Must be `application/json`. |
| `Authorization` | Yes | Supabase gateway token. |
| `apikey` | Yes | Supabase gateway key. |
| `x-device-id` | Yes | The device presenting this request's signature. Equal to `payload.device_id` for a device connecting directly; different when a gateway relays on behalf of a station (`x-device-id` = the gateway's own ID, `payload.device_id` = the station's). Both must independently be known, active `devices` rows. |
| `x-timestamp` | Yes | Unix epoch seconds UTC; used for replay-window validation. |
| `x-signature` | Yes | HMAC-SHA256 lowercase hexadecimal digest. |
| `x-contract-version` | Yes | Contract version; expected `v1`. |

The server must validate the payload contract version. Header and body contract versions should be kept aligned by clients.

## Request body

Example `TelemetryPayloadV1`:

```json
{
  "contract_version": "v1",
  "device_id": "STATION_01",
  "message_id": "unique-per-sample-id",
  "timestamp": 1700000000,
  "salinity": 1.1,
  "water_level": 50,
  "fault_flags": 0,
  "sensor_status": {
    "ec_probe": "ok",
    "ultrasonic": "ok"
  },
  "battery_voltage": 3.9,
  "signal_strength_dbm": -85,
  "firmware_version": "1.0.2"
}
```

## Required fields

| Field | Type | Constraints |
|-------|------|-------------|
| `contract_version` | string | Must be `v1`. |
| `device_id` | string | Registered active device. |
| `message_id` | string | Unique per sample; idempotency key. |
| `timestamp` | integer | Unix seconds UTC; included in HMAC. |
| `salinity` | number | 0–50 ppt. |
| `water_level` | number | -100–1000 cm. |
| `fault_flags` | integer | Bitmask; values greater than 0 indicate fault path. |
| `sensor_status.ec_probe` | enum | `ok`, `warn`, or `fault`. |
| `sensor_status.ultrasonic` | enum | `ok`, `warn`, or `fault`. |
| `firmware_version` | string | Semantic version string. |

## Optional fields

| Field | Type | Notes |
|-------|------|-------|
| `battery_voltage` | number | 2.5–5.5 V when present. **Not required as of the gateway-relay architecture** — a LoRa-only station has no cellular modem, and a relaying gateway can't honestly measure a remote station's battery. Omitted rather than fabricated when unmeasurable. Included in the HMAC canonical string as an empty segment when absent. |
| `signal_strength_dbm` | integer | -130 to -30 dBm when present. **Not required** for the same reason — "signal strength" in the cellular sense doesn't apply to a LoRa-only device. Empty canonical-string segment when absent. |
| `temperature_c` | number | Future environmental measurement. |
| `calibration.k_value` | number | Future calibration metadata. |
| `calibration.last_calibrated_at` | integer | Future calibration timestamp. |

## HMAC canonical string

The v1 canonical string is pipe-delimited and contains 12 fields:

```text
{device_id}|{message_id}|{timestamp}|{salinity}|{water_level}|{fault_flags}|{ec_probe}|{ultrasonic}|{battery_voltage}|{signal_strength_dbm}|{firmware_version}|{contract_version}
```

Number formatting:

- Integers use decimal string form with no fraction: `50`, `0`, `-85`.
- Decimals use up to 3 decimal places, with trailing zeros stripped: `1.1`, `1.05`, `3.875`.

Reference JavaScript formatting:

```js
Number.isInteger(value)
  ? value.toString()
  : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")
```

Signature algorithm:

- Key: UTF-8 bytes of `device_secret`.
- Algorithm: HMAC-SHA256.
- Output: lowercase hexadecimal string.

## Test vector

Secret:

```text
station-secret-01
```

Payload:

```json
{
  "contract_version": "v1",
  "device_id": "STATION_01",
  "message_id": "contract-test-message-001",
  "timestamp": 1700000000,
  "salinity": 1.1,
  "water_level": 50,
  "fault_flags": 0,
  "sensor_status": {
    "ec_probe": "ok",
    "ultrasonic": "ok"
  },
  "battery_voltage": 3.9,
  "signal_strength_dbm": -85,
  "firmware_version": "1.0.2"
}
```

Canonical string:

```text
STATION_01|contract-test-message-001|1700000000|1.1|50|0|ok|ok|3.9|-85|1.0.2|v1
```

### Gateway-relay test vector (battery/signal omitted)

This is the actual shape a gateway sends when relaying a LoRa-only station's
reading — `x-device-id` is the gateway's ID, signed with the **gateway's**
secret, not the station's:

```json
{
  "contract_version": "v1",
  "device_id": "STATION_02",
  "message_id": "STATION_02-gateway-relay-001",
  "timestamp": 1700000000,
  "salinity": 1.18,
  "water_level": 61,
  "fault_flags": 0,
  "sensor_status": { "ec_probe": "ok", "ultrasonic": "ok" },
  "firmware_version": "station2-grapefruit-soil-0.1.0"
}
```

Canonical string — 12 pipe-delimited fields, always; battery/signal are
present as consecutive empty segments (not skipped) when omitted from the
payload:

```text
STATION_02|STATION_02-gateway-relay-001|1700000000|1.18|61|0|ok|ok|||station2-grapefruit-soil-0.1.0|v1
```

Signed with `GATEWAY_01`'s secret; sent with `x-device-id: GATEWAY_01`.

## Replay protection

- Default max drift: 300 seconds.
- Compare server time against `x-timestamp`.
- Reject requests outside the allowed window.
- Keep `payload.timestamp` in the signature to bind the reading time to the signed message.

## Idempotency

`environmental_readings.message_id` must be unique. Duplicate messages should not create duplicate readings.

Recommended duplicate response:

```json
{
  "ok": true,
  "status": "duplicate_ignored",
  "station_id": "STATION_01",
  "message_id": "unique-per-sample-id",
  "server_timestamp": 1700000001,
  "ota": {
    "update_available": false
  }
}
```

## Success response

HTTP 200:

```json
{
  "ok": true,
  "status": "inserted",
  "station_id": "STATION_01",
  "message_id": "unique-per-sample-id",
  "server_timestamp": 1700000000,
  "ota": {
    "update_available": false
  }
}
```

When an OTA update is available:

```json
{
  "update_available": true,
  "target_version": "1.0.3",
  "binary_url": "https://example.com/firmware.bin",
  "sha256": "expected-sha256",
  "size_bytes": 1432200
}
```

The device downloads and applies firmware independently. There is no OTA acknowledgment endpoint in v1 unless explicitly added later.

## Error responses

| Error code | HTTP | Retryable | Meaning |
|------------|------|-----------|---------|
| `MISSING_FIELD` | 400 | No | Required field missing or unsupported contract version. |
| `INVALID_SIGNATURE` | 401 | No | HMAC mismatch. |
| `TIMESTAMP_OUT_OF_WINDOW` | 400 | No | Replay window exceeded. |
| `DEVICE_NOT_REGISTERED` | 404 | No | Unknown or inactive device. |
| `VALUE_OUT_OF_RANGE` | 400 | No | Numeric validation failed. |
| `SENSOR_FAULT` | 422 | No | Fault flags or sensor status indicate unreliable data. |
| `INTERNAL_ERROR` | 500 | Yes | Server-side failure. |

Error body shape:

```json
{
  "ok": false,
  "error_code": "INVALID_SIGNATURE",
  "message": "Signature validation failed.",
  "retryable": false
}
```

## Product expectations for API changes

Any API change must preserve:

- backward compatibility or documented migration path,
- explicit contract versioning,
- deterministic signing rules,
- clear error codes,
- auditability,
- public UI clarity around stale, missing, or invalid data.
