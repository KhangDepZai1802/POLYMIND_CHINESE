begin;
create table public.b2c_admission_care_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.b2c_admission_leads(id) on delete restrict,
  channel text not null check(channel in ('call','message')),
  contact_date date not null,
  caretaker_name text not null check(char_length(btrim(caretaker_name)) between 1 and 200),
  content text not null check(char_length(btrim(content)) between 1 and 2000),
  next_followup_date date check(next_followup_date is null or next_followup_date >= contact_date),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index b2c_care_logs_lead_idx on public.b2c_admission_care_logs(lead_id,created_at desc,id);
alter table public.b2c_admission_care_logs enable row level security;
create policy b2c_care_logs_manager_select on public.b2c_admission_care_logs
  for select to authenticated using(app.is_manager());
create policy b2c_care_logs_manager_insert on public.b2c_admission_care_logs
  for insert to authenticated with check(app.is_manager() and created_by=auth.uid());
revoke all on public.b2c_admission_care_logs from public,anon,authenticated;
grant select,insert on public.b2c_admission_care_logs to authenticated;
notify pgrst,'reload schema';
commit;
