import type { SupabaseClient } from "@supabase/supabase-js";
import type { RepositoryScope } from "@/types";

/** Sentinel used to produce zero rows when a farmer has no assignments. */
export const NO_ACCESS_STATION_ID = "__NO_ACCESS__";

export function isAdminScope(scope: RepositoryScope): boolean {
  return scope.role === "admin";
}

export function scopedStationIds(scope: RepositoryScope): string[] | null {
  if (isAdminScope(scope)) {
    return null;
  }
  if (scope.stationIds.length === 0) {
    return [NO_ACCESS_STATION_ID];
  }
  return scope.stationIds;
}

export function canAccessStation(scope: RepositoryScope, stationId: string): boolean {
  if (isAdminScope(scope)) {
    return true;
  }
  return scope.stationIds.includes(stationId);
}

export function applyStationScope<T extends { in: (col: string, vals: string[]) => T }>(
  query: T,
  scope: RepositoryScope,
): T {
  const ids = scopedStationIds(scope);
  if (ids) {
    return query.in("station_id", ids);
  }
  return query;
}

export function applyStationIdScope<T extends { in: (col: string, vals: string[]) => T }>(
  query: T,
  scope: RepositoryScope,
): T {
  const ids = scopedStationIds(scope);
  if (ids) {
    return query.in("id", ids);
  }
  return query;
}

export function latestByStation<T extends { station_id: string; timestamp: string }>(rows: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    const existing = map.get(row.station_id);
    if (!existing || new Date(row.timestamp) > new Date(existing.timestamp)) {
      map.set(row.station_id, row);
    }
  }
  return map;
}

export type AppSupabase = SupabaseClient;
