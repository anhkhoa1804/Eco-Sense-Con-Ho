import { NextResponse } from "next/server";
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

  const times = (hits.get(ip) ?? []).filter(
    (t) => t > windowStart,
  );

  if (times.length >= RATE_MAX) {
    return true;
  }

  times.push(now);
  hits.set(ip, times);

  return false;
}

export async function POST(request: Request) {
  try {
    const supabase = createServiceClient();

    if (!supabase) {
      return NextResponse.json(
        {
          error: "Demo deployment does not have backend services configured",
        },
        {
          status: 503,
        }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Thân yêu cầu JSON không hợp lệ" },
        { status: 400 },
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Thân yêu cầu không hợp lệ" },
        { status: 400 },
      );
    }

    const { category, description, lat, lng, stationId } =
      body as Record<string, unknown>;

    if (
      typeof category !== "string" ||
      !CATEGORIES.includes(
        category as (typeof CATEGORIES)[number],
      )
    ) {
      return NextResponse.json(
        { error: "Loại báo cáo không hợp lệ" },
        { status: 400 },
      );
    }

    if (
      typeof description !== "string" ||
      description.trim().length < MIN_DESCRIPTION
    ) {
      return NextResponse.json(
        {
          error: `Mô tả phải có ít nhất ${MIN_DESCRIPTION} ký tự`,
        },
        { status: 400 },
      );
    }

    if (description.length > MAX_DESCRIPTION) {
      return NextResponse.json(
        { error: "Mô tả quá dài" },
        { status: 400 },
      );
    }

    const ip = clientIp(request);

    if (rateLimited(ip)) {
      return NextResponse.json(
        {
          error:
            "Quá nhiều báo cáo. Vui lòng thử lại sau.",
        },
        { status: 429 },
      );
    }

    let reportLat =
      typeof lat === "number" ? lat : null;

    let reportLng =
      typeof lng === "number" ? lng : null;

    if (
      typeof stationId === "string" &&
      stationId.length > 0
    ) {
      const { data: station } = await supabase
        .from("stations")
        .select("lat, lng")
        .eq("id", stationId)
        .maybeSingle();

      if (station) {
        if (reportLat === null)
          reportLat = Number(station.lat);

        if (reportLng === null)
          reportLng = Number(station.lng);
      }
    }

    if (
      reportLat === null ||
      reportLng === null ||
      !Number.isFinite(reportLat) ||
      !Number.isFinite(reportLng)
    ) {
      return NextResponse.json(
        {
          error:
            "Cần vị trí (bật GPS hoặc chọn một trạm)",
        },
        { status: 400 },
      );
    }

    const fullDescription =
      `[${category}]` +
      (stationId
        ? ` [station:${stationId}]`
        : "") +
      ` ${description.trim()}`;

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("damage_logs")
      .insert({
        user_id: null,
        lat: reportLat,
        lng: reportLng,
        description: fullDescription,
        status: "new",
        timestamp: now,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Không thể lưu báo cáo" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      id: data.id,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        demo: true,
        message:
          "Supabase chưa được cấu hình trên môi trường triển khai.",
      },
      { status: 200 },
    );
  }
}