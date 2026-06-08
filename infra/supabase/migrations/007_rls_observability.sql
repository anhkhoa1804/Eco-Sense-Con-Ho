alter table public.environmental_readings enable row level security;
alter table public.environmental_events enable row level security;
alter table public.ingestion_audit_logs enable row level security;
alter table public.devices enable row level security;

create policy if not exists environmental_readings_read_all on public.environmental_readings
  for select
  using (true);

create policy if not exists environmental_events_read_all on public.environmental_events
  for select
  using (true);

create policy if not exists ingestion_audit_logs_admin_read on public.ingestion_audit_logs
  for select
  using (true);

create policy if not exists devices_admin_read on public.devices
  for select
  using (true);
