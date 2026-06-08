# Eco-Sense Con Ho

Serverless, fault-tolerant, offline-first climate monitoring network for local agriculture.

## 1. Product Summary
Eco-Sense Con Ho is an end-to-end system that combines:
- Field IoT nodes (ESP32 + LTE modem) for periodic sensing.
- Secure serverless ingestion via Supabase Edge Functions.
- PostgreSQL time-series storage with strict access control.
- Next.js Progressive Web App (PWA) for farmers and admins.

Primary goals:
- Reliable data collection in weak network environments.
- Actionable salinity alerts based on threshold + trend + exposure duration.
- Offline-first incident reporting with delayed background sync.
- Fleet diagnostics for battery, signal, firmware, and station health.

## 2. Core Architecture
Data flow:
1. ESP32 wakes on duty cycle (every 30 min).
2. Node powers LTE, reads sensors, signs payload.
3. Node sends payload to Supabase Edge Function.
4. Edge Function validates HMAC, timestamp, idempotency.
5. Valid records are written to PostgreSQL tables.
6. Next.js PWA consumes data via Supabase APIs.

Tech stack:
- Hardware Node: ESP32 + A7670C/SIM7600
- Ingestion: Supabase Edge Functions
- Data + Auth: Supabase PostgreSQL, RLS, Storage
- Frontend: Next.js (React) + PWA

## 3. System Design Principles
- Serverless-first: Minimize always-on backend services.
- Fault-tolerant in field: Handle LTE retries, packet drops, and power constraints.
- Offline-first UX: Store report drafts and media in IndexedDB, sync later.
- Security by design: Signed payloads, replay protection, role-based data access.

## 4. Planned Repository Structure
Proposed structure for implementation:

```text
.
|-- apps/
|   |-- web/                    # Next.js PWA (farmer + admin)
|-- services/
|   |-- edge-ingestion/         # Supabase Edge Functions for IoT
|-- firmware/
|   |-- esp32-node/             # ESP32 source, OTA, calibration portal
|-- infra/
|   |-- supabase/               # SQL migrations, RLS policies, seed data
|-- docs/
|   |-- IMPLEMENTATION_PLAN.md  # Phase-by-phase delivery plan
|   |-- API_CONTRACTS.md        # ESP32 <-> Backend data contract (v1)
|   |-- FIRMWARE_SPEC.md        # Firmware lifecycle (in firmware/esp32-node/docs/)
|   |-- DEPLOYMENT_PACKAGE.md   # Mechanical/electrical/env deployment spec
|   |-- FIELD_TEST_PLAN.md      # Field reliability test checklist
|   |-- RUNBOOKS.md             # Ops/calibration/maintenance (to be added)
```

## 5. Data Domains
Main entities:
- users
- stations
- station_assignments
- environmental_readings (primary telemetry)
- environmental_events
- station_health_logs
- damage_logs
- crop_thresholds

Key constraints:
- environmental_readings.message_id is unique for idempotency.
- station_health_logs is isolated from environmental measurements for diagnostics.
- Role-based access via Supabase RLS.

## 6. Security Model
IoT ingestion security requirements:
- HMAC-SHA256 signature over canonical payload + timestamp.
- Timestamp drift window <= 5 minutes.
- Unique message_id per wake cycle.
- Duplicate message_id requests are acknowledged but dropped from insertion.

Application security requirements:
- Supabase Auth for user/admin sessions.
- RLS enforced on all business tables.
- Signed upload workflows for damage image evidence.

## 7. UX Scope
Farmer-facing:
- Live salinity/water-level overview by station.
- Alert cards with trend and cumulative exposure context.
- Damage report form with photo, location, and description.
- Offline storage + background sync on reconnect.

Admin-facing:
- Station health dashboard (battery, signal, firmware).
- Warning markers for battery < 3.6V or signal < -95 dBm.
- Data export tools (CSV/Excel) with station/time filters.

## 8. Delivery Roadmap
See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for detailed phased execution.

## 9. Architecture Documents (Must Read Before Coding)
- [docs/API_CONTRACTS.md](docs/API_CONTRACTS.md): Canonical payload schema, signature rules, and error contracts.
- [docs/FIRMWARE_SPEC.md](docs/FIRMWARE_SPEC.md): Node state machine, retries, power budget behavior, and OTA flow.
- [docs/DEPLOYMENT_PACKAGE.md](docs/DEPLOYMENT_PACKAGE.md): Enclosure, electrical protection, and environmental hardening.
- [docs/FIELD_TEST_PLAN.md](docs/FIELD_TEST_PLAN.md): Field validation matrix for data reliability and survivability.

## 10. Success Metrics (Pragmatic)
- 100% valid signed payloads are persisted (no data loss for accepted payloads).
- Duplicate LTE retries do not create duplicate records.
- Sensor failures are explicit (fault flags/status), never silently coerced to normal values.
- Store-and-forward queue preserves telemetry during temporary network outage.
- Node remains operational through adverse weather windows with expected duty cycle.
- 30 days technical pilot + 90 days production-readiness validation.
- Offline damage reports are captured and later synced without user re-entry.

## 11. Current Status
- PRD/TDD interpreted and converted into technical baseline docs.
- Implementation plan drafted for staged development.
- Architecture-level specifications added for contract, firmware lifecycle, deployment, and field tests.
- Sensor fault model, surge hardening, retention strategy, and long-horizon readiness gates are now documented.
- Phase 1-3 scaffold is implemented with mock data and ingestion simulation.

## 12. Phase 1-3 Implemented Artifacts
- Monorepo scaffold with `apps`, `services`, `infra`, `firmware`, `docs`.
- Public dashboard mockup in `apps/web` with station map, latest readings, trend chart, and alert cards.
- Mock-first web datasets in `apps/web/mock`.
- Supabase migrations and seed scripts in `infra/supabase`.
- Edge ingestion mock service with:
	- HMAC verification
	- timestamp drift validation
	- idempotency by message_id
	- sensor fault handling (`fault_flags`, `sensor_status`)
	- ingestion audit logging and split telemetry events/readings

## 13. Run Mock Ingestion Locally
From repository root:

```bash
npm install
npm run check
npm run mock:ingest
npm run simulator
npm run dashboard
```

Expected behavior:
- First payload: `inserted`
- Second same payload: `duplicate_ignored`
- Faulty payload: `SENSOR_FAULT`

Dashboard preview:
- Start `npm run dashboard`
- Open `http://localhost:4173`
