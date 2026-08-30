import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { isPilotStation, PILOT_STATION_IDS, stationHref } from "@/lib/publicStations";
import { stationProfiles } from "@/lib/stationProfile";

describe("canonical station links", () => {
  it("builds the expected route for every pilot station", () => {
    assert.equal(stationHref("STATION_01"), "/s/STATION_01");
    assert.equal(stationHref("STATION_02"), "/s/STATION_02");
    assert.equal(stationHref("STATION_03"), "/s/STATION_03");
  });

  it("covers exactly the three pilot stations", () => {
    assert.deepEqual([...PILOT_STATION_IDS], ["STATION_01", "STATION_02", "STATION_03"]);
  });

  it("rejects the simulator fixtures that exist in the database", () => {
    // STATION_04/05 are seed rows, not operational hardware — they must not
    // become linkable routes.
    assert.ok(!isPilotStation("STATION_04"));
    assert.ok(!isPilotStation("STATION_05"));
    assert.ok(!isPilotStation("nonsense"));
  });

  it("has a profile for every linkable station", () => {
    // A link that resolves to a station with no profile would 404 or render
    // a nameless page.
    for (const id of PILOT_STATION_IDS) {
      assert.ok(stationProfiles[id], `no profile for ${id}`);
      assert.ok(stationProfiles[id].name.length > 0);
    }
  });

  it("never links a station to itself in an 'other stations' list", () => {
    // Regression guard: "Trạm khác" previously iterated every profile
    // including the current one, so STATION_01's page listed STATION_01 as
    // somewhere else to go.
    for (const current of PILOT_STATION_IDS) {
      const others = PILOT_STATION_IDS.filter((id) => id !== current);
      assert.equal(others.length, 2);
      assert.ok(!others.includes(current));
      assert.ok(!others.map(stationHref).includes(stationHref(current)));
    }
  });
});

describe("station link call sites", () => {
  it("constructs /s/ paths only through the canonical helper", () => {
    // Guards the invariant rather than a single instance of it: a new
    // hardcoded `/s/${id}` anywhere in app/ or components/ fails this.
    const roots = ["app", "components"].map((d) => path.join(process.cwd(), d));
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name)) {
          const src = fs.readFileSync(full, "utf8");
          // Template or literal construction of the station route.
          if (/["'`]\/s\/\$\{/.test(src) || /["']\/s\/STATION_/.test(src)) {
            offenders.push(path.relative(process.cwd(), full));
          }
        }
      }
    };

    for (const root of roots) if (fs.existsSync(root)) walk(root);

    assert.deepEqual(
      offenders,
      [],
      `hardcoded station routes found — use stationHref(): ${offenders.join(", ")}`,
    );
  });
});
