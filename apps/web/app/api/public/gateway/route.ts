import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

function resolveLocalStoragePath() {
  const repoRootPath = path.join(process.cwd(), "apps", "web", ".local-gateway-data.json");
  const appRootPath = path.join(process.cwd(), ".local-gateway-data.json");

  return path.basename(process.cwd()) === "web" ? appRootPath : repoRootPath;
}

const localStoragePath = resolveLocalStoragePath();

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

export async function GET() {
  const store = await readLocalStore();

  return NextResponse.json({
    ok: true,
    route: "/api/public/gateway",
    methods: ["POST"],
    message: "Gateway ingest endpoint for local testing.",
    latest: store.latest,
  });
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const body = rawBody ? JSON.parse(rawBody) : null;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const candidate = body as Record<string, unknown>;
    const summary = {
      station_id: typeof candidate.station_id === "string" ? candidate.station_id : null,
      gateway_id: typeof candidate.gateway_id === "string" ? candidate.gateway_id : null,
      message_id: typeof candidate.message_id === "string" ? candidate.message_id : null,
      air_temp_c: typeof candidate.air_temp_c === "number" ? candidate.air_temp_c : null,
      soil_temp_c: typeof candidate.soil_temp_c === "number" ? candidate.soil_temp_c : null,
      air_humidity_pct:
        typeof candidate.air_humidity_pct === "number" ? candidate.air_humidity_pct : null,
      timestamp:
        typeof candidate.timestamp === "number" ? candidate.timestamp : null,
    };

    await writeLocalStore({
      ...candidate,
      receivedAt: new Date().toISOString(),
      summary,
    });

    console.log("[gateway-local-test] received payload:", rawBody);
    console.log("[gateway-local-test] summary:", JSON.stringify(summary));

    return NextResponse.json({
      ok: true,
      accepted: true,
      message: "Gateway payload accepted for local testing.",
      receivedAt: new Date().toISOString(),
      summary,
      payload: body,
      storedAt: localStoragePath,
    });
  } catch (error) {
    console.error("[gateway-local-test] invalid payload:", error);
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
}
