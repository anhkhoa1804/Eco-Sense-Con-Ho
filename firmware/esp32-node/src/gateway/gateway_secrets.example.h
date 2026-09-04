#pragma once

/*
  HORIZON gateway — per-deployment secrets.

  HOW TO PROVISION A BOARD
    1. cp gateway_secrets.example.h gateway_secrets.h
    2. paste the ingest token issued for the target deployment
    3. flash

  `gateway_secrets.h` is gitignored and MUST stay that way. This example file
  is committed and must never contain a real value.

  The token must match GATEWAY_INGEST_TOKEN in the web app's environment for
  the same deployment (Vercel → Settings → Environment Variables). If the two
  disagree the server answers 401; if the server has none configured at all it
  answers 503 and ingests nothing. Both are deliberate: the ingest path fails
  closed rather than accepting unauthenticated telemetry.
*/

#define GATEWAY_INGEST_TOKEN_VALUE ""
