import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ensureUserProfile } from "@/lib/auth/bootstrap";

function createMockSupabase(options: {
  rpcResult?: { data: unknown; error: unknown };
  existingUser?: Record<string, unknown> | null;
  readError?: { message: string } | null;
}) {
  return {
    rpc: async () => options.rpcResult ?? { data: { role: "farmer", phone: null }, error: null },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: options.existingUser ?? null,
            error: options.readError ?? null,
          }),
        }),
      }),
    }),
  };
}

describe("ensureUserProfile", () => {
  it("returns profile from rpc result", async () => {
    const supabase = createMockSupabase({
      rpcResult: {
        data: { role: "farmer", phone: null, email: "farmer@test.local" },
        error: null,
      },
    });

    const profile = await ensureUserProfile(supabase as never, {
      id: "user-1",
      email: "farmer@test.local",
    });

    assert.equal(profile.id, "user-1");
    assert.equal(profile.role, "farmer");
    assert.deepEqual(profile.assignedStationIds, []);
  });

  it("falls back to users table when rpc fails but row exists", async () => {
    const supabase = createMockSupabase({
      rpcResult: { data: null, error: { message: "rpc unavailable" } },
      existingUser: { id: "user-2", role: "admin", phone: "+84000000000", email: "admin@test.local" },
    });

    const profile = await ensureUserProfile(supabase as never, {
      id: "user-2",
      email: "admin@test.local",
    });

    assert.equal(profile.role, "admin");
    assert.equal(profile.phone, "+84000000000");
  });

  it("throws when rpc fails and profile is missing", async () => {
    const supabase = createMockSupabase({
      rpcResult: { data: null, error: { message: "rpc unavailable" } },
      existingUser: null,
    });

    await assert.rejects(async () => {
      await ensureUserProfile(supabase as never, {
        id: "user-3",
        email: "missing@test.local",
      });
    });
  });
});
