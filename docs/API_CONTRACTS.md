# Eco-Sense Telemetry API Contract (v1)

Endpoint: `POST {SUPABASE_URL}/functions/v1/edge-ingest`

## Gateway authentication

Supabase API gateway requires **either** header:

- `Authorization: Bearer {SUPABASE_ANON_KEY}`
- `apikey: {SUPABASE_ANON_KEY}`

Device HMAC is validated inside the edge function. Gateway auth and device auth are independent.

## Request headers

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | `application/json` |
| `Authorization` | Yes (gateway) | Supabase anon or service role JWT |
| `apikey` | Yes (gateway) | Same key as Authorization |
| `x-device-id` | Yes | Device identifier (must match `payload.device_id` in practice) |
| `x-timestamp` | Yes | Unix epoch **seconds** UTC; replay window check |
| `x-signature` | Yes | HMAC-SHA256 hex digest of canonical string |
| `x-contract-version` | Yes | Must be `v1` (also in body) |

**Note:** Server validates `payload.contract_version` only. Header `x-contract-version` is parsed but not cross-checked.

## Request body (`TelemetryPayloadV1`)

```json
{
  "contract_version": "v1",
  "device_id": "STATION_01",
  "message_id": "unique-per-sample-id",
  "timestamp": 1700000000,
  "salinity": 1.1,
  "water_level": 50,
  "fault_flags": 0,
  "sensor_status": { "ec_probe": "ok", "ultrasonic": "ok" },
  "battery_voltage": 3.9,
  "signal_strength_dbm": -85,
  "firmware_version": "1.0.2"
}
```

### Required fields

| Field | Type | Constraints |
|-------|------|-------------|
| `contract_version` | string | Must be `"v1"` |
| `device_id` | string | Registered in `devices.device_id`, status `active` |
| `message_id` | string | Unique per sample; idempotency key |
| `timestamp` | integer | Unix seconds UTC; included in HMAC |
| `salinity` | number | 0–50 (ppt) |
| `water_level` | number | -100–1000 (cm) |
| `fault_flags` | integer | Bitmask; >0 triggers sensor fault path |
| `sensor_status.ec_probe` | enum | `ok`, `warn`, `fault` |
| `sensor_status.ultrasonic` | enum | `ok`, `warn`, `fault` |
| `battery_voltage` | number | 2.5–5.5 V |
| `signal_strength_dbm` | integer | -130 to -30 |
| `firmware_version` | string | Semantic version string |

### Optional fields (not in HMAC)

| Field | Type | Notes |
|-------|------|-------|
| `temperature_c` | number | Reserved; ignored by signature |
| `calibration.k_value` | number | Reserved |
| `calibration.last_calibrated_at` | integer | Reserved |

**Security:** Optional fields are excluded from HMAC. Do not rely on them for auth-critical logic until added to canonical string in a future contract version.

## HMAC canonical string

Pipe-delimited, 12 fields:

```
{device_id}|{message_id}|{timestamp}|{salinity}|{water_level}|{fault_flags}|{ec_probe}|{ultrasonic}|{battery_voltage}|{signal_strength_dbm}|{firmware_version}|{contract_version}
```

### Number formatting

- Integers: decimal string with no fraction (`50`, `0`, `-85`)
- Decimals: up to 3 decimal places, trailing zeros stripped (`1.1` not `1.100`, `1.05` stays `1.05`)

Implementation: `Number.isInteger(n) ? n.toString() : n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")`

### Signature algorithm

- Key: UTF-8 bytes of `device_secret` (from `devices` table)
- Algorithm: HMAC-SHA256
- Output: lowercase hexadecimal (64 chars)

## Test vectors

Secret: `station-secret-01`

### Vector 1 — valid payload (from contract tests)

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
  "sensor_status": { "ec_probe": "ok", "ultrasonic": "ok" },
  "battery_voltage": 3.9,
  "signal_strength_dbm": -85,
  "firmware_version": "1.0.2"
}
```

Canonical:

```
STATION_01|contract-test-message-001|1700000000|1.1|50|0|ok|ok|3.9|-85|1.0.2|v1
```

Compute HMAC-SHA256 with key `station-secret-01`. Use runtime test:

```bash
npm run test -w @eco-sense/edge-ingestion
```

### Vector 2 — decimal trimming

`salinity: 1.10` → canonical field `1.1`  
`water_level: 50.0` → canonical field `50`

### Vector 3 — sensor fault (rejected, no reading inserted)

`fault_flags: 1` or `sensor_status.ec_probe: "fault"` → HTTP 422, `error_code: "SENSOR_FAULT"`.

## Replay protection

- Config: `MAX_TIMESTAMP_DRIFT_SECONDS` (default **300**)
- Compares `x-timestamp` header to server clock
- `payload.timestamp` is in HMAC but drift check uses **header** timestamp
- Reject if `|server_now - x-timestamp| > drift`

## Idempotency

- Unique DB constraint on `environmental_readings.message_id`
- Duplicate → HTTP **200**, body:

```json
{
  "ok": true,
  "status": "duplicate_ignored",
  "station_id": "STATION_01",
  "message_id": "...",
  "server_timestamp": 1700000001,
  "ota": { "update_available": false }
}
```

## Success response (HTTP 200)

```json
{
  "ok": true,
  "status": "inserted",
  "station_id": "STATION_01",
  "message_id": "...",
  "server_timestamp": 1700000000,
  "ota": {
    "update_available": false
  }
}
```

When OTA available:

```json
{
  "update_available": true,
  "target_version": "1.0.3",
  "binary_url": "https://...",
  "sha256": "...",
  "size_bytes": 1432200
}
```

Device must download and apply firmware independently. No OTA ack endpoint in v1.

## Error responses

| error_code | HTTP | retryable | When |
|------------|------|-----------|------|
| `MISSING_FIELD` | 400 | false | Required field missing or unsupported contract version |
| `INVALID_SIGNATURE` | 401 | false | HMAC mismatch |
| `TIMESTAMP_OUT_OF_WINDOW` | 400 | false | Replay window exceeded |
| `DEVICE_NOT_REGISTERED` | 404 | false | Unknown or inactive device |
| `VALUE_OUT_OF_RANGE` | 400 | false | Numeric validation failed |
| `SENSOR_FAULT` | 422 | false | fault_flags > 0 or status `fault` |
| `INTERNAL_ERROR` | 500 | true | Server error |
| `METHOD_NOT_ALLOWED` | 405 | false | Non-POST request |

Example failure:

```json
{
  "ok": false,
  "error_code": "INVALID_SIGNATURE",
  "message": "signature verification failed",
  "retryable": false
}
```

**Known inconsistency:** Contract version mismatch logs audit status `contract_mismatch` but returns `error_code: "MISSING_FIELD"`.

## Side effects on successful insert

1. Row in `environmental_readings`
2. Row in `station_health_logs`
3. `devices.last_seen_at` and `firmware_version` updated
4. Optional events in `environmental_events`:
   - `HIGH_SALINITY` (warning ≥1.2, critical ≥1.8 default)
   - `LOW_BATTERY` (warning if voltage <3.6 V)
   - `OFFLINE` (info if signal ≤-95 dBm)

## Sensor fault path

- No reading inserted
- Audit log status `sensor_fault`
- `SENSOR_FAULT` event inserted (critical)

## Configuration (edge function secrets)

| Variable | Default |
|----------|---------|
| `MAX_TIMESTAMP_DRIFT_SECONDS` | 300 |
| `DEFAULT_CONTRACT_VERSION` | v1 |
| `SALINITY_WARNING_LEVEL` | 1.2 |
| `SALINITY_CRITICAL_LEVEL` | 1.8 |
| `LOW_BATTERY_VOLTAGE` | 3.6 |
| `LOW_SIGNAL_STRENGTH_DBM` | -95 |

## CORS

`Access-Control-Allow-Origin: *` on responses. OPTIONS preflight supported.

## Reference implementation

- Canonical + sign: [`services/edge-ingestion/src/canonical.ts`](../services/edge-ingestion/src/canonical.ts)
- Ingest logic: [`services/edge-ingestion/src/ingest.ts`](../services/edge-ingestion/src/ingest.ts)
- Contract tests: [`services/edge-ingestion/tests/contract.test.ts`](../services/edge-ingestion/tests/contract.test.ts)
