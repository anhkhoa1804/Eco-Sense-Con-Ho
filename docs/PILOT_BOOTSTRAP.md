# Pilot Bootstrap Guide

Public MVP: visitors use the site without login. Only operators authenticate at `/admin/login`.

## 1. Environment (web)

```bash
cp apps/web/.env.local.example apps/web/.env.local
```

Set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon JWT only)
- `SUPABASE_SERVICE_ROLE_KEY` (server only — required for public pages and reports)

## 2. Deploy database and edge

From repo root:

```bash
npm run db:migrate
npm run db:deploy
npm run verify:deploy
```

## 3. Promote an admin operator

1. Operator signs in once at `/admin/login` (magic link).
2. Promote via SQL editor (service role):

```sql
update public.users set role = 'admin' where email = 'ops@example.com';
```

3. Sign in again — `/admin` console should load.

## 4. Pilot seed (stations + devices)

Applied by `npm run db:migrate`:

- Stations `STATION_01` … `STATION_05` and matching devices
- Development secrets in [`infra/supabase/seed/pilot_seed.sql`](../infra/supabase/seed/pilot_seed.sql) — rotate for production

QR visitor URLs: `/s/STATION_01`, `/s/STATION_02`, etc.

## 5. Verify

1. Open `/` and `/dashboard` without login — live metrics render.
2. Open `/s/STATION_01` — station detail and chart.
3. Submit `/report` (text-only).
4. Admin login → `/admin` shows station list.
5. `RUN_RLS_TESTS=1 npm run test:rls`
6. `LIVE_SUPABASE_INTEGRATION=1 npm run test:integration`

## 6. Future farmer accounts (not MVP)

`station_assignments` and farmer RLS remain in the database. When re-enabled:

```sql
insert into public.station_assignments (user_id, station_id, assigned_by)
values ('<farmer-uuid>', 'STATION_01', '<admin-uuid>')
on conflict do nothing;
```

## 7. Field hardware readiness

Checklist before mounting nodes at Đầu Cồn, Homestay Cô Ba, and Cuối Cồn:

**Enclosure:** IP65+ target; sealed glands; anti-corrosion connectors; desiccant schedule.

**Sensors:** Baseline EC calibration; day-7 and day-30 drift checks; cleaning SOP.

**Power:** 7+ duty-cycle battery profile; solar recovery after cloudy days; low-battery alert path.

**Connectivity:** LTE success rate per site; store-and-forward drain on reconnect; no duplicate rows on retry.

**Physical:** Vandal-resistant mount; QR label with station URL; maintenance access path.

**Pilot gate (per station):** 30-day uptime target; no unresolved `SENSOR_FAULT`; signal above floor; battery safe; data continuity KPI met.
