-- Example station assignments (run manually after farmers log in).
-- Replace UUIDs with real auth.users / public.users IDs.
-- See docs/PILOT_BOOTSTRAP.md

-- insert into public.station_assignments (user_id, station_id)
-- values
--   ('FARMER_AUTH_UUID', 'STATION_01'),
--   ('FARMER_AUTH_UUID', 'STATION_02')
-- on conflict do nothing;
