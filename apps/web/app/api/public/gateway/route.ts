import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveLocalStoragePath() {
  const repoRootPath = path.join(process.cwd(), "apps", "web", ".local-gateway-data.json");
  const appRootPath = path.join(process.cwd(), ".local-gateway-data.json");

  return path.basename(process.cwd()) === "web" ? appRootPath : repoRootPath;
}

const localStoragePath = resolveLocalStoragePath();
const isProduction = process.env.NODE_ENV === "production";

async function ensureLocalStore() {
  try {
    await fs.access(localStoragePath);
  } catch {
    await fs.writeFile(localStoragePath, JSON.stringify({ latest: null }, null, 2), "utf8");
  }
}

async function readLocalStore() {
  await ensureLocalStore();
  const raw = await fs.readFile(localStoragePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch {
    return { latest: null };
  }
}

async function writeLocalStore(payload: unknown) {
  await ensureLocalStore();
  await fs.writeFile(localStoragePath, JSON.stringify({ latest: payload }, null, 2), "utf8");
}

function isAuthorizedGatewayRequest(request: Request) {
  const expectedToken = process.env.GATEWAY_INGEST_TOKEN;
  if (!expectedToken) return true;
  return request.headers.get("x-gateway-token") === expectedToken;
}

function summarizeGatewayPayload(payload: Record<string, unknown>) {
  return {
    station_id: typeof payload.station_id === "string" ? payload.station_id : null,
    gateway_id: typeof payload.gateway_id === "string" ? payload.gateway_id : null,
    message_id: typeof payload.message_id === "string" ? payload.message_id : null,
    air_temp_c: typeof payload.air_temp_c === "number" ? payload.air_temp_c : null,
    soil_temp_c: typeof payload.soil_temp_c === "number" ? payload.soil_temp_c : null,
    air_humidity_pct:
      typeof payload.air_humidity_pct === "number" ? payload.air_humidity_pct : null,
    timestamp:
      typeof payload.timestamp === "number" ? payload.timestamp : null,
  };
}

async function readLatestGatewayObservation() {
  const supabase = createServiceClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("gateway_observations")
    .select("raw_payload, received_at")
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data || typeof data.raw_payload !== "object" || data.raw_payload === null) {
    if (error) console.error("[gateway-ingest] failed to read latest observation:", error);
    return null;
  }

  const payload = data.raw_payload as Record<string, unknown>;
  return {
    ...payload,
    receivedAt: data.received_at,
    summary: summarizeGatewayPayload(payload),
  };
}

async function writeGatewayObservation(payload: Record<string, unknown>, receivedAt: string) {
  const supabase = createServiceClient();
  if (!supabase) return false;

  const { error } = await supabase.from("gateway_observations").insert({
    gateway_id: typeof payload.gateway_id === "string" ? payload.gateway_id : "UNKNOWN_GATEWAY",
    station_id: typeof payload.station_id === "string" ? payload.station_id : "UNKNOWN_STATION",
    sequence: typeof payload.sequence === "number" ? payload.sequence : null,
    transport: typeof payload.transport === "string" ? payload.transport : "4g_http",
    raw_payload: payload,
    received_at: receivedAt,
  });

  if (error) {
    console.error("[gateway-ingest] failed to store observation:", error);
    return false;
  }

  return true;
}

export async function GET() {
  const latestObservation = await readLatestGatewayObservation();
  if (latestObservation) {
    return NextResponse.json({
      ok: true,
      route: "/api/public/gateway",
      methods: ["POST"],
      message: "Gateway ingest endpoint.",
      storage: "supabase",
      latest: latestObservation,
    });
  }

  if (isProduction) {
    return NextResponse.json({
      ok: true,
      route: "/api/public/gateway",
      methods: ["POST"],
      message: "Gateway ingest endpoint.",
      storage: "supabase",
      latest: null,
    });
  }

  const store = await readLocalStore();

  return NextResponse.json({
    ok: true,
    route: "/api/public/gateway",
    methods: ["POST"],
    message: "Gateway ingest endpoint for local testing.",
    storage: "local-file",
    latest: store.latest,
  });
}

export async function POST(request: Request) {
  try {
    if (!isAuthorizedGatewayRequest(request)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const rawBody = await request.text();
    const body = rawBody ? JSON.parse(rawBody) : null;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const candidate = body as Record<string, unknown>;
    const receivedAt = new Date().toISOString();
    const summary = summarizeGatewayPayload(candidate);
    const storedInSupabase = await writeGatewayObservation(candidate, receivedAt);

    if (!storedInSupabase) {
      if (isProduction) {
        return NextResponse.json(
          { ok: false, error: "gateway_observation_store_unavailable" },
          { status: 503 },
        );
      }

      await writeLocalStore({
        ...candidate,
        receivedAt,
        summary,
      });
    }

    console.log("[gateway-local-test] received payload:", rawBody);
    console.log("[gateway-local-test] summary:", JSON.stringify(summary));

    return NextResponse.json({
      ok: true,
      accepted: true,
      message: "Gateway payload accepted.",
      storage: storedInSupabase ? "supabase" : "local-file",
      receivedAt,
      summary,
      payload: body,
      storedAt: storedInSupabase ? "gateway_observations" : localStoragePath,
    });
  } catch (error) {
    console.error("[gateway-local-test] invalid payload:", error);
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
}
