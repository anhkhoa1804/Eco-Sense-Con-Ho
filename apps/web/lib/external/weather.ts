import "server-only";

import { CON_HO } from "@/lib/geo";

/**
 * External environmental context — Open-Meteo.
 *
 * WHY THIS SOURCE
 * Open-Meteo publishes a free, key-less, non-commercial-friendly forecast API
 * backed by national weather services (for this region, primarily ECMWF/GFS
 * reanalysis). It was chosen over the alternatives for three reasons that
 * matter to this project specifically:
 *
 *  1. No API key. Nothing to leak, nothing to rotate, and no per-deployment
 *     secret to keep in sync between local, preview and production.
 *  2. It reports a `time` for the observation, so the value can carry an
 *     honest timestamp rather than being presented as "now".
 *  3. It is a *model* product covering a grid cell, not a station reading —
 *     which is exactly what this is used as here: regional context, never a
 *     substitute for a HORIZON sensor.
 *
 * WHAT THIS IS NOT
 * This is not telemetry. It does not come from Cồn Hô, it is not measured by
 * any HORIZON hardware, and it must never appear inside a station card or be
 * attributed to STATION_01/02/03. The UI renders it in its own clearly
 * labelled region. It is rendered inside the unified observatory canvas as
 * a "context" signal group (see lib/monitoring/signals.ts), sharing the
 * canvas with HORIZON telemetry while keeping `origin: "external"`.
 * Mixing a model forecast into the observatory's own measurements would
 * misrepresent the system as more instrumented than it is — the exact failure
 * this project's data-honesty rules exist to prevent.
 *
 * FAILURE BEHAVIOUR
 * Returns `null` on any failure — network error, non-200, malformed body, or
 * timeout. Callers render an honest "context unavailable" state. There is no
 * fallback value, no last-known-good cache, and no invented weather: a missing
 * external reading is information, not something to paper over.
 */

/** Cồn Hô, Vĩnh Long — the shared reference point, see lib/geo.ts. */
const CON_HO_LAT = CON_HO.lat;
const CON_HO_LNG = CON_HO.lng;

const ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const TIMEOUT_MS = 4000;

export interface ExternalWeather {
  temperatureC: number | null;
  humidityPct: number | null;
  windKph: number | null;
  precipitationMm: number | null;
  /** ISO instant the upstream model reports this value for. */
  observedAt: string | null;
  source: string;
  sourceUrl: string;
  /** Human-readable place this describes — deliberately regional, not a station. */
  area: string;
}

/** Narrow an unknown JSON field to a finite number, or null. Never coerces. */
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function getExternalWeather(): Promise<ExternalWeather | null> {
  const url =
    `${ENDPOINT}?latitude=${CON_HO_LAT}&longitude=${CON_HO_LNG}` +
    "&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation" +
    "&wind_speed_unit=kmh&timezone=Asia%2FHo_Chi_Minh";

  try {
    const response = await fetch(url, {
      // Revalidate on the same cadence as the observatory page itself. This
      // is a courtesy to a free public service as much as a performance
      // choice — the page must not hammer it on every request.
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) return null;

    const body = (await response.json()) as { current?: Record<string, unknown> };
    const current = body.current;
    if (!current) return null;

    const temperatureC = num(current.temperature_2m);
    const humidityPct = num(current.relative_humidity_2m);
    const windKph = num(current.wind_speed_10m);
    const precipitationMm = num(current.precipitation);

    // If literally nothing parsed, treat it as unavailable rather than
    // rendering a card of four dashes that looks like a broken instrument.
    if (
      temperatureC === null &&
      humidityPct === null &&
      windKph === null &&
      precipitationMm === null
    ) {
      return null;
    }

    return {
      temperatureC,
      humidityPct,
      windKph,
      precipitationMm,
      observedAt: typeof current.time === "string" ? current.time : null,
      source: "Open-Meteo",
      sourceUrl: "https://open-meteo.com/",
      area: "Vĩnh Long",
    };
  } catch {
    // Includes AbortSignal.timeout firing. Deliberately silent to the caller:
    // external context is supplementary, and its absence must never break or
    // delay the observatory's own data.
    return null;
  }
}
