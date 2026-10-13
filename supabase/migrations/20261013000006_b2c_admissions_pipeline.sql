begin;
create table public.b2c_admission_leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check(char_length(btrim(full_name)) between 1 and 200),
  phone text not null check(phone ~ '^[0-9]{10}$'),
  program_slug text not null references public.b2c_programs(slug),
  salesperson text not null check(char_length(btrim(salesperson)) between 1 and 200),
  stage text not null default 'lead' check(stage in ('lead','consulted','trial','deposit','enrolled','lost')),
  customer_source text check(customer_source in ('facebook','zalo','referral','walk_in','school','other')),
  referrer_name text,
  notes text check(char_length(notes) <= 2000),
  failure_reason text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint b2c_admissions_failure_reason_check check (
    (stage='lost' and failure_reason is not null and char_length(btrim(failure_reason)) between 1 and 1000)
    or (stage <> 'lost' and failure_reason is null)
  ),
  constraint b2c_admissions_referrer_check check (
    (customer_source='referral' and referrer_name is not null and char_length(btrim(referrer_name)) between 1 and 200)
    or (customer_source is distinct from 'referral' and referrer_name is null)
  )
);
create index b2c_admissions_stage_idx on public.b2c_admission_leads(stage,created_at desc);
alter table public.b2c_admission_leads enable row level security;
create policy b2c_admissions_manager_select on public.b2c_admission_leads
  for select to authenticated using(app.is_manager());
create policy b2c_admissions_manager_insert on public.b2c_admission_leads
  for insert to authenticated with check(app.is_manager() and created_by=auth.uid());
create policy b2c_admissions_manager_update on public.b2c_admission_leads
  for update to authenticated using(app.is_manager()) with check(app.is_manager());
revoke all on public.b2c_admission_leads from public,anon,authenticated;
grant select,insert on public.b2c_admission_leads to authenticated;
grant update(full_name,phone,program_slug,salesperson,stage,customer_source,referrer_name,notes,failure_reason)
  on public.b2c_admission_leads to authenticated;
create trigger b2c_admissions_updated_at before update on public.b2c_admission_leads
  for each row execute function app.set_updated_at();
notify pgrst,'reload schema';
commit;
