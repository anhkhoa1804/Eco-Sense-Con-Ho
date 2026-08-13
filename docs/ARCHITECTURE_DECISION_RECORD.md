# HORIZON Architecture Decision Record

Fifteen decisive answers, each grounded in the source-level trace done
this phase (originally `CANONICAL_ARCHITECTURE.md` — now merged into
`ARCHITECTURE.md` and archived — plus `AUTH_ARCHITECTURE.md`,
`FIRMWARE_BACKEND_CONTRACT.md`, `SENSOR_CAPABILITY_MATRIX.md`,
`TELEMETRY_STATE_MODEL.md`). Where a decision genuinely requires live
infrastructure or physical hardware to make responsibly, that's stated
as such rather than guessed — per the explicit instruction, this
document does not fabricate missing backend or hardware behavior.

**Update (Phase E, 2026-08-13): decision #10 below is now stale.** A real
Supabase project has since been provisioned, reached, and fully migrated —
see `ARCHITECTURE.md`'s "Deployment status" section for the current,
verified picture. #10 is left as originally written for historical
accuracy about what was true when it was decided; do not treat it as
current state. Also added by Phase E, not present when this record was
written: #16 (station topology) and #17 (GCP), since neither question had
been asked yet.

**Update (Phase G, 2026-08-13): #10's "No CI/CD pipeline exists in the
repository" line is also stale, and was wrong for longer than it should
have been** — three GitHub Actions workflows exist
(`.github/workflows/ci-validate.yml`, `ci-live-smoke.yml`,
`release-deploy.yml`), and every phase from E through H repeated this
claim without checking. See `ARCHITECTURE.md`'s "Deployment status"
section for the corrected picture. Migrations 018/019 are also now
tracked in git (confirmed via `git ls-tree -r HEAD`) — #11(a) below's
"still untracked" note is likewise stale.

## 1. Canonical ingestion architecture

**One path**: ESP32 stations → LoRa UART (unsigned, no clock) → gateway
(HMAC-signs on stations' behalf, using its own secret, over a canonical
string carrying the station's device_id) → HTTPS POST → Supabase Edge
Function `edge-ingest` → `environmental_readings` / `soil_readings`.
The former competing path (`/api/public/gateway` → `gateway_
observations`) is confirmed deleted from disk. Settled, already acted
on, holding.

## 2. Canonical database source of truth

`environmental_readings` (water, one row per accepted reading, `message_
id` unique) and `soil_readings` (soil, same shape, every measurement
independently nullable). `environmental_data`/`environmental_data_
legacy` are fully removed. `gateway_observations` is dead — schema
present, RLS admin-only, zero code writes to it; recommend dropping it
in a future migration once there's confidence no historical row in it
matters (not this pass — dropping captured data is a separate decision
from deprecating a write path, and no one has affirmed the historical
rows are worthless).

## 3. Human authentication system

Custom password + HMAC-signed cookie for the single shared admin role,
staying that way. Supabase Auth (magic-link) is fully built and
completely unwired — kept as dormant, correct scaffolding for a future
per-person farmer login, not deleted, not connected to anything until a
real farmer-facing feature is scoped with an actual UI.

## 4. Machine authentication system

HMAC-SHA256 over a pipe-delimited canonical string, gateway-relay model:
the authenticating device (`x-device-id`) may differ from the attributed
device (`payload.device_id`), both independently validated as
registered/active. Sound as designed. One real gap, not fixed this pass
because it doesn't matter at current scale: no gateway↔station
ownership check — any active gateway can relay for any active station.

## 5. Where RLS is used

Public reads only, currently: `stations`, `environmental_readings`,
`environmental_events`, `station_health_logs`, `crop_thresholds`,
`soil_readings`, all `to anon using (true)` (migrations 018/019). The
`authenticated`-role, `has_station_access()`-scoped policies from
migration 009 exist and are correctly written but are not the live
enforcement boundary for anything today, because nothing authenticates
as a Supabase-Auth user in the current product.

## 6. Where service-role is used

Exactly two server-only boundaries: the ingestion edge function, and
`apps/web/app/admin/*` (including `adminAllowlist.ts`). Nowhere else —
verified by tracing every `createServiceClient()` call site this
session. This is the correct, minimal footprint; no change recommended.

## 7. Firmware/backend contract

Byte-for-byte consistent as written (verified by direct side-by-side
reading of `gateway.ino` and `canonical.ts`/`ingest.ts`/`types.ts`).
The gap is deployment, not the contract: `EDGE_INGEST_URL` and
`CONFIG_URL` are both placeholder values in firmware, never pointed at a
real deployment; firmware has never been compiled. See
`FIRMWARE_BACKEND_CONTRACT.md`.

## 8. What measurements HORIZON actually supports

**Real, sensor-to-schema-complete**: soil moisture, soil temperature,
soil EC, soil pH, air temperature, air humidity (all Station 2) —
sensor code is real, `soil_readings` columns exist, ingestion validation
is correct. **Real sensor, but currently unstorable**: water level
(Station 1) — sensor works, but every payload is rejected due to the EC
stub poisoning the fault-flags check (see #13). **Not implemented**:
salinity (EC probe is a stub, always null). **Structurally impossible
today**: battery voltage, signal strength for either station (gateway
can't honestly measure a relayed station's own power/link state — by
design, not a bug). **Never reaches the schema**: gateway delivery rate
(no data source anywhere), the firmware-computed `advice` string
(deliberately dropped at the gateway relay step, and correctly so — see
`SENSOR_CAPABILITY_MATRIX.md` for why storing an un-versioned firmware
opinion as data would be its own honesty problem).

## 9. Telemetry state model

Two independent axes — freshness (`LIVE`/`RECENT`/`STALE`/`OFFLINE`/
`NEVER_CONNECTED`) and value quality (`VALID`/`ESTIMATED`/`ERROR`) —
plus `stations.status` as a separate, administrator-set operational-
intent field that must be shown alongside freshness, never merged into
it. Supersedes this same session's earlier `StatusIndicator` single-enum
design — see `TELEMETRY_STATE_MODEL.md` for the full correction and why.

## 10. Deployment architecture

**Backend/frontend: LIVE. Field hardware/ingestion function: NOT YET
DEPLOYED.** (Updated Phase E/F — this decision originally read "LOCAL
only, entirely," which was accurate when written and is preserved in git
history, but is no longer true.) The Supabase project
(`edhcnccvbwuffiwzywfm`) is provisioned, reachable, and fully migrated
(001–019). The Next.js application reads real data from it in production.
No Edge Function has ever been deployed — `edge-ingest` only runs locally
under `tsx --test`, though `.github/workflows/release-deploy.yml` already
automates deployment on a version tag push (see Phase G update above). No
firmware has ever been flashed. There is still no STAGING or PRODUCTION
telemetry path today: nothing has ever sent a real signed reading through
the deployed system, because the two things needed to do that (a
deployed edge function, and compiled/flashed firmware) don't exist yet.
See `ARCHITECTURE.md`'s "Deployment status" section for the current,
maintained version of this picture.

## 11. What must be built before production

Updated — item (a) and (d) below are done; kept for the historical
dependency ordering, not as an open list:

(a) ~~a real Supabase project, with migrations 001–019 applied in order
and 018/019 committed to git first~~ **DONE, fully** — both migrations are
now tracked in git; (b) `readWaterEc()` implemented against the real EC
probe, since without it Station 1 can never store a reading; (c) firmware
actually compiled (PlatformIO toolchain) and flashed to real ESP32
hardware, with the placeholder `EDGE_INGEST_URL`/`CONFIG_URL`/
`GATEWAY_DEVICE_SECRET` replaced with real values; (d) ~~the
`soil_readings` repository-read gap closed~~ **DONE, fully** — the
repository method exists and `station-detail.tsx` now calls it, rendering
real EC/moisture/pH values when present; the table still holds zero live
rows because nothing has ever ingested a soil payload, which is an
ingestion-deployment gap, not a UI gap anymore; (e) the three NOT-VERIFIED
gateway
firmware assumptions (AT+CCLK format, multi-header AT+HTTPPARA behavior,
mbedtls-on-real-hardware) confirmed against the actual SIM module and
board; (f) **new**: deploy `edge-ingest` as a real Supabase Edge Function
— this is now the single biggest remaining gap between "backend is live"
and "a real device could actually send data," see
`EDGE_INGEST_READINESS.md`.

## 12. What can remain deferred

Farmer-facing login and any station-scoped human access (system exists,
zero product spec, zero urgency without a real farmer user to design
for). Gateway↔station ownership enforcement (matters at multi-gateway
scale, not at one gateway). Automated device-secret rotation (manual
rotation is fine for ~6 devices). Admin route-level separation (single
dense page is still appropriate at current data volume). Dropping
`gateway_observations` (no urgency, no one's affirmed the old rows are
disposable).

## 13. What existing code should be removed

Nothing wholesale. Two things worth a small, targeted cleanup, not a
removal of working systems: the `devices.device_secret_hash` column
(dead — never read by the actual auth path, and MD5 wouldn't be an
appropriate secret hash even if it were) should either be dropped or
given a real purpose; and this session's own `StatusIndicator` enum
values that are never produced (`estimated`/`invalid`/`warning`/
`critical`) should be replaced by the two-axis model from
`TELEMETRY_STATE_MODEL.md` rather than carried forward unused.

## 14. What existing code should be preserved

Everything else, explicitly including code that looks unused today:
the Supabase-Auth scaffolding (§3), the direct-connect device path in
`ingest.ts` (unused today, zero-cost to keep, and the contract already
supports it without modification), `firmware_updates`/OTA plumbing
(unpopulated but structurally sound and cheap to keep), the rollup/
retention functions in migrations 004/015 (correct, just not yet
scheduled). None of this is dead weight in the sense of being wrong —
it's dormant, correctly-built capacity for known future needs, and
deleting it would just mean rebuilding it later with no memory of the
reasoning already captured in `ARCHITECTURE_DECISIONS.md`.

## 15. What requires live Supabase/GCP/hardware verification

Everything about actual deployed behavior, listed precisely rather than
waved at: whether migrations 001–019 apply cleanly in sequence against a
fresh Postgres instance; whether the anon-key RLS policies actually
produce the intended row visibility under real traffic; whether the
`getLatestForAllStations`/`getLatestHealthForAllStations` nested-
embedding queries perform correctly at real data volume; whether the
Edge Function actually deploys and responds at a real
`*.supabase.co/functions/v1/edge-ingest` URL; whether the gateway's SIM
module's `AT+CCLK?` response actually matches the assumed SIMCom format;
whether `AT+HTTPPARA="USERDATA"` actually appends rather than overwrites
across repeated calls; whether mbedtls HMAC produces byte-identical
output to the TypeScript `crypto.subtle` implementation when run on real
ESP32 hardware (should, per spec, but "should" isn't "verified"); and
whether the firmware compiles at all (no PlatformIO toolchain has been
available in any session to date). None of this can be responsibly
resolved from source review alone, and none of it has been fabricated
or assumed working in this document.

## 16. Station topology (Phase E)

**Decision: HORIZON is a fixed 3-station pilot, not a 5-station
deployment**, verified at the firmware level: `platformio.ini` defines
exactly three build environments (`station1`, `station2`, `gateway`) and
no others. `apps/web/app/admin/page.tsx`'s `managedStationIds` and
`apps/web/app/api/public/gateway/configs/route.ts`'s `defaultConfigs` are
both correctly, intentionally scoped to `STATION_01`–`STATION_03`. The
live database's `STATION_04`/`STATION_05` rows originate from
`services/edge-ingestion/scripts/simulator.ts`'s 5-station fixture list
(same names, same coordinates as `pilot_seed.sql`) — they are dev/seed
artifacts carried into the pilot seed file, not evidence of a real or
planned 5th/4th station. See `ARCHITECTURE.md`'s "Station topology"
section for the full evidence trail. Do not build features that assume 5
operational stations exist.

## 17. Is GCP required (Phase E)

**Decision: no.** A repository-wide search found zero code, firmware, or
configuration that depends on any Google Cloud product. GCP appears only
as a hypothetical checklist column in `IMPLEMENTATION_ROADMAP.md`,
answered "No" everywhere except one speculative aside about CI hosting.
Supabase (Postgres + Edge Functions + Auth) plus Next.js's own deployment
model already provide everything GCP could plausibly add. Do not introduce
GCP without a concrete, named technical requirement Supabase cannot
satisfy.
