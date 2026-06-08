# Pilot Bootstrap Guide

After ECO-009 authorization is deployed, farmers need **auth profile + station assignments** before the dashboard shows data.

## 1. First login (automatic)

1. Farmer opens `/login` and completes magic-link auth.
2. App calls `ensure_user_profile()` → creates `public.users` row with `role = farmer`.
3. Dashboard is **empty** until stations are assigned.

## 2. Promote an admin (one-time, SQL editor / service role)

Replace email with the ops account:

```sql
-- After the user has logged in at least once
update public.users
set role = 'admin'
where email = 'ops@example.com';
```

## 3. Assign stations to a farmer

Replace UUIDs with values from Supabase Auth → Users and your station IDs:

```sql
insert into public.station_assignments (user_id, station_id, assigned_by)
values
  ('00000000-0000-0000-0000-000000000001', 'STATION_01', '00000000-0000-0000-0000-000000000099'),
  ('00000000-0000-0000-0000-000000000001', 'STATION_02', '00000000-0000-0000-0000-000000000099')
on conflict do nothing;
```

Find farmer UUID:

```sql
select id, email from auth.users where email = 'farmer@example.com';
select id, email, role from public.users where email = 'farmer@example.com';
```

## 4. Pilot seed (stations + devices)

Applied automatically by `npm run db:migrate`:

- 5 stations (`STATION_01` … `STATION_05`)
- 5 devices with pilot secrets (development only)

See [`infra/supabase/seed/pilot_seed.sql`](../infra/supabase/seed/pilot_seed.sql).

## 5. Verify access

1. Log in as farmer → dashboard shows only assigned stations.
2. Log in as admin → all stations visible.
3. Run RLS tests: `RUN_RLS_TESTS=1 npm run test:rls`

## 6. Integration test device

Use device `STATION_01` with secret `station-secret-01` (pilot seed only — rotate for production).

```bash
LIVE_SUPABASE_INTEGRATION=1 npm run test:integration
```
