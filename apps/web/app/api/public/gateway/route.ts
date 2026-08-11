import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readStationId(payload: Record<string, unknown>): string | null {
  const rawStationPayload = asRecord(payload.raw_station_payload);
  const stationId = rawStationPayload?.station_id;
  return typeof stationId === "string" && stationId.length > 0 ? stationId : null;
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const payload = asRecord(body);
  if (!payload) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const gatewayId = payload.gateway_id;
  const stationId = readStationId(payload);

  if (typeof gatewayId !== "string" || gatewayId.length === 0 || !stationId) {
    return NextResponse.json({ ok: false, error: "missing_gateway_or_station" }, { status: 400 });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({
      ok: true,
      status: "accepted_without_storage",
      station_id: stationId,
    });
  }

  const { error } = await supabase.from("gateway_observations").insert({
    gateway_id: gatewayId,
    station_id: stationId,
    sequence: typeof payload.sequence === "number" ? payload.sequence : null,
    transport: typeof payload.transport === "string" ? payload.transport : null,
    raw_payload: payload,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "storage_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    status: "stored",
    station_id: stationId,
  });
}
