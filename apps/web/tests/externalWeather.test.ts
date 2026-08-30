import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getExternalWeather } from "@/lib/external/weather";

/**
 * The adapter's contract is that it NEVER invents a value: every failure mode
 * resolves to `null` so the UI can say "unavailable" instead of showing a
 * plausible-looking number that came from nowhere. These tests exercise each
 * failure path against a stubbed `fetch`.
 */

const realFetch = globalThis.fetch;

function stubFetch(impl: typeof globalThis.fetch) {
  globalThis.fetch = impl;
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("external weather adapter", () => {
  it("parses a well-formed upstream response", async () => {
    stubFetch(async () =>
      jsonResponse({
        current: {
          time: "2026-08-22T09:45",
          temperature_2m: 30.4,
          relative_humidity_2m: 71,
          wind_speed_10m: 15.6,
          precipitation: 0,
        },
      }),
    );

    const result = await getExternalWeather();
    assert.ok(result);
    assert.equal(result.temperatureC, 30.4);
    assert.equal(result.humidityPct, 71);
    assert.equal(result.windKph, 15.6);
    assert.equal(result.precipitationMm, 0);
    assert.equal(result.observedAt, "2026-08-22T09:45");
    assert.equal(result.source, "Open-Meteo");
    // Regional, never a station — this is what keeps it out of telemetry.
    assert.equal(result.area, "Vĩnh Long");
  });

  it("keeps a genuine zero rather than treating it as missing", async () => {
    // 0.0 mm of rain is a real observation. A truthiness check here would
    // turn "no rain" into "no data", which is a different claim.
    stubFetch(async () =>
      jsonResponse({ current: { temperature_2m: 29, precipitation: 0, relative_humidity_2m: 0 } }),
    );

    const result = await getExternalWeather();
    assert.ok(result);
    assert.equal(result.precipitationMm, 0);
    assert.equal(result.humidityPct, 0);
  });

  it("returns null on a non-200 response", async () => {
    stubFetch(async () => jsonResponse({}, false, 503));
    assert.equal(await getExternalWeather(), null);
  });

  it("returns null when the body has no `current` block", async () => {
    stubFetch(async () => jsonResponse({ latitude: 10.2 }));
    assert.equal(await getExternalWeather(), null);
  });

  it("returns null when every field is unparseable rather than rendering four dashes", async () => {
    stubFetch(async () =>
      jsonResponse({
        current: {
          temperature_2m: "hot",
          relative_humidity_2m: null,
          wind_speed_10m: undefined,
          precipitation: NaN,
        },
      }),
    );
    assert.equal(await getExternalWeather(), null);
  });

  it("keeps the fields it can parse and nulls only the ones it cannot", async () => {
    stubFetch(async () =>
      jsonResponse({ current: { temperature_2m: 31.2, relative_humidity_2m: "n/a" } }),
    );

    const result = await getExternalWeather();
    assert.ok(result);
    assert.equal(result.temperatureC, 31.2);
    assert.equal(result.humidityPct, null, "unparseable field must be null, never coerced to 0");
  });

  it("returns null when the request throws (network error or timeout)", async () => {
    stubFetch(async () => {
      throw new Error("network down");
    });
    assert.equal(await getExternalWeather(), null);
  });

  it("returns null when the request aborts on timeout", async () => {
    stubFetch(async () => {
      const err = new Error("The operation was aborted due to timeout");
      err.name = "TimeoutError";
      throw err;
    });
    assert.equal(await getExternalWeather(), null);
  });

  it("requests Cồn Hô's coordinates and asks for km/h", async () => {
    let requested = "";
    stubFetch(async (input) => {
      requested = String(input);
      return jsonResponse({ current: { temperature_2m: 30 } });
    });

    await getExternalWeather();
    assert.match(requested, /latitude=10\.2419/);
    assert.match(requested, /longitude=105\.826/);
    assert.match(requested, /wind_speed_unit=kmh/);
    // No credential should ever appear in this URL.
    assert.ok(!/api[_-]?key|token|secret/i.test(requested), "adapter must not send a credential");
  });
});
