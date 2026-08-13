# HORIZON Implementation Roadmap

Prioritized from the findings in this phase's architecture documents.
P0 = security/data-integrity/architectural blockers. P1 = live backend
integration. P2 = firmware/gateway integration. P3 = frontend production
integration. P4 = design polish. P5 = observability/deployment/
hardening.

**Updated 2026-08-13** (Phase E reconciliation) to reflect what's actually
done — see `ARCHITECTURE.md`'s "Deployment status" section for the full
current-vs-future picture. Items marked **DONE** below since the original
P0/P1 pass are struck through in spirit, not deleted, so the roadmap keeps
an honest record of what was actually true at each point.

## P0 — security / data integrity / architectural blockers

| Item | Files | Risk | Test strategy | Hardware? | Live Supabase? | GCP? |
|---|---|---|---|---|---|---|
| Commit migrations 018/019 to git | `infra/supabase/migrations/018_*.sql`, `019_*.sql` | Low — pure `git add`, no code change | `git log` shows the files tracked | No | No | No |
| Fix `readWaterEc()` fault cascade blocking all water storage | `firmware/esp32-node/src/trạm 1.ino` | High if done wrong (a bad EC read could poison good water-level data the same way the stub currently does) | Unit-testable in isolation once the real sensor protocol is known; full validation needs the physical probe | **Yes** — needs the ES-EC-WT-01 datasheet/register map | No | No |
| Remove or repurpose `devices.device_secret_hash` | new migration | Low | Migration review; confirm nothing reads the column first (`grep device_secret_hash`) | No | Applied against a real DB to verify | No |
| ~~Replace `StatusIndicator`'s conflated enum with the two-axis model~~ **DONE** | `apps/web/components/ui/status-indicator.tsx` | — | Confirmed live: `FreshnessState`/`QualityState` two-axis model in place, old 9-value enum gone | No | No | No |

## P1 — live backend integration

| Item | Files | Risk | Test strategy | Hardware? | Live Supabase? | GCP? |
|---|---|---|---|---|---|---|
| ~~Provision a real Supabase project~~ **DONE** | `infra/supabase/*` | — | Confirmed live and reachable (`edhcnccvbwuffiwzywfm`) | No | Yes | No |
| ~~Apply migrations 001→019 in order~~ **DONE** | same | — | All 19 applied via `npm run db:migrate`; verified via anon REST reads | No | Yes | No |
| ~~Add `soil_readings` repository method~~ **DONE**, UI wiring still pending | `apps/web/lib/repositories/readingRepository.ts` | Low — the UI half (`station-detail.tsx`) is a separate, still-open item since `soil_readings` has zero live rows to display yet | Unit tests pass (`tests/soilReadingRepository.test.ts`) | No | No (table is real, just empty) | No |
| Deploy `edge-ingest` as a real Edge Function | `infra/supabase/functions/edge-ingest/*` | Medium — first real deployment of a bundle that's only ever run under `tsx --test` | `services/edge-ingestion/tests/contract.test.ts` (already passing locally) + a real curl/Postman POST once deployed | No | Yes | No |
| Add CI check that `bundle.mjs` matches a fresh `npm run build:edge` output | `services/edge-ingestion/package.json`, new CI config | Low | Diff bundle.mjs before/after rebuild in CI | No | No | Possibly, if CI runs on GCP-hosted infra — otherwise no |

## P2 — firmware/gateway integration

| Item | Files | Risk | Test strategy | Hardware? | Live Supabase? | GCP? |
|---|---|---|---|---|---|---|
| Compile firmware for the first time | `firmware/esp32-node/*` | High — never verified, likely first-compile errors | `pio run` per environment (station1/station2/gateway) | **Yes** — needs PlatformIO/ESP32 toolchain, doesn't need the physical board yet | No | No |
| Flash and bench-test against real sensors | same | High | Physical bring-up, one station at a time | **Yes, physical hardware** | No | No |
| Replace `EDGE_INGEST_URL`/`CONFIG_URL`/`GATEWAY_DEVICE_SECRET` placeholders | `gateway.ino` | Low once P1's Edge Function is deployed | Point at the real URL, confirm a relayed reading round-trips | Yes (to actually send) | Yes (destination must exist) | No |
| Verify AT+CCLK/AT+HTTPPARA/mbedtls assumptions | `gateway.ino` | High — three explicitly-flagged unverified assumptions | Real SIM module + serial monitor | **Yes** | No | No |
| Gateway↔station ownership check | `services/edge-ingestion/src/ingest.ts`, new migration for a pairing table | Low-medium, deferred (P12 in the ADR) — only needed at multi-gateway scale | Unit test once designed | No | No | No |

## P3 — frontend production integration

| Item | Files | Risk | Test strategy | Hardware? | Live Supabase? | GCP? |
|---|---|---|---|---|---|---|
| Reconcile `stations.status` vs. freshness display | `station-detail.tsx`, `dashboard/page.tsx` | Low — presentation only, no data model change | Manual check with a deliberately-mismatched test row | No | Helpful, not required (can fake with `MockDb`) | No |
| One documented empty/stale-segment chart convention | `salinity-chart.tsx`, `station-live-chart.tsx`, `daily-comparison-chart.tsx` | Low | Visual check with sparse test data | No | No | No |
| Admin device/ingestion-health table | new `apps/web/app/admin/page.tsx` section, reads `ingestion_audit_logs`/`environmental_events`/`devices` | Medium — new admin surface, service-role reads | Manual QA once real data exists | No | Yes, to be useful (data is currently empty without it) | No |

## P4 — design polish

| Item | Files | Risk | Test strategy | Hardware? | Live Supabase? | GCP? |
|---|---|---|---|---|---|---|
| Replace illustrated PNG map with a schematic network diagram | `dashboard/page.tsx`'s `StationMap` | Low — presentation only | Visual review, mobile + desktop | No | No | No |
| Admin operational-register visual pass | `apps/web/app/admin/page.tsx` and admin-specific components | Low-medium | Visual review | No | No | No |
| Dashboard secondary navigation (section anchors) | `dashboard/page.tsx`, `public-shell.tsx` | Low | Manual scroll/anchor-link check | No | No | No |

## P5 — observability / deployment / hardening

| Item | Files | Risk | Test strategy | Hardware? | Live Supabase? | GCP? |
|---|---|---|---|---|---|---|
| Schedule `cleanup_horizon_data()`/rollup functions | `infra/supabase/migrations/004_*.sql`, `015_*.sql`, pg_cron or external scheduler | Low, deferred until real data volume exists | Manual invocation first, then scheduled | No | Yes | Depends on scheduler choice |
| CI/CD pipeline | none exists today | Medium — greenfield | Start with typecheck/lint/test on push; add build/deploy once a real project exists | No | Eventually | Possibly, depending on host choice |
| External monitoring/alerting | none exists today | Low, deferred — no production traffic to monitor yet | N/A until P1/P2 land | No | Yes | Possibly |
| Device-secret rotation tooling | deferred per ADR §12 — manual is adequate at ~6 devices | Low | N/A | No | No | No |

## Sequencing note

P0's git-commit and enum-fix items are safe to do immediately — no
external dependency. Everything else in P0 (`readWaterEc()`) and all of
P1/P2 are blocked on either the physical EC probe/datasheet or a real
Supabase project, neither available in this environment. P3's admin
health table is blocked on P1 (needs a live project to have any data
worth showing) but its code can be written and tested against mocked
data in the meantime — a legitimate "write it now, verify it later"
item, distinct from P1/P2's genuine hard blocks.
