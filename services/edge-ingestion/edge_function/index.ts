import { parseDeviceSecretsJson, resolveIngestConfig } from "../src/config.js";
import { handleIngestRequest } from "../src/httpHandler.js";
import { MockDb } from "../src/mockDb.js";
import { SupabaseDb } from "../src/supabaseDb.js";
import type { TelemetryPayloadV1 } from "../src/types.js";

function resolveDb(): MockDb | SupabaseDb {
  try {
    return SupabaseDb.fromEnv();
  } catch {
    return new MockDb(parseDeviceSecretsJson());
  }
}

export async function handler(reqBody: TelemetryPayloadV1, headers: Record<string, string>) {
  const now = Math.floor(Date.now() / 1000);
  return handleIngestRequest(reqBody, headers, resolveDb(), resolveIngestConfig(), now);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const body = JSON.parse(process.argv[2] || "{}") as TelemetryPayloadV1;
    const headers = JSON.parse(process.argv[3] || "{}") as Record<string, string>;
    const res = await handler(body, headers);
    console.log(res);
  })();
}
