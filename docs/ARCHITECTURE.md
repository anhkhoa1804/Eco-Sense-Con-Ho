# Architecture

## System summary

Eco-Sense Cồn Hô is a serverless environmental monitoring platform. Field stations collect water salinity, water level, and device health data. Devices sign telemetry and send it to Supabase Edge Functions. Valid data is stored in PostgreSQL and displayed through a Next.js PWA for public users and administrators.

## Core data flow

1. ESP32 station wakes on a duty cycle.
2. Sensors collect environmental measurements.
3. Firmware creates a telemetry payload with station identity, reading values, health fields, and firmware version.
4. Firmware signs the canonical payload using HMAC-SHA256.
5. Device sends the payload to the Supabase Edge Function ingestion endpoint.
6. Edge Function validates gateway auth, device registration, timestamp drift, signature, value ranges, idempotency, and sensor fault flags.
7. Valid readings are inserted into PostgreSQL.
8. Faults and operational events are recorded separately from environmental readings.
9. Public and admin Next.js pages read shaped data from Supabase.
10. Users view station status, charts, alerts, and reports.

## System boundaries

| Layer | Responsibility |
|-------|----------------|
| Firmware | Collect readings, sign payloads, retry safely, preserve power. |
| Edge ingestion | Authenticate devices, validate contracts, reject unsafe data, record audits. |
| Database | Store readings, health logs, events, devices, reports, roles, and thresholds. |
| Public app | Explain environmental state without login. |
| Admin app | Manage stations, thresholds, reports, alerts, and operations. |
| Documentation | Preserve product philosophy and implementation expectations. |

## Data domains

Expected core entities:

- `users`
- `stations`
- `devices`
- `station_assignments`
- `environmental_readings`
- `environmental_events`
- `station_health_logs`
- `damage_logs`
- `crop_thresholds`
- `audit_logs`

The exact schema may evolve, but environmental readings, station health, community reports, thresholds, and audit history should remain conceptually separate.

## Reading integrity

Environmental readings must be protected from accidental duplication and untrusted input.

Required integrity behaviors:

- `message_id` is unique and used for idempotency.
- Device must be registered and active.
- Payload must match contract version.
- HMAC signature must match canonical fields.
- Timestamp must be within replay window.
- Numeric readings must be within safe validation bounds.
- Sensor faults should create fault events and avoid treating bad readings as trustworthy.

## Sensor health model

Sensor health is not the same as environmental health.

- **Environmental health** answers whether the water condition is acceptable.
- **Sensor health** answers whether the data source is trustworthy.

The UI should never present a confident environmental interpretation when the sensor is faulty or stale. In that case, state should shift toward “sensor fault” or “offline” with clear explanation.

## Public transparency model

Public pages should expose environmental status, station freshness, charts, and community context without requiring login. Public access must not expose secrets, device credentials, private operator notes, privileged user data, or unsafe administrative controls.

## Admin operations model

Admin pages are authenticated operational surfaces. They should support:

- station management,
- alert triage,
- threshold configuration,
- report review,
- device status monitoring,
- audit review,
- deployment readiness checks.

Every sensitive admin action should be authorized, traceable, and reversible where practical.

## Reliability assumptions

The field environment may have unstable LTE, power constraints, sensor faults, high humidity, and physical device damage.

The platform should tolerate:

- delayed readings,
- duplicate telemetry,
- intermittent network failures,
- offline community reports,
- stale station state,
- partial data availability,
- sensor-specific faults.

## Security principles

- Device secrets must never be exposed to public or client-side code.
- Supabase service role keys must never be shipped to the browser.
- Public data access must be intentionally scoped.
- Admin access must use explicit roles and database policies.
- Ingestion must validate both transport-level gateway auth and device-level signatures.
- Audit logs should preserve security-relevant decisions.

## Extending the architecture

When adding a feature, define:

- which persona it serves,
- whether it is public or admin,
- what data it reads or writes,
- how stale or missing data behaves,
- what authorization policy applies,
- what audit trail is needed,
- how it appears on mobile,
- how performance is preserved.