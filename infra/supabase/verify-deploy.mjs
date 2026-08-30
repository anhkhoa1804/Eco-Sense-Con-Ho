import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadLocalEnv() {
  const envPath = path.join(__dirname, ".env.supabase");
  if (!existsSync(envPath)) return {};
  const env = {};
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (key && value) env[key] = value;
  }
  return env;
}

function jwtRole(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
    return payload.role ?? "unknown";
  } catch {
    return "invalid";
  }
}

function apiKeyKind(value) {
  if (value.startsWith("sb_publishable_")) return "publishable";
  if (value.startsWith("sb_secret_")) return "secret";
  return `legacy:${jwtRole(value)}`;
}

const env = { ...loadLocalEnv(), ...process.env };
const databaseUrl = env.DATABASE_URL ?? env.DATABASE_POOLER_URL;

/** Migration filenames on disk, used to report what `db:migrate` would apply. */
const MIGRATION_FILES = (() => {
  try {
    return readdirSync(path.join(__dirname, "migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
  } catch {
    return [];
  }
})();

const required = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PROJECT_REF",
];

console.log("Eco-Sense deploy verification\n");

let ok = true;

for (const key of required) {
  const present = Boolean(env[key]);
  console.log(`${present ? "OK" : "MISSING"}  ${key}`);
  if (!present) ok = false;
}

if (!databaseUrl) {
  console.log("MISSING  DATABASE_URL or DATABASE_POOLER_URL");
  ok = false;
} else {
  console.log(`OK      DATABASE_URL set (${databaseUrl.includes("pooler") ? "pooler" : "direct"})`);
}

if (!env.SUPABASE_ACCESS_TOKEN) {
  console.log("WARN    SUPABASE_ACCESS_TOKEN not set (run: npx supabase login)");
}

if (env.SUPABASE_ANON_KEY) {
  const kind = apiKeyKind(env.SUPABASE_ANON_KEY);
  if (kind === "publishable" || kind === "legacy:anon") {
    console.log(`OK      SUPABASE_ANON_KEY kind=${kind}`);
  } else {
    console.log(`FAIL    SUPABASE_ANON_KEY must be publishable or legacy anon (got ${kind})`);
    ok = false;
  }
}

if (env.SUPABASE_SERVICE_ROLE_KEY) {
  const kind = apiKeyKind(env.SUPABASE_SERVICE_ROLE_KEY);
  if (kind === "secret" || kind === "legacy:service_role") {
    console.log(`OK      SUPABASE_SERVICE_ROLE_KEY kind=${kind}`);
  } else {
    console.log(`WARN    SUPABASE_SERVICE_ROLE_KEY expected secret or legacy service_role (got ${kind})`);
  }
}

if (databaseUrl) {
  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const { rows } = await client.query("select version()");
    console.log(`OK      Database reachable (${rows[0].version.slice(0, 40)}...)`);

    await client.query("select to_regclass('public.schema_migrations') as t");
    const { rows: migRows } = await client.query(
      "select count(*)::int as count from public.schema_migrations",
    ).catch(() => ({ rows: [{ count: 0 }] }));
    console.log(`OK      schema_migrations: ${migRows[0]?.count ?? 0} recorded`);

    // Pending migrations, so a release can see what `db:migrate` would do
    // before it does it.
    try {
      const { rows: pending } = await client.query(
        `select v from unnest($1::text[]) as v
          where v not in (select version from public.schema_migrations)`,
        [MIGRATION_FILES],
      );
      if (pending.length === 0) {
        console.log("OK      All migrations applied");
      } else {
        console.log(`INFO    ${pending.length} migration(s) pending: ${pending.map((r) => r.v).join(", ")}`);
      }
    } catch {
      console.log("WARN    Could not determine pending migrations");
    }

    /*
     * Device secrets are the HMAC keys that authenticate telemetry
     * (services/edge-ingestion/src/canonical.ts). The pilot seed ships
     * placeholder values so a fresh clone can run the ingestion path, and
     * those values are committed to the repository — i.e. public. A database
     * still holding them will accept forged readings from anyone who can read
     * the repo, which is precisely the fabricated-data failure this project
     * exists to avoid.
     *
     * Compared by digest so nothing is printed and nothing is logged.
     */
    try {
      const { rows: weak } = await client.query(
        `select device_id from public.devices
          where device_secret in (
            'gateway-secret-01','station-secret-01','station-secret-02',
            'station-secret-03','station-secret-04','station-secret-05'
          )
          order by device_id`,
      );
      if (weak.length === 0) {
        console.log("OK      Device secrets rotated (no repo placeholders in use)");
      } else {
        console.log(
          `FAIL    ${weak.length} device(s) still use the PUBLIC placeholder secret: ${weak
            .map((r) => r.device_id)
            .join(", ")}`,
        );
        console.log("        These are committed in infra/supabase/seed/pilot_seed.sql and are public.");
        console.log("        Rotate before exposing the ingestion endpoint — see docs/PRODUCTION_READINESS.md.");
        ok = false;
      }
    } catch (error) {
      console.log(`WARN    Could not check device secrets: ${error instanceof Error ? error.message : error}`);
    }
  } catch (error) {
    console.log(`FAIL    Database connection: ${error instanceof Error ? error.message : error}`);
    if (databaseUrl.includes("db.") && databaseUrl.includes(".supabase.co:5432")) {
      console.log("        Hint: use pooler URL (port 6543) if direct db.* host fails DNS/IPv6.");
    }
    ok = false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

if (env.LIVE_SUPABASE_INTEGRATION === "1") {
  console.log("OK      LIVE_SUPABASE_INTEGRATION=1");
} else {
  console.log("INFO    Set LIVE_SUPABASE_INTEGRATION=1 after successful deploy");
}

console.log("");
if (ok) {
  console.log("Verification passed. Run: npm run db:migrate && npm run db:deploy");
} else {
  console.log("Verification failed. Fix .env.supabase and retry.");
  process.exit(1);
}
