# edge-ingest Deployment Readiness

Assessed by reading `services/edge-ingestion/src/{ingest,httpHandler,edgeEntry,supabaseDb,config,canonical}.ts`,
`infra/supabase/functions/edge-ingest/index.ts`, `infra/supabase/deploy.ps1`,
`infra/supabase/config.toml`, and running the full mocked contract test
suite — Phase F, 2026-08-13, updated Phase G. **Nothing has been deployed
to produce this assessment.**

**Update (Phase G):** two real correctness fixes landed in `ingest.ts`
since this doc was first written: a failure isolation fix (a health/event
insert failure after a successful reading insert no longer causes a
retryable error that permanently skips those side effects on retry) and
`x-contract-version` header/payload cross-validation. Both are covered by
new regression tests; the contract test count is now 23/23, all mocked,
zero network calls. Also corrected: `.github/workflows/release-deploy.yml`
already automates the deployment steps below on a version-tag push — the
blocker is configuring that workflow's GitHub secrets and pushing a tag,
not writing or running a deploy script by hand.

| Requirement | Status | Evidence |
|---|---|---|
| Bundle (`infra/supabase/functions/edge-ingest/bundle.mjs`) matches current source | **READY** | Rebuilt via `npm run build:edge` this session; the previous checked-in bundle was one commit stale (reflected this phase's own `config.ts` dead-code removal) — now current. No CI check keeps this true automatically (`IMPLEMENTATION_ROADMAP.md` P1, still open). |
| Required env vars/secrets identified | **READY** | Hard-required: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (function returns HTTP 500 immediately if either is missing — verified in `index.ts`). Optional, defaulted if absent: `MAX_TIMESTAMP_DRIFT_SECONDS` (300), `DEFAULT_CONTRACT_VERSION` ("v1"), `SALINITY_WARNING_LEVEL` (1.2), `SALINITY_CRITICAL_LEVEL` (1.8), `LOW_BATTERY_VOLTAGE` (3.6), `LOW_SIGNAL_STRENGTH_DBM` (-95). `push-edge-secrets.mjs` already pushes exactly this set — no changes needed there. |
| Gateway/device HMAC authentication correct | **READY** | `ingest.ts`: authenticating device (`x-device-id`) resolved to a secret via `db.getDeviceSecret()`, signature recomputed with `signPayload()` and compared via `timingSafeEqualHex()` (constant-time). Covered by passing tests: "accepts a station reading signed by its relaying gateway's secret," "rejects a request with a missing... x-timestamp header," "rejects when the authenticating device (gateway) is unknown." |
| Station/device validation correct | **READY** | If the authenticating device differs from the attributed station (`payload.device_id`), the station must independently be `db.isDeviceRegistered()` — a valid gateway signature alone can't attribute a reading to an arbitrary unregistered station. Test: "rejects a relayed reading attributed to an unregistered station." *(Known, documented, unchanged limitation: no check that a specific gateway is authorized to relay for a specific station — fine at 1-gateway pilot scale, a real gap only at multi-gateway scale — see `ARCHITECTURE_DECISION_RECORD.md` §4.)* |
| Duplicate `message_id` handled correctly | **READY** | `supabaseDb.ts`'s `insertEnvironmental`/`insertSoilReading` map a `409`/`23505` (unique-constraint violation) response to `"duplicate_ignored"`, not an error. Test: "ignores duplicate message_id." This exact path was also exercised against the real live database in the prior integration phase (`integration-duplicate-*` audit rows exist in `ingestion_audit_logs`). |
| Invalid telemetry rejected correctly | **READY** | Missing fields, wrong contract version, bad signature, unregistered device, timestamp outside drift window (header and payload independently checked), out-of-range values, and sensor faults are all rejected with a specific `error_code` and a non-2xx status (`httpHandler.ts`'s `statusByCode` map) before any DB write. All covered by passing tests. |
| Soil and water payloads follow the documented contract | **READY** | `hasRequiredFields()`/`isFaulty()`/range checks branch on `reading_kind` exactly as `FIRMWARE_BACKEND_CONTRACT.md` describes: water requires salinity+water_level+both sensor statuses and is rejected whole-payload on any fault; soil requires ≥1 of 6 sensor fields to be a finite number and never uses the water fault model (each sensor independently nulls out). Dedicated 6-test suite passing, including "rejects a soil payload signed with the water canonical string" (cross-format signature confusion) and "soil values out of physical range are rejected." |
| Actually deployed to the live Supabase project | **BLOCKED** | Never deployed. `.github/workflows/release-deploy.yml` already automates this (migrations → push secrets → build bundle → `supabase functions deploy` → post-deploy integration test) on a version-tag push, but requires `SUPABASE_PROJECT_REF`/`SUPABASE_ACCESS_TOKEN`/`SUPABASE_SERVICE_ROLE_KEY`/etc. configured as GitHub repo secrets first, and no tag has been pushed. A local run of `infra/supabase/deploy.ps1` with `npx supabase login` is the manual equivalent. Either path is a real infrastructure action, out of this phase's safe scope, not attempted. |
| Deployed function responds correctly at a real URL | **NEEDS LIVE VERIFICATION** | Can't be checked until the above is done — the mocked test suite proves the *logic* is correct, not that Deno's `serve()` wrapper, CORS headers, or the actual Supabase Functions runtime behave identically. |
| Gateway firmware's `AT+CCLK?`/multi-header `AT+HTTPPARA`/mbedtls-on-hardware assumptions | **NEEDS LIVE VERIFICATION** | Firmware has never been compiled or run on physical hardware (no PlatformIO/ESP32 toolchain available in any session, no SIM module to test against) — unchanged from prior phases. |

## Bottom line

The ingestion **logic** is ready to deploy — two real correctness fixes
(side-effect failure isolation, contract-version header validation) landed
in Phase G, both with regression tests, neither changing the wire
contract or requiring a firmware change. The blocker is purely
operational: either configure `release-deploy.yml`'s GitHub secrets and
push a version tag, or someone with Supabase project access runs
`infra/supabase/deploy.ps1` locally (`npx supabase login` first). Nothing
about the *code* is in question.
