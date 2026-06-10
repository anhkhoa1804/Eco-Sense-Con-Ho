import "server-only";
import { createRepositories, type Repositories } from "@/lib/repositories";
import { createServiceClient } from "@/lib/supabase/service";
import type { RepositoryScope } from "@/types";

/** Server-only scope for public pages: reads all stations via service role. */
export const PUBLIC_READ_SCOPE: RepositoryScope = {
  userId: "public-read",
  role: "admin",
  stationIds: [],
};

export const PUBLIC_REVALIDATE_SECONDS = 60;

export function getPublicRepositories(): { repos: Repositories; scope: RepositoryScope } {
  const repos = createRepositories(createServiceClient());
  return { repos, scope: PUBLIC_READ_SCOPE };
}
