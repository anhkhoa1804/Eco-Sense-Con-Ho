/**
 * Pure decision logic for how apps/web/app/api/public/reports/route.ts
 * responds when a Supabase insert into damage_logs fails. Kept free of any
 * "server-only" import (unlike route.ts's createServiceClient() call) so
 * it can be unit-tested directly.
 */

export function isMissingTableError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "PGRST205"
  );
}

export type ReportPersistenceOutcome = "demo" | "insert_failed";

/**
 * Missing-table is a structural, disclosed "not provisioned yet" gap —
 * the same category as having no Supabase client configured at all — so
 * falling back to a local demo report is legitimate and honest.
 *
 * Any other error means Supabase IS configured, reachable, and the table
 * exists, but this specific write genuinely failed (outage, RLS
 * misconfiguration, network error). That must not be treated the same as
 * "no backend yet" — doing so would return ok:true for a report that was
 * never actually recorded anywhere durable, silently masquerading a
 * production failure as a successful submission.
 */
export function classifyInsertError(error: unknown): ReportPersistenceOutcome {
  return isMissingTableError(error) ? "demo" : "insert_failed";
}
