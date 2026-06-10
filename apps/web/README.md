# Eco-Sense Web — Public Climate Platform

Next.js 15 PWA for community climate monitoring on Cồn Hô.

## Setup

```bash
cp .env.local.example .env.local
```

Required variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only — never expose to the browser)

From repo root:

```bash
npm install
npm run dashboard
```

Open `http://localhost:4173`.

## Routes

**Public (no login):**

- `/` — Home
- `/about` — Cồn Hô and monitoring overview
- `/dashboard` — Live climate dashboard
- `/s/[stationId]` — QR station page (e.g. `/s/STATION_01`)
- `/report` — Community issue report

**Admin:**

- `/admin/login` — Operator magic link
- `/admin` — Operations console (admin role required)

Legacy paths redirect: `/login` → `/admin/login`, `/alerts` → `/dashboard#alerts`, `/stations/*` → `/s/*`.
