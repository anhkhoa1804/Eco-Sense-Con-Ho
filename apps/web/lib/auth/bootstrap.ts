import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserProfile } from "@/types";

export async function ensureUserProfile(
  supabase: SupabaseClient,
  authUser: { id: string; email?: string | null },
): Promise<UserProfile> {
  const email = authUser.email ?? "";

  const { data, error } = await supabase.rpc("ensure_user_profile", {
    p_user_id: authUser.id,
    p_email: email || null,
  });

  if (error) {
    const { data: existing, error: readError } = await supabase
      .from("users")
      .select("id, phone, role, email")
      .eq("id", authUser.id)
      .maybeSingle();

    if (readError) throw readError;
    if (!existing) throw error;

    return {
      id: authUser.id,
      email,
      role: (existing.role as UserProfile["role"]) ?? "farmer",
      phone: (existing.phone as string | null) ?? null,
      assignedStationIds: [],
    };
  }

  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;

  return {
    id: authUser.id,
    email,
    role: (row?.role as UserProfile["role"]) ?? "farmer",
    phone: (row?.phone as string | null) ?? null,
    assignedStationIds: [],
  };
}
