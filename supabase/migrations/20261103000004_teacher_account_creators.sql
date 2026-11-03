-- Creating login accounts is more privileged than managing classes. Keep an
-- explicit allowlist so ordinary B2C permissions can never imply this right.
create table if not exists public.b2c_teacher_account_creators (
 teacher_id uuid primary key references public.b2c_teachers(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp()
);
alter table public.b2c_teacher_account_creators enable row level security;
revoke all on public.b2c_teacher_account_creators from public,anon,authenticated;

do $$
declare matched integer;
begin
 select count(*) into matched
 from public.b2c_teachers b
 join public.teachers t on t.id=b.source_teacher_id
 join public.profiles p on p.id=t.user_id
 where b.full_name in ('Cô Lê','Cô Thy') and p.full_name=b.full_name
   and p.is_active and t.is_active and p.role='teacher';
 if matched<>2 then raise exception 'Không xác định đúng hai tài khoản Cô Lê/Cô Thy.'; end if;
 insert into public.b2c_teacher_account_creators(teacher_id)
 select b.id from public.b2c_teachers b
 join public.teachers t on t.id=b.source_teacher_id
 join public.profiles p on p.id=t.user_id
 where b.full_name in ('Cô Lê','Cô Thy') and p.full_name=b.full_name
   and p.is_active and t.is_active and p.role='teacher'
 on conflict(teacher_id) do nothing;
end $$;

create or replace function public.can_create_b2c_teacher_accounts() returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(app.is_super_admin() or exists(
  select 1 from public.b2c_teacher_account_creators c
  join public.b2c_teachers b on b.id=c.teacher_id
  join public.teachers t on t.id=b.source_teacher_id
  join public.profiles p on p.id=t.user_id
  where t.user_id=auth.uid() and p.is_active and t.is_active and p.role='teacher'
 ),false)
$$;
revoke all on function public.can_create_b2c_teacher_accounts() from public,anon;
grant execute on function public.can_create_b2c_teacher_accounts() to authenticated;

notify pgrst,'reload schema';
