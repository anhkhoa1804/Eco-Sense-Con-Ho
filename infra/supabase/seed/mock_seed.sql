insert into public.crop_thresholds (crop_name, salinity_warning_level, salinity_critical_level)
values
  ('durian', 1.00, 1.50),
  ('rice', 2.00, 3.00)
on conflict (crop_name) do nothing;

insert into public.stations (id, name, lat, lng, status)
values
  ('STATION_01', 'Con Ho North', 10.2450000, 105.8200000, 'active'),
  ('STATION_02', 'Con Ho South', 10.2385000, 105.8260000, 'active')
on conflict (id) do nothing;

insert into public.users (phone, role, primary_crop_id)
select '+84900000001', 'farmer', id from public.crop_thresholds where crop_name = 'durian'
on conflict (phone) do nothing;

insert into public.environmental_data (
  message_id,
  station_id,
  salinity,
  water_level,
  fault_flags,
  ec_probe_status,
  ultrasonic_status,
  timestamp
)
values
  ('mock-msg-001', 'STATION_01', 1.20, 50.0, 0, 'ok', 'ok', now() - interval '1 hour'),
  ('mock-msg-002', 'STATION_01', 1.35, 52.0, 0, 'ok', 'ok', now() - interval '30 minutes'),
  ('mock-msg-003', 'STATION_02', 0.95, 48.0, 0, 'ok', 'ok', now() - interval '30 minutes')
on conflict (message_id) do nothing;

insert into public.station_health_logs (station_id, battery_voltage, signal_strength_dbm, firmware_version, timestamp)
values
  ('STATION_01', 3.92, -85, '1.0.2', now() - interval '30 minutes'),
  ('STATION_02', 3.88, -90, '1.0.2', now() - interval '30 minutes');
