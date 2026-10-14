create sequence public.xkld_candidate_code_seq;
create function app.next_xkld_candidate_code() returns text language plpgsql set search_path = '' as $$
declare n text := nextval('public.xkld_candidate_code_seq')::text;
begin return 'UV-' || repeat('0', greatest(0,6-length(n))) || n; end;
$$;
revoke all on function app.next_xkld_candidate_code() from public, anon;
grant execute on function app.next_xkld_candidate_code() to authenticated;
create table public.xkld_candidates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default app.next_xkld_candidate_code(),
  create_request_id uuid not null unique,
  full_name text not null check (length(btrim(full_name)) between 1 and 200),
  date_of_birth date not null check (date_of_birth >= date '1900-01-01'),
  phone text not null check (phone ~ '^(0[0-9]{9}|\+84[0-9]{9})$'),
  zalo text check (length(zalo) <= 200),
  hometown text not null check (length(btrim(hometown)) between 1 and 300),
  education text not null check (length(btrim(education)) between 1 and 200),
  occupation text not null check (length(btrim(occupation)) between 1 and 200),
  health_status text not null check (health_status in ('passed','failed')),
  source text not null check (source in ('collaborator','employee','advertising')),
  assignee_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  created_by uuid,
  updated_by uuid,
  search_text text generated always as (
    code || ' ' || full_name || ' ' || phone || ' ' || coalesce(zalo,'') || ' ' || hometown || ' ' || education || ' ' || occupation
  ) stored
);
alter table public.xkld_candidates enable row level security;

create or replace function app.can_read_xkld_candidates() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.current_role() in ('super_admin','executive','xkld_staff'), false);
$$;
create or replace function app.can_edit_xkld_candidates() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.current_role() in ('super_admin','xkld_staff'), false);
$$;
revoke all on function app.can_read_xkld_candidates(), app.can_edit_xkld_candidates() from public, anon;
grant execute on function app.can_read_xkld_candidates(), app.can_edit_xkld_candidates() to authenticated;

create policy xkld_candidates_read on public.xkld_candidates for select to authenticated using(app.can_read_xkld_candidates());
create policy xkld_candidates_insert on public.xkld_candidates for insert to authenticated with check(app.can_edit_xkld_candidates() and created_by=auth.uid());
create policy xkld_candidates_update on public.xkld_candidates for update to authenticated using(app.can_edit_xkld_candidates()) with check(app.can_edit_xkld_candidates());
revoke all on public.xkld_candidates from public, anon, authenticated;
grant select on public.xkld_candidates to authenticated;
grant insert (create_request_id, full_name, date_of_birth, phone, zalo, hometown, education, occupation, health_status, source, assignee_id) on public.xkld_candidates to authenticated;
grant update (full_name, date_of_birth, phone, zalo, hometown, education, occupation, health_status, source, assignee_id) on public.xkld_candidates to authenticated;
grant usage on sequence public.xkld_candidate_code_seq to authenticated;
create index xkld_candidates_created on public.xkld_candidates(created_at desc, id desc);
create index xkld_candidates_assignee on public.xkld_candidates(assignee_id, created_at desc);
create index xkld_candidates_source on public.xkld_candidates(source, created_at desc);

create or replace function app.prepare_xkld_candidate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.date_of_birth > (now() at time zone 'Asia/Ho_Chi_Minh')::date then
    raise exception 'Ngày sinh không được ở tương lai' using errcode='23514';
  end if;
  if tg_op='INSERT' or new.assignee_id is distinct from old.assignee_id then
    if not exists(select 1 from public.profiles p where p.id=new.assignee_id and p.is_active and p.role in ('super_admin','xkld_staff')) then
      raise exception 'Người phụ trách phải là nhân viên XKLĐ hoặc quản trị viên đang hoạt động' using errcode='23514';
    end if;
  end if;
  if tg_op='INSERT' then
    new.created_by := auth.uid();
    new.created_at := clock_timestamp();
  else
    new.id := old.id; new.code := old.code; new.create_request_id := old.create_request_id;
    new.created_by := old.created_by; new.created_at := old.created_at;
  end if;
  new.updated_by := auth.uid();
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function app.prepare_xkld_candidate() from public, anon, authenticated;
create trigger prepare_xkld_candidate before insert or update on public.xkld_candidates for each row execute function app.prepare_xkld_candidate();

-- Only names/IDs of eligible assignees; no general access to other profiles.
create or replace function public.get_xkld_assignees()
returns table(id uuid, full_name text, is_active boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.is_active from public.profiles p
  where app.can_read_xkld_candidates() and (
    (p.is_active and p.role in ('super_admin','xkld_staff'))
    or exists(select 1 from public.xkld_candidates c where c.assignee_id=p.id)
  ) order by p.full_name, p.id;
$$;
revoke all on function public.get_xkld_assignees() from public, anon;
grant execute on function public.get_xkld_assignees() to authenticated;
notify pgrst, 'reload schema';
