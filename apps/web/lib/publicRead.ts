import "server-only";

import { createRepositories, type Repositories } from "@/lib/repositories";
import { createAnonClient } from "@/lib/supabase/anon";
import type { RepositoryScope } from "@/types";

/**
 * role: "admin" here means "no application-layer station filter" — it does
 * NOT mean this scope has admin database privileges. The underlying client
 * (createAnonClient) carries the anon Postgres role, so the real boundary
 * is migration 018's RLS policies: only stations/environmental_readings/
 * environmental_events/station_health_logs/crop_thresholds are visible,
 * regardless of what this scope object says.
 */
export const PUBLIC_READ_SCOPE: RepositoryScope = {
  userId: "public-read",
  role: "admin",
  stationIds: [],
};

export const PUBLIC_REVALIDATE_SECONDS = 60;

export function getPublicRepositories():
  | { repos: Repositories; scope: RepositoryScope }
  | null {
  const client = createAnonClient();

  if (!client) {
    return null;
  }

  return {
    repos: createRepositories(client),
    scope: PUBLIC_READ_SCOPE,
  };
}