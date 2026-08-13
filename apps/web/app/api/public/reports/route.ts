import { NextResponse } from "next/server";
import { addDemoReport } from "@/lib/reports/demoReportStore";
import { classifyInsertError } from "@/lib/reports/reportPersistence";
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
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 5;

const hits = new Map<string, number[]>();

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_WINDOW_MS;
  const times = (hits.get(ip) ?? []).filter((t) => t > windowStart);

  if (times.length >= RATE_MAX) {
    return true;
  }

  times.push(now);
  hits.set(ip, times);
  return false;
}

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

  if (rateLimited(clientIp(request))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const supabase = createServiceClient();
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

  if (
    reportLat === null ||
    reportLng === null ||
    !Number.isFinite(reportLat) ||
    !Number.isFinite(reportLng)
  ) {
    reportLat = 10.082;
    reportLng = 106.032;
  }

  const fullDescription =
    `[${category}]` +
    (typeof stationId === "string" && stationId ? ` [station:${stationId}]` : "") +
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

    console.error("[reports] Insert failed:", error.message);
    return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
  });
}
