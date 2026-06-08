# Authorization Model

Eco-Sense uses **Supabase Auth** for identity and **PostgreSQL RLS** for data access. The Next.js dashboard adds a **repository scope layer** that mirrors RLS in application queries.

## Identity

| Layer | Source | Notes |
|-------|--------|-------|
| Authentication | `auth.users` | Magic-link email login |
| Application profile | `public.users` | `id` = `auth.users.id` (FK) |
| Role | `public.users.role` | `farmer` or `admin` |
| Station access | `public.station_assignments` | Many-to-many user ↔ station |

## Roles

### Anonymous (`anon`)

- No access to private telemetry, stations, profiles, or assignments.
- RLS policies target the `authenticated` role only; with RLS enabled and no matching policy, reads are denied.

### Farmer (`farmer`)

- Default role on first login.
- May read only stations listed in `station_assignments`.
- May read telemetry (`environmental_readings`, `environmental_events`, `station_health_logs`) for assigned stations only.
- May read and update own `public.users` row (cannot change role).
- May insert own `damage_logs`.
- May read `crop_thresholds` (reference data).

### Admin (`admin`)

- Full read access to stations, telemetry, events, health logs, devices, ingestion audit logs, firmware updates, and all user profiles.
- May manage `station_assignments`.
- Assigned manually in `public.users` (service role or SQL); farmers cannot self-promote.

## First-login bootstrap

1. User completes magic-link auth → `/auth/callback`.
2. App calls `ensure_user_profile(auth.uid, email)` (RPC).
3. DB function upserts `public.users` with `role = 'farmer'`.
4. Idempotent on repeat logins.

Farmers see an **empty dashboard** until an admin assigns stations.

## Application scope

`RepositoryScope` is required for all farmer-facing repository queries:

```ts
{
  userId: string;
  role: "farmer" | "admin";
  stationIds: string[]; // farmers: assigned IDs; admins: ignored
}
```

- **Admin:** no station filter (full access).
- **Farmer with assignments:** queries filter to `stationIds`.
- **Farmer without assignments:** queries use a no-access sentinel (zero rows).

There is **no fallback** to all stations.

## Ingestion (service role)

Edge function `edge-ingest` uses the Supabase **service role** and bypasses RLS. Device HMAC validation remains in the ingestion service.

## Assigning stations (operations)

See also [`PILOT_BOOTSTRAP.md`](PILOT_BOOTSTRAP.md) for the full pilot onboarding runbook.

```sql
-- As service role / SQL editor
insert into public.station_assignments (user_id, station_id, assigned_by)
values ('<auth-user-uuid>', 'STATION_01', '<admin-user-uuid>')
on conflict do nothing;
```

## Promoting an admin

```sql
update public.users set role = 'admin' where email = 'ops@example.com';
```

Must be performed with service role or superuser (farmers cannot update their own role).

## Helper functions

| Function | Purpose |
|----------|---------|
| `current_user_role()` | Returns role for `auth.uid()` |
| `is_admin()` | True if current user is admin |
| `has_station_access(station_id)` | Admin or assigned farmer |
| `ensure_user_profile(user_id, email)` | Idempotent profile bootstrap |
