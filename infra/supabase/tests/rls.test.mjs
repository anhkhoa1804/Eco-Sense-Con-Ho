import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import {
  asAuthenticatedUser,
  assignStation,
  createAppUser,
  loadEnv,
  withClient,
} from "./helpers.mjs";

loadEnv();

const RUN_RLS = process.env.RUN_RLS_TESTS === "1";

describe("production RLS policies", { skip: !RUN_RLS }, () => {
  it("anonymous cannot read stations", async () => {
    const result = await withClient(async (client) => {
      await client.query("set local role anon");
      const { rows } = await client.query(`select count(*)::int as count from public.stations`);
      return rows[0].count;
    });

    if (result.skipped) {
      console.log(`skipped: ${result.reason ?? "DATABASE_URL not set"}`);
      return;
    }

    assert.equal(result.value, 0);
  });

  it("farmer A cannot read farmer B assigned stations", async () => {
    const farmerA = randomUUID();
    const farmerB = randomUUID();

    const outcome = await withClient(async (client) => {
      await createAppUser(client, { id: farmerA, email: "farmer-a@test.local" });
      await createAppUser(client, { id: farmerB, email: "farmer-b@test.local" });
      await assignStation(client, { userId: farmerA, stationId: "STATION_01" });
      await assignStation(client, { userId: farmerB, stationId: "STATION_02" });

      let farmerAStations = [];
      await asAuthenticatedUser(client, farmerA, async (scoped) => {
        const { rows } = await scoped.query(`select id from public.stations order by id`);
        farmerAStations = rows.map((r) => r.id);
      });

      return farmerAStations;
    });

    if (outcome.skipped) {
      return;
    }

    assert.deepEqual(outcome.value, ["STATION_01"]);
    assert.ok(!outcome.value.includes("STATION_02"));
  });

  it("farmer cannot read unassigned environmental_readings", async () => {
    const farmerId = randomUUID();

    const outcome = await withClient(async (client) => {
      await createAppUser(client, { id: farmerId, email: "farmer-readings@test.local" });
      await assignStation(client, { userId: farmerId, stationId: "STATION_01" });

      let count = -1;
      await asAuthenticatedUser(client, farmerId, async (scoped) => {
        const { rows } = await scoped.query(
          `select count(*)::int as count from public.environmental_readings where station_id = 'STATION_02'`,
        );
        count = rows[0].count;
      });

      return count;
    });

    if (outcome.skipped) {
      return;
    }

    assert.equal(outcome.value, 0);
  });

  it("admin can read all stations", async () => {
    const adminId = randomUUID();

    const outcome = await withClient(async (client) => {
      await createAppUser(client, { id: adminId, email: "admin@test.local", role: "admin" });

      let count = 0;
      await asAuthenticatedUser(client, adminId, async (scoped) => {
        const { rows } = await scoped.query(`select count(*)::int as count from public.stations`);
        count = rows[0].count;
      });

      return count;
    });

    if (outcome.skipped) {
      return;
    }

    assert.ok(outcome.value >= 5);
  });

  it("ensure_user_profile creates farmer profile idempotently", async () => {
    const userId = randomUUID();

    const outcome = await withClient(async (client) => {
      await createAuthUser(client, { id: userId, email: "bootstrap@test.local" });

      let firstRole;
      let secondRole;

      await asAuthenticatedUser(client, userId, async (scoped) => {
        const first = await scoped.query(`select public.ensure_user_profile($1, $2) as row`, [
          userId,
          "bootstrap@test.local",
        ]);
        firstRole = first.rows[0].row.role;

        const second = await scoped.query(`select public.ensure_user_profile($1, $2) as row`, [
          userId,
          "bootstrap@test.local",
        ]);
        secondRole = second.rows[0].row.role;
      });

      return { firstRole, secondRole };
    });

    if (outcome.skipped) {
      return;
    }

    assert.equal(outcome.value.firstRole, "farmer");
    assert.equal(outcome.value.secondRole, "farmer");
  });
});
