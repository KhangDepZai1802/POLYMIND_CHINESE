create table public.b2c_teachers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check(char_length(btrim(full_name)) between 2 and 200),
  phone text check(char_length(phone)<=30),
  email text,
  specialization text check(char_length(specialization)<=1000),
  employment_type text not null check(employment_type in ('full_time','part_time')),
  hourly_rate numeric not null check(hourly_rate>=0 and hourly_rate<=999999999999 and hourly_rate=trunc(hourly_rate)),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.b2c_teachers enable row level security;
create policy b2c_teachers_manager_select on public.b2c_teachers for select to authenticated using(app.is_manager());
create policy b2c_teachers_manager_insert on public.b2c_teachers for insert to authenticated with check(app.is_manager() and created_by=auth.uid());
create policy b2c_teachers_manager_update on public.b2c_teachers for update to authenticated using(app.is_manager()) with check(app.is_manager());
revoke all on public.b2c_teachers from public,anon,authenticated;
grant select,insert on public.b2c_teachers to authenticated;
grant update(full_name,phone,email,specialization,employment_type,hourly_rate) on public.b2c_teachers to authenticated;
create index b2c_teachers_name_idx on public.b2c_teachers(full_name,id);
create trigger b2c_teacher_updated_at before update on public.b2c_teachers for each row execute function app.set_updated_at();
notify pgrst, 'reload schema';
