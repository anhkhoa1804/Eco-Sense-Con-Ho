# Technical QA Checklist (Vertical Slice)

This checklist verifies that the software stack is healthy before each demo and before pilot deployment.

## 1. Preflight

- Confirm Node.js is installed and npm dependencies are present.
- Confirm workspace has no unresolved TypeScript errors.
- Confirm local mock data can be regenerated from simulator.

## 2. Required Commands

Run from repository root:

```bash
npm run qa:vertical-slice
```

This command runs:

- `npm run check`
- `npm run simulator`
- `npm run mock:ingest`

Expected outcomes:

- `check` passes with zero TypeScript errors.
- `simulator` prints mixed accepted and sensor fault responses and writes updated mock JSON.
- `mock:ingest` shows inserted, duplicate_ignored, and SENSOR_FAULT paths.

## 3. Frontend Smoke Test

Run:

```bash
npm run dashboard
```

Open `http://localhost:4173` and verify:

- Header metrics load.
- Station map displays 5 stations.
- Trend panel updates when station selector changes.
- Latest readings cards and alerts list render.

## 4. Backend Data Integrity Checks

Validate these invariants in logs or DB:

- Duplicate `message_id` does not create duplicate environmental readings.
- Fault telemetry creates `SENSOR_FAULT` event and audit status.
- Accepted telemetry creates health log and accepted audit status.
- Device status gating works: inactive devices should be rejected.

## 5. Release Gate for Pilot

A build is pilot-ready only when:

- All QA checks in this file are green.
- Migrations apply cleanly in staging.
- Dashboard renders against staging data source.
- Field hardware checklist is signed off.
