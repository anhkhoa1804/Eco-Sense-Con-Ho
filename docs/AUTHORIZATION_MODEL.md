# Authorization Model

Eco-Sense uses **Supabase Auth** for operator identity, **PostgreSQL RLS** for direct database access, and a **Next.js server layer** for public read paths.

## Public web access (MVP)

Visitors do **not** authenticate. Public pages (`/`, `/about`, `/dashboard`, `/s/*`, `/report`) load telemetry via:

- Next.js Server Components and Route Handlers
- `SUPABASE_SERVICE_ROLE_KEY` (server only — never `NEXT_PUBLIC_*`)
- Existing repositories with a fixed admin-equivalent read scope

Database RLS remains strict: the `anon` role cannot SELECT telemetry (`012_revoke_anon_sensitive_grants.sql`). Public reads bypass RLS only inside trusted server code.

Community reports are inserted via `POST /api/public/reports` using the service role (`user_id` null). This is not exposed through anon PostgREST.

## Identity (authenticated)

| Layer | Source | Notes |
|-------|--------|-------|
| Authentication | `auth.users` | Magic-link email — **admin operators only** in MVP UI |
| Application profile | `public.users` | `id` = `auth.users.id` (FK) |
| Role | `public.users.role` | `farmer` or `admin` |
| Station access | `public.station_assignments` | Future farmer accounts; unused in public MVP |

## Roles

### Anonymous (`anon`)

- No direct access to telemetry, stations, profiles, or assignments via PostgREST.
- Public website uses server-side service role, not anon queries.

### Farmer (`farmer`) — deferred UX

- Default role on first login (`ensure_user_profile`).
- May read only assigned stations; may insert own `damage_logs`.
- **Not used in public MVP UI.** Schema and RLS retained for future accounts.

### Admin (`admin`)

- Full read access to stations, telemetry, events, health logs, devices, audit logs, firmware, profiles.
- May manage `station_assignments`.
- Promoted manually in SQL; cannot self-promote.

## Application scope

`RepositoryScope` for authenticated repository queries:

```ts
{
  userId: string;
  role: "farmer" | "admin";
  stationIds: string[];
}
```

Public server reads use `{ role: "admin", userId: "public-read", stationIds: [] }` with the service client only.

## Ingestion (service role)

Edge function `edge-ingest` uses the service role and bypasses RLS. Device HMAC validation remains in the ingestion service.

## Promoting an admin

```sql
update public.users set role = 'admin' where email = 'ops@example.com';
```

Perform after the operator has logged in once at `/admin/login`. See [`PILOT_BOOTSTRAP.md`](PILOT_BOOTSTRAP.md).

## RLS policy matrix

Policies: `infra/supabase/migrations/009_production_rls.sql`. Helpers: `008_auth_and_assignments.sql`.

Legend: **✓** allowed · **✗** denied · **own** own rows · **scoped** assigned stations only

### Core tables

| Table | Anonymous | Farmer | Admin |
|-------|-----------|--------|-------|
| `users` | ✗ | **own** SELECT/UPDATE; INSERT self as `farmer` | ✓ all |
| `station_assignments` | ✗ | **own** SELECT | ✓ all + write |
| `stations` | ✗ | **scoped** SELECT | ✓ all |
| `environmental_readings` | ✗ | **scoped** SELECT | ✓ all |
| `environmental_events` | ✗ | **scoped** SELECT | ✓ all |
| `station_health_logs` | ✗ | **scoped** SELECT | ✓ all |
| `crop_thresholds` | ✗ | ✓ SELECT | ✓ SELECT |
| `damage_logs` | ✗ | **own** SELECT/INSERT | ✓ SELECT all |

### Admin-only tables

| Table | Anonymous | Farmer | Admin |
|-------|-----------|--------|-------|
| `devices` | ✗ | ✗ | ✓ SELECT |
| `ingestion_audit_logs` | ✗ | ✗ | ✓ SELECT |
| `firmware_updates` | ✗ | ✗ | ✓ SELECT |

### Write paths

| Operation | Actor | Mechanism |
|-----------|-------|-----------|
| Telemetry INSERT | Edge function | Service role |
| Public telemetry read | Next.js server | Service role (curated pages) |
| Community report INSERT | Public visitor | `POST /api/public/reports` (service role) |
| Profile bootstrap | Authenticated user | `ensure_user_profile()` |
| Station assignment | Admin | `station_assignments_admin_write` |

### Testing

```bash
RUN_RLS_TESTS=1 npm run test:rls -w @eco-sense/supabase-infra
npm run test -w @eco-sense/web
```
