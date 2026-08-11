# API Contracts

## Scope

This document defines the v1 telemetry contract between field devices and the Eco-Sense ingestion service. Public and admin application APIs may evolve separately, but they must preserve the product principles in the handbook: trustworthy data, clear status, access control, and fast UI.

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
| `x-device-id` | Yes | Device identifier; should match `payload.device_id`. |
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
| `battery_voltage` | number | 2.5–5.5 V. |
| `signal_strength_dbm` | integer | -130 to -30 dBm. |
| `firmware_version` | string | Semantic version string. |

## Optional fields

Optional fields are allowed only when the ingestion service explicitly tolerates them. They must not be used for authorization-critical logic unless added to a future canonical signature string.

Potential reserved fields:

| Field | Type | Notes |
|-------|------|-------|
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
