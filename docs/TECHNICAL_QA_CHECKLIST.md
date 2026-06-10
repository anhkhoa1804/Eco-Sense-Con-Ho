# Technical QA Checklist

Verify the stack before demo and pilot deployment.

## 1. Preflight

- Node.js and `npm install` at repo root
- `npm run check` passes
- `apps/web/.env.local` has URL, anon key, and **service role key**

## 2. Backend commands

```bash
npm run verify:deploy
npm run test
LIVE_SUPABASE_INTEGRATION=1 npm run test:integration
RUN_RLS_TESTS=1 npm run test:rls
```

## 3. Ingestion smoke

```bash
npm run simulator
npm run mock:ingest
```

Expect: inserted, duplicate_ignored, SENSOR_FAULT paths.

## 4. Frontend smoke (public MVP)

```bash
npm run build -w @eco-sense/web
npm run dashboard
```

Open `http://localhost:4173`:

| URL | Expect |
|-----|--------|
| `/` | Home with live summary KPIs |
| `/dashboard` | Station cards + alerts (no login) |
| `/s/STATION_01` | Station detail + 24h chart |
| `/report` | Submit text report |
| `/admin/login` | Admin magic link |
| `/admin` | Blocked without admin session |

## 5. Data integrity

- Duplicate `message_id` → no duplicate readings
- Fault telemetry → `SENSOR_FAULT` event + audit
- Accepted telemetry → health log + accepted audit
- Inactive device → rejected ingest

## 6. Pilot gate

- QA commands green
- Migrations applied in target environment
- Public dashboard shows live staging/prod data
- Field hardware checklist in [`PILOT_BOOTSTRAP.md`](PILOT_BOOTSTRAP.md) signed off
