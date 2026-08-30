import { NextResponse } from "next/server";
import { addDemoReport } from "@/lib/reports/demoReportStore";
import { classifyInsertError } from "@/lib/reports/reportPersistence";
import { clientIdentifier, consumeReportQuota } from "@/lib/reports/rateLimit";
import { logger } from "@/lib/observability/logger";
import { createServiceClient } from "@/lib/supabase/service";

const CATEGORIES = [
  "erosion",
  "flooding",
  "pollution",
  "infrastructure",
  "sensor",
  "other",
] as const;

const MIN_DESCRIPTION = 10;
const MAX_DESCRIPTION = 2000;

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const { category, description, lat, lng, stationId } = body as Record<string, unknown>;

  if (
    typeof category !== "string" ||
    !CATEGORIES.includes(category as (typeof CATEGORIES)[number])
  ) {
    return NextResponse.json({ error: "invalid_category" }, { status: 400 });
  }

  if (typeof description !== "string" || description.trim().length < MIN_DESCRIPTION) {
    return NextResponse.json({ error: "description_too_short" }, { status: 400 });
  }

  if (description.length > MAX_DESCRIPTION) {
    return NextResponse.json({ error: "description_too_long" }, { status: 400 });
  }

  // Created before the throttle check so the durable limiter (which shares
  // this client) is consulted rather than the per-instance fallback.
  const supabase = createServiceClient();

  const quota = await consumeReportQuota(supabase, clientIdentifier(request));
  if (quota.limited) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  if (quota.backend === "memory" && supabase) {
    // Supabase is configured but the durable counter did not answer — almost
    // always migration 021 not applied. Worth a log line: throttling is
    // running per-instance and is therefore bypassable.
    logger.warn("reports.rate_limit_degraded", {
      reason: "durable limiter unavailable; using per-instance fallback",
    });
  }

  let reportLat = typeof lat === "number" ? lat : null;
  let reportLng = typeof lng === "number" ? lng : null;

  if (supabase && typeof stationId === "string" && stationId.length > 0) {
    const { data: station } = await supabase
      .from("stations")
      .select("lat, lng")
      .eq("id", stationId)
      .maybeSingle();

    if (station) {
      reportLat ??= Number(station.lat);
      reportLng ??= Number(station.lng);
    }
  }

  // Approximate center of the real pilot station cluster (STATION_01/02/03,
  // infra/supabase/seed/pilot_seed.sql), used only when neither GPS nor a
  // resolvable station gives a real position. The previous constant here
  // (10.082, 106.032) was ~20km from the actual monitored area and was
  // stored as though it were a precise report location with no way for
  // anyone downstream to tell it apart from a real one. `lat`/`lng` on
  // damage_logs are NOT NULL, so this can't simply be omitted — the
  // fallback is now at least on the real island, and is marked in the
  // description (same bracket-tag pattern already used for category/
  // station below) so it's traceable as an estimate, not fabricated
  // precision.
  const FALLBACK_LAT = 10.2419;
  const FALLBACK_LNG = 105.826;
  let usedFallbackLocation = false;

  if (
    reportLat === null ||
    reportLng === null ||
    !Number.isFinite(reportLat) ||
    !Number.isFinite(reportLng)
  ) {
    reportLat = FALLBACK_LAT;
    reportLng = FALLBACK_LNG;
    usedFallbackLocation = true;
  }

  const fullDescription =
    `[${category}]` +
    (typeof stationId === "string" && stationId ? ` [station:${stationId}]` : "") +
    (usedFallbackLocation ? " [vị trí: ước tính]" : "") +
    ` ${description.trim()}`;

  const demoReport = () =>
    addDemoReport({
      lat: reportLat,
      lng: reportLng,
      description: fullDescription,
      timestamp: new Date().toISOString(),
    });

  if (!supabase) {
    const report = demoReport();
    return NextResponse.json({
      ok: true,
      demo: true,
      id: report.id,
    });
  }

  const { data, error } = await supabase
    .from("damage_logs")
    .insert({
      user_id: null,
      lat: reportLat,
      lng: reportLng,
      description: fullDescription,
      status: "new",
      timestamp: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    if (classifyInsertError(error) === "demo") {
      const report = demoReport();
      return NextResponse.json({
        ok: true,
        demo: true,
        id: report.id,
      });
    }

    // Message only, never the error object: a Postgres error can carry the
    // failing statement and its parameters, i.e. the reporter's own text.
    logger.error("reports.insert_failed", { message: error.message, code: error.code });
    return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
  });
}
