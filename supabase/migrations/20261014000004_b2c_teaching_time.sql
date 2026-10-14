create table public.b2c_teaching_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.b2c_classes(id) on delete restrict,
  teacher_id uuid not null references public.b2c_teachers(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  hourly_rate numeric not null check(hourly_rate>=0 and hourly_rate=trunc(hourly_rate)),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check_in_at timestamptz,
  check_out_at timestamptz,
  check_in_photo text,
  check_out_photo text,
  teaching_hours numeric generated always as (case when check_out_at is not null then extract(epoch from (ends_at-starts_at))/3600 else 0 end) stored,
  salary numeric generated always as (case when check_out_at is not null then round((extract(epoch from (ends_at-starts_at))/3600)*hourly_rate) else 0 end) stored,
  check(ends_at>starts_at and ends_at<=starts_at+interval '12 hours'),
  check((check_in_at is null)=(check_in_photo is null)),
  check((check_out_at is null)=(check_out_photo is null)),
  check(check_out_at is null or (check_in_at is not null and check_out_at>=check_in_at)),
  unique(class_id,starts_at)
);
create index b2c_teaching_teacher_start_idx on public.b2c_teaching_sessions(teacher_id,starts_at);
alter table public.b2c_teaching_sessions enable row level security;

create function public.can_check_b2c_session(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.b2c_teaching_sessions s
    join public.b2c_teachers b on b.id=s.teacher_id
    join public.teachers t on t.id=b.source_teacher_id
    join public.profiles p on p.id=t.user_id
    where s.id=p_id and t.user_id=auth.uid() and p.is_active and t.is_active
      and p.role in ('teacher','academic_manager'));
$$;
revoke all on function public.can_check_b2c_session(uuid) from public,anon;
grant execute on function public.can_check_b2c_session(uuid) to authenticated;
create policy b2c_teaching_read on public.b2c_teaching_sessions for select to authenticated
using(app.is_manager() or public.can_check_b2c_session(id));
revoke all on public.b2c_teaching_sessions from public,anon,authenticated;
grant select on public.b2c_teaching_sessions to authenticated;

create function public.create_b2c_teaching_session(p_class_id uuid,p_teacher_id uuid,p_starts_at timestamptz,p_ends_at timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_rate numeric; v_id uuid;
begin
  if not app.is_manager() then raise exception 'Forbidden' using errcode='42501'; end if;
  perform 1 from public.b2c_teachers where id=p_teacher_id for update;
  select b.hourly_rate into v_rate from public.b2c_teachers b join public.teachers t on t.id=b.source_teacher_id
    join public.profiles p on p.id=t.user_id where b.id=p_teacher_id and t.is_active and p.is_active and p.role in ('teacher','academic_manager');
  if not found or v_rate is null then raise exception 'Teacher needs an active account and hourly rate' using errcode='22023'; end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at<=p_starts_at or p_ends_at>p_starts_at+interval '12 hours'
    or (p_starts_at at time zone 'Asia/Ho_Chi_Minh')::date<>(p_ends_at at time zone 'Asia/Ho_Chi_Minh')::date
    then raise exception 'Invalid session time' using errcode='22023'; end if;
  -- Lock teacher to prevent simultaneous scheduling of overlapping sessions.
  if exists(select 1 from public.b2c_teaching_sessions where teacher_id=p_teacher_id and starts_at<p_ends_at and ends_at>p_starts_at)
    then raise exception 'Teacher has an overlapping session' using errcode='22023'; end if;
  insert into public.b2c_teaching_sessions(class_id,teacher_id,starts_at,ends_at,hourly_rate,created_by)
    values(p_class_id,p_teacher_id,p_starts_at,p_ends_at,v_rate,auth.uid()) returning id into v_id;
  return v_id;
end;
$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('b2c-check-photos','b2c-check-photos',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy b2c_check_photo_insert on storage.objects for insert to authenticated with check(
  bucket_id='b2c-check-photos' and (storage.foldername(name))[2]=auth.uid()::text
  and case when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.can_check_b2c_session(((storage.foldername(name))[1])::uuid) else false end
);
create policy b2c_check_photo_read on storage.objects for select to authenticated using(
  bucket_id='b2c-check-photos' and exists(select 1 from public.b2c_teaching_sessions s
    where name in(s.check_in_photo,s.check_out_photo) and (app.is_manager() or public.can_check_b2c_session(s.id)))
);

create function public.check_b2c_teaching_session(p_id uuid,p_kind text,p_photo text)
returns void language plpgsql security definer set search_path='' as $$
declare v public.b2c_teaching_sessions; v_now timestamptz:=clock_timestamp();
begin
  if not public.can_check_b2c_session(p_id) then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into v from public.b2c_teaching_sessions where id=p_id for update;
  if p_kind is null or p_kind not in('in','out') then raise exception 'Invalid checkpoint' using errcode='22023'; end if;
  -- Retrying the same checkpoint is harmless, including after midnight.
  if (p_kind='in' and v.check_in_photo=p_photo) or (p_kind='out' and v.check_out_photo=p_photo) then return; end if;
  if (v.starts_at at time zone 'Asia/Ho_Chi_Minh')::date<>(v_now at time zone 'Asia/Ho_Chi_Minh')::date
    then raise exception 'Check-in/out only on the scheduled day' using errcode='22023'; end if;
  if p_photo is null or split_part(p_photo,'/',1)<>p_id::text or split_part(p_photo,'/',2)<>auth.uid()::text
    or split_part(p_photo,'/',3)<>p_kind
    or not exists(select 1 from storage.objects where bucket_id='b2c-check-photos' and name=p_photo
      and metadata->>'mimetype' in('image/jpeg','image/png','image/webp') and (metadata->>'size')::bigint between 1 and 5242880)
    then raise exception 'Missing or invalid photo' using errcode='22023'; end if;
  if p_kind='in' then
    if v.check_in_at is not null then raise exception 'Already checked in' using errcode='22023'; end if;
    if v_now>v.ends_at then raise exception 'Session already ended' using errcode='22023'; end if;
    update public.b2c_teaching_sessions set check_in_at=v_now,check_in_photo=p_photo where id=p_id;
  else
    if v.check_in_at is null then raise exception 'Check in first' using errcode='22023'; end if;
    if v.check_out_at is not null then raise exception 'Already checked out' using errcode='22023'; end if;
    if v_now<v.ends_at then raise exception 'Cannot check out before scheduled end' using errcode='22023'; end if;
    update public.b2c_teaching_sessions set check_out_at=v_now,check_out_photo=p_photo where id=p_id;
  end if;
end;
$$;

create function public.get_b2c_teaching_page(p_month date,p_page integer default 0,p_mine boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_start timestamptz; v_end timestamptz; v_total integer; v_hours numeric; v_salary numeric; v_rows jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and is_active and role in('super_admin','academic_manager','teacher'))
    then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_month is null or p_page is null or p_page<0 or p_page>1000000 or p_mine is null then raise exception 'Invalid filter' using errcode='22023'; end if;
  v_start:=date_trunc('month',p_month::timestamp) at time zone 'Asia/Ho_Chi_Minh';
  v_end:=(date_trunc('month',p_month::timestamp)+interval '1 month') at time zone 'Asia/Ho_Chi_Minh';
  select count(*),coalesce(sum(s.teaching_hours),0),coalesce(sum(s.salary),0) into v_total,v_hours,v_salary
    from public.b2c_teaching_sessions s where s.starts_at>=v_start and s.starts_at<v_end
      and ((not p_mine and app.is_manager()) or public.can_check_b2c_session(s.id));
  select coalesce(jsonb_agg(to_jsonb(q) order by q.starts_at,q.id),'[]'::jsonb) into v_rows from (
    select s.*,b.full_name as teacher_name,c.name as class_name from public.b2c_teaching_sessions s
      join public.b2c_teachers b on b.id=s.teacher_id join public.b2c_classes c on c.id=s.class_id
    where s.starts_at>=v_start and s.starts_at<v_end and ((not p_mine and app.is_manager()) or public.can_check_b2c_session(s.id))
    order by s.starts_at,s.id limit 50 offset p_page*50
  ) q;
  return jsonb_build_object('rows',v_rows,'total',v_total,'hours',v_hours,'salary',v_salary);
end;
$$;
revoke all on function public.create_b2c_teaching_session(uuid,uuid,timestamptz,timestamptz) from public,anon;
revoke all on function public.check_b2c_teaching_session(uuid,text,text) from public,anon;
revoke all on function public.get_b2c_teaching_page(date,integer,boolean) from public,anon;
grant execute on function public.create_b2c_teaching_session(uuid,uuid,timestamptz,timestamptz) to authenticated;
grant execute on function public.check_b2c_teaching_session(uuid,text,text) to authenticated;
grant execute on function public.get_b2c_teaching_page(date,integer,boolean) to authenticated;
notify pgrst, 'reload schema';
