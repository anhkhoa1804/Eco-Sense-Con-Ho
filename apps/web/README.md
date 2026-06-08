# Eco-Sense Farmer PWA

Next.js 15 farmer dashboard backed by Supabase.

## Setup

```bash
cp .env.local.example .env.local
# Fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
```

From repo root:

```bash
npm install
npm run dashboard
```

Open `http://localhost:4173`.

## Routes

- `/login` — email magic link
- `/dashboard` — live metrics and readings
- `/stations/[stationId]` — station detail + 24h trend
- `/alerts` — operational events
- `/profile` — user info and assigned stations
