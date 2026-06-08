import { createClient } from "@/lib/supabase/server";
import { createRepositories } from "@/lib/repositories";
import { ensureUserProfile } from "@/lib/auth/bootstrap";
import type { RepositoryScope, UserProfile } from "@/types";

export async function getSessionContext(): Promise<{
  user: { id: string; email: string } | null;
  profile: UserProfile | null;
  scope: RepositoryScope | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { user: null, profile: null, scope: null };
  }

  await ensureUserProfile(supabase, user);

  const repos = createRepositories(supabase);
  const profile = await repos.users.getProfile(user.id, user.email);
  const scope = repos.users.buildScope(profile);

  return {
    user: { id: user.id, email: user.email },
    profile,
    scope,
  };
}
