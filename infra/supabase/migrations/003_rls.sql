alter table public.users enable row level security;
alter table public.stations enable row level security;
alter table public.environmental_data enable row level security;
alter table public.station_health_logs enable row level security;
alter table public.damage_logs enable row level security;
alter table public.crop_thresholds enable row level security;

-- NOTE: These are permissive bootstrap policies for local development.
-- Replace auth.uid() mapping with production identity mapping before deployment.
create policy if not exists users_self_read on public.users
  for select
  using (true);

create policy if not exists stations_read_all on public.stations
  for select
  using (true);

create policy if not exists crop_thresholds_read_all on public.crop_thresholds
  for select
  using (true);

create policy if not exists environmental_data_read_all on public.environmental_data
  for select
  using (true);

create policy if not exists station_health_logs_admin_read on public.station_health_logs
  for select
  using (true);

create policy if not exists damage_logs_insert on public.damage_logs
  for insert
  with check (true);

create policy if not exists damage_logs_read_all on public.damage_logs
  for select
  using (true);
