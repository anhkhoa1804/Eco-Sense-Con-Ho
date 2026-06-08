# RLS Policy Matrix

Policies are defined in `infra/supabase/migrations/009_production_rls.sql`.  
Helper functions are in `008_auth_and_assignments.sql`.

Legend: **✓** allowed · **✗** denied · **own** own rows only · **scoped** assigned stations only

## Core tables

| Table | Anonymous | Farmer | Admin |
|-------|-----------|--------|-------|
| `users` | ✗ | **own** SELECT/UPDATE; INSERT self as `farmer` | ✓ all |
| `station_assignments` | ✗ | **own** SELECT | ✓ all + write |
| `stations` | ✗ | **scoped** SELECT | ✓ all |
| `environmental_readings` | ✗ | **scoped** SELECT | ✓ all |
| `environmental_events` | ✗ | **scoped** SELECT | ✓ all |
| `station_health_logs` | ✗ | **scoped** SELECT | ✓ all |
| `environmental_data` (legacy) | ✗ | **scoped** SELECT | ✓ all |
| `crop_thresholds` | ✗ | ✓ SELECT | ✓ SELECT |
| `damage_logs` | ✗ | **own** SELECT/INSERT | ✓ all |

## Admin-only tables

| Table | Anonymous | Farmer | Admin |
|-------|-----------|--------|-------|
| `devices` | ✗ | ✗ | ✓ SELECT |
| `ingestion_audit_logs` | ✗ | ✗ | ✓ SELECT |
| `firmware_updates` | ✗ | ✗ | ✓ SELECT |

## Write paths

| Operation | Actor | Mechanism |
|-----------|-------|-----------|
| Telemetry INSERT | Edge function | Service role (bypasses RLS) |
| Profile bootstrap | Authenticated user | `ensure_user_profile()` SECURITY DEFINER |
| Station assignment | Admin | `station_assignments_admin_write` policy |
| Damage report | Farmer | `damage_logs_insert_own` |

## Policy names

| Policy | Table | Operation |
|--------|-------|-----------|
| `users_select_own_or_admin` | users | SELECT |
| `users_insert_self` | users | INSERT |
| `users_update_self_or_admin` | users | UPDATE |
| `station_assignments_select_own_or_admin` | station_assignments | SELECT |
| `station_assignments_admin_write` | station_assignments | ALL |
| `stations_select_scoped` | stations | SELECT |
| `crop_thresholds_select_authenticated` | crop_thresholds | SELECT |
| `environmental_readings_select_scoped` | environmental_readings | SELECT |
| `environmental_events_select_scoped` | environmental_events | SELECT |
| `environmental_data_select_scoped` | environmental_data | SELECT |
| `station_health_logs_select_scoped` | station_health_logs | SELECT |
| `damage_logs_select_own_or_admin` | damage_logs | SELECT |
| `damage_logs_insert_own` | damage_logs | INSERT |
| `ingestion_audit_logs_admin_select` | ingestion_audit_logs | SELECT |
| `devices_admin_select` | devices | SELECT |
| `firmware_updates_admin_select` | firmware_updates | SELECT |

## Testing

RLS integration tests (require live DB + applied migrations):

```bash
RUN_RLS_TESTS=1 npm run test:rls -w @eco-sense/supabase-infra
```

Unit tests for repository scope and auth bootstrap:

```bash
npm run test -w @eco-sense/web
```
