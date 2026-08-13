insert into public.stations (id, name, lat, lng, status)
values
  ('STATION_01', 'Con Ho North', 10.2450000, 105.8200000, 'active'),
  ('STATION_02', 'Con Ho South', 10.2385000, 105.8260000, 'active'),
  ('STATION_03', 'Canal Gate West', 10.2421000, 105.8320000, 'active'),
  ('STATION_04', 'Brackish Edge', 10.2362000, 105.8145000, 'maintenance'),
  ('STATION_05', 'Mangrove Spur', 10.2492000, 105.8362000, 'active')
on conflict (id) do update
set name = excluded.name,
    lat = excluded.lat,
    lng = excluded.lng,
    status = excluded.status;

-- Dev/pilot secrets only — matches the placeholders used throughout
-- tests/scripts (services/edge-ingestion/tests, scripts/simulator.ts).
-- Real deployments must set unique, non-guessable secrets per device.
insert into public.devices (device_id, station_id, device_secret, status, kind)
values
  ('GATEWAY_01', null, 'gateway-secret-01', 'active', 'gateway'),
  ('STATION_01', 'STATION_01', 'station-secret-01', 'active', 'station'),
  ('STATION_02', 'STATION_02', 'station-secret-02', 'active', 'station'),
  ('STATION_03', 'STATION_03', 'station-secret-03', 'active', 'station'),
  ('STATION_04', 'STATION_04', 'station-secret-04', 'active', 'station'),
  ('STATION_05', 'STATION_05', 'station-secret-05', 'active', 'station')
on conflict (device_id) do update
set station_id = excluded.station_id,
    device_secret = excluded.device_secret,
    status = excluded.status,
    kind = excluded.kind;
