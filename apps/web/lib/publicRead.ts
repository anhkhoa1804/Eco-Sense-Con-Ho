import "server-only";

import { createRepositories, type Repositories } from "@/lib/repositories";
import { createServiceClient } from "@/lib/supabase/service";
import type { RepositoryScope } from "@/types";

export const PUBLIC_READ_SCOPE: RepositoryScope = {
  userId: "public-read",
  role: "admin",
  stationIds: [],
};

export const PUBLIC_REVALIDATE_SECONDS = 60;

export function getPublicRepositories():
  | { repos: Repositories; scope: RepositoryScope }
  | null {
  const client = createServiceClient();

  if (!client) {
    return null;
  }

  return {
    repos: createRepositories(client),
    scope: PUBLIC_READ_SCOPE,
  };
}