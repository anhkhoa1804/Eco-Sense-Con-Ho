# Authorization Model

## Purpose

Eco-Sense separates public environmental transparency from privileged operations. Public users should be able to understand station status without login, while administrators need protected access to station management, thresholds, reports, and audit history.

## Access principles

- Public pages may read approved environmental summaries and station status.
- Public pages must never expose secrets, private user data, privileged audit detail, or admin controls.
- Device ingestion is authenticated through signed telemetry and gateway controls, not user sessions.
- Admin pages require authenticated users with explicit roles.
- Database Row Level Security should enforce data boundaries even if application code has a bug.
- Sensitive actions should be logged.

## Roles

Recommended roles:

| Role | Purpose | Capabilities |
|------|---------|--------------|
| `public` | Anonymous community and QR visitors. | Read public station summaries, charts, and submit community reports. |
| `operator` | Field or community operator. | Review reports, monitor assigned stations, acknowledge alerts. |
| `admin` | System administrator. | Manage stations, devices, thresholds, users, and reports. |
| `researcher` | Research or NGO partner. | Read approved datasets and station history without operational controls. |
| `service` | Backend service role. | Perform ingestion, maintenance, and privileged server-side actions only. |

The exact role names may differ in implementation, but these capability boundaries should remain.

## Public access

Public users may access:

- homepage,
- project overview,
- dashboard summary,
- station QR page,
- public charts,
- community report submission,
- public educational explanations.

Public users must not access:

- device secrets,
- raw HMAC fields beyond safe display,
- internal operator notes,
- private user identities,
- threshold edit controls,
- station provisioning tools,
- audit logs containing sensitive data.

## Admin access

Authenticated admins may access:

- station and device inventory,
- ingestion health,
- alert lists,
- threshold configuration,
- report triage,
- maintenance state,
- audit logs,
- deployment checks.

Admin actions should use clear confirmation for destructive or high-impact changes, especially threshold edits and device deactivation.

## Device ingestion access

Devices authenticate with:

- active device registration,
- signed payloads,
- timestamp drift checks,
- replay protection,
- idempotent message IDs.

Device authentication must not depend on browser user sessions.

## Row Level Security expectations

Supabase RLS should be designed so that:

- anonymous clients can only read public-safe views or rows,
- anonymous clients can submit reports through constrained insert policies,
- authenticated operators only access permitted operational data,
- admins have broader access through explicit role checks,
- service role bypass is used only server-side,
- secrets remain inaccessible to client roles.

Prefer public database views or RPC functions that shape data for the UI instead of exposing raw tables broadly.

## Community reports

Community reporting should be easy, but protected from abuse.

Recommended behavior:

- allow anonymous submissions with rate limiting or abuse controls,
- validate text and attachments,
- store submission time and station context when available,
- mark reports as pending until reviewed,
- avoid exposing reporter private information publicly,
- preserve drafts offline when possible.

## Audit behavior

Audit logs should capture:

- device ingestion decisions,
- rejected telemetry reasons,
- threshold changes,
- device activation or deactivation,
- admin role changes,
- report status changes,
- alert acknowledgments.

Audit logs should be precise and calm. They exist to support trust and operations, not to create noisy UI.

## Authorization checklist

Before shipping a feature, confirm:

- the persona and role are defined,
- public and admin behavior are separated,
- RLS protects the data path,
- secrets are never exposed to the browser,
- unauthorized states are handled clearly,
- sensitive changes are audited,
- error messages do not leak implementation details.
