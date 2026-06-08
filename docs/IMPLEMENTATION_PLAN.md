# Eco-Sense Con Ho - Implementation Plan

This document breaks the PRD/TDD into executable work packages for engineering.

## 0. Delivery Strategy
- Model: Monorepo with app, service, firmware, and infra boundaries.
- Process: Phase-gated delivery with acceptance criteria per phase.
- Release cadence: Weekly internal milestones, bi-weekly field validation.
- Team size assumption: Small team (3 contributors), so prioritize delivery reliability over enterprise process overhead.

## 1. Phase 1 - Foundation and Project Scaffolding
Goal: Establish a production-grade baseline repository and delivery pipeline.

Tasks:
1. Initialize monorepo structure (`apps`, `services`, `firmware`, `infra`, `docs`).
2. Bootstrap Next.js app as PWA shell.
3. Initialize Supabase project configuration and migration flow.
4. Define coding standards, environment conventions, and secrets policy.
5. Set up lightweight CI checks (lint + typecheck + optional smoke test).

Outputs:
- Working repo skeleton.
- CI pipeline and branch strategy.
- Environment templates (`.env.example`) for web, edge, and firmware.

Acceptance criteria:
- Local setup in <= 15 minutes from clean machine.
- CI green on default branch.

## 2. Phase 2 - Data Model and Access Control
Goal: Implement core PostgreSQL schema + RLS policy framework.

Tasks:
1. Create migrations for:
   - users
   - stations
   - station_health_logs
   - environmental_data
   - damage_logs
   - crop_thresholds
2. Add keys, indexes, and constraints:
   - unique `environmental_data.message_id`
   - foreign keys and station/time indexes
3. Implement RLS policies by role:
   - farmer/user
   - admin/climate steward
4. Seed minimal baseline data for local and staging.

Outputs:
- Versioned SQL migrations.
- RLS policy scripts.
- Seed scripts.

Acceptance criteria:
- Schema migration idempotent in dev/staging.
- Unauthorized row access blocked by policy tests.

## 3. Phase 3 - IoT Ingestion Service (Edge Functions)
Goal: Secure, idempotent ingestion endpoint for field nodes.

Tasks:
1. Define canonical payload contract (telemetry + health + metadata).
2. Implement HMAC validation with per-device secret lookup.
3. Enforce timestamp drift check (<= 5 min).
4. Implement idempotency using `message_id` uniqueness and duplicate handling.
5. Persist:
   - environmental metrics -> environmental_data
   - node health -> station_health_logs
6. Return OTA metadata when firmware update is available.
7. Add structured logging and failure reason taxonomy.

Outputs:
- Edge endpoint(s) ready for ESP32 integration.
- API contract doc and test vectors.

Acceptance criteria:
- Replay attacks rejected.
- Duplicate sends do not create duplicate rows.
- 100% valid signed payloads are persisted successfully in staging.
- Retries from LTE drops do not cause data loss or inconsistent state.

## 4. Phase 4 - Firmware Node Implementation
Goal: Production firmware for resilient field operation.

Tasks:
1. Implement power duty cycle:
   - wake -> LTE on -> read sensors -> send -> LTE off -> deep sleep
2. Integrate sensor acquisition:
   - EC (with temperature compensation)
   - ultrasonic water level
3. Implement payload signing and message_id generation.
4. Implement calibration captive portal:
   - AP mode + local web UI
   - compute/store K-value in NVS/EEPROM
5. Implement OTA check and upgrade flow.
6. Add retry strategy and watchdog handling.

Outputs:
- Firmware build profiles for dev/prod.
- Device provisioning guide.

Acceptance criteria:
- End-to-end send cycle < 15s under nominal LTE conditions.
- Stable deep sleep current and expected daily budget.

## 5. Phase 5 - User PWA (Farmer Experience)
Goal: Deliver offline-capable farmer-facing product features.

Tasks:
1. Build authentication and profile setup flow.
2. Create station overview and latest readings pages.
3. Implement advanced alert cards:
   - threshold status
   - trend delta over 2h
   - cumulative exposure duration
4. Implement damage report workflow:
   - photo capture/upload
   - geolocation first
   - map-pin fallback when GPS unavailable/low accuracy
5. Implement offline-first data capture with IndexedDB.
6. Implement background sync via Service Worker.

Outputs:
- PWA installable on Android/iOS browsers.
- Offline queue for damage reports.

Acceptance criteria:
- Damage report can be fully captured offline.
- Sync resumes automatically when online.

## 6. Phase 6 - Admin and Fleet Diagnostics
Goal: Provide operational visibility and governance tooling.

Tasks:
1. Build admin dashboard for station fleet status.
2. Add charts for battery voltage and signal strength trends.
3. Add warning indicators:
   - battery < 3.6V
   - signal < -95 dBm
4. Create data export module (CSV/Excel):
   - filter by station
   - filter by date range
5. Add firmware/version distribution view.

Outputs:
- Admin console pages.
- Export utility endpoints/actions.

Acceptance criteria:
- Admin can identify weak stations in < 30s.
- Exported file integrity validated on sample datasets.

## 7. Phase 7 - Quality, Security, and Field Readiness
Goal: Hardening before production deployment.

Tasks:
1. End-to-end test suite:
   - ingestion
   - alert engine
   - offline sync
2. Security tests:
   - authz policy tests
   - replay and tampering scenarios
3. Performance checks:
   - ingestion load profile
   - PWA startup performance in low bandwidth
4. Observability:
   - dashboards
   - alerting rules
   - operational runbooks
5. Field pilot with staged firmware rollout.

Outputs:
- Test report + known issues register.
- Go-live checklist.

Acceptance criteria:
- All critical test paths pass.
- No high-severity open issues before launch.

## 8. Cross-Cutting Technical Decisions
- Time handling: Store timestamps in UTC, render local timezone in UI.
- Numeric precision: Standardize units (salinity per mille, water level cm).
- Idempotency key: `message_id` generated on-device each wake cycle.
- API versioning: Prefix ingestion route with `/v1`.
- Backward compatibility: Keep one previous firmware payload format during rollout.
- OTA distribution channel: GitHub Releases as primary binary source.
- Telemetry reliability mode: store-and-forward queue on node, not send-and-forget.
- Data retention strategy:
   - raw telemetry retention: 2 years
   - hourly aggregates retention: long-term
   - dashboard defaults to aggregates for long time ranges
- Extended outage fallback (future phase): SMS summary when LTE attach fails for >24h.

## 8.1 Architecture-First Documents (Required Before Feature Coding)
1. `docs/API_CONTRACTS.md` must be finalized before implementing firmware payload and ingestion parser.
2. `docs/FIRMWARE_SPEC.md` must be finalized before implementing sensor loop and sleep orchestration.
3. `docs/DEPLOYMENT_PACKAGE.md` must be finalized before first field installation.
4. `docs/FIELD_TEST_PLAN.md` must be finalized before pilot rollout.

## 9. Suggested Initial Backlog (First 2 Sprints)
Sprint 1:
1. Phase 1 full completion.
2. Phase 2 schema + base RLS.
3. Phase 3 ingestion endpoint skeleton + HMAC verification + sensor fault fields.

Sprint 2:
1. Phase 3 complete idempotent persistence.
2. Phase 5 authentication + station overview with mock telemetry.
3. Phase 4 firmware payload signing + local queue (store-and-forward) design.

## 10. Risks and Mitigations
- LTE instability: Add robust retry + idempotent writes.
- Sensor drift/fouling: Enforce calibration SOP and housing maintenance schedule.
- Battery depletion in bad weather: Optimize wake time and daytime OTA checks.
- Offline media size growth: Compress image client-side before queueing.
- GPS permission denial: Force map-pin fallback with area presets.

## 11. Definition of Done (Global)
A feature is complete only when:
1. Functional requirements implemented.
2. Security and access controls validated.
3. Observability and error handling included.
4. Documentation updated.
5. Tests pass in CI.

## 12. Architecture Gaps Closed in This Revision
- Data contract is now first-class and implementation-blocking.
- OTA architecture now has an explicit distribution decision (GitHub Releases).
- Field deployment package now includes mechanical/electrical/environmental engineering requirements.
- Field reliability tests are codified as release gates, not optional checks.
- Sensor fault model is now explicit in payload design.
- Store-and-forward reliability is now part of firmware architecture.
- Long-horizon operational readiness now includes a 90-day gate.
