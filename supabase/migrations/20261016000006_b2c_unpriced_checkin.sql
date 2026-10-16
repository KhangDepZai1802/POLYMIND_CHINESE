alter table public.b2c_teaching_sessions alter column hourly_rate drop not null;

create function public.read_b2c_checkin_meetings() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce(app.has_b2c_permission('check_teaching'),false) then raise exception 'Forbidden' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'class_name',c.name,'starts_at',m.starts_at,'ends_at',m.ends_at,'teaching_session_id',m.teaching_session_id,'check_in_at',s.check_in_at,'check_out_at',s.check_out_at,'can_start',m.ends_at>=now()) order by m.starts_at,m.id),'[]'::jsonb)
 from public.b2c_class_meetings m join public.b2c_classes c on c.id=m.class_id
 left join public.b2c_teaching_sessions s on s.id=m.teaching_session_id
 where c.teacher_id=app.my_b2c_teacher_id() and m.status<>'cancelled' and c.status in('active','planned','paused')
 and (m.starts_at at time zone 'Asia/Ho_Chi_Minh')::date=(now() at time zone 'Asia/Ho_Chi_Minh')::date
 and (btrim(m.teacher_name)='' or btrim(m.teacher_name)=(select btrim(full_name) from public.b2c_teachers where id=c.teacher_id))
 and (m.teaching_session_id is null or public.can_check_b2c_session(m.teaching_session_id)));
end $$;
revoke all on function public.read_b2c_checkin_meetings() from public,anon;
grant execute on function public.read_b2c_checkin_meetings() to authenticated;

-- Materialize only an existing dated meeting, never invent dates from weekly text.
create function public.prepare_b2c_meeting_checkin(p_meeting_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare m public.b2c_class_meetings; c public.b2c_classes; t public.b2c_teachers; v_id uuid;
begin
 if not coalesce(app.has_b2c_permission('check_teaching'),false) then raise exception 'Forbidden' using errcode='42501'; end if;
 select * into m from public.b2c_class_meetings where id=p_meeting_id;
 if m.id is null then raise exception 'Meeting not found' using errcode='22023'; end if;
 -- Same lock order as the payroll-to-meeting trigger (teacher, class, meeting).
 select * into c from public.b2c_classes where id=m.class_id;
 select * into t from public.b2c_teachers where id=c.teacher_id for update;
 perform 1 from public.b2c_classes where id=m.class_id for update;
 select * into c from public.b2c_classes where id=m.class_id;
 select * into m from public.b2c_class_meetings where id=p_meeting_id for update;
 if t.id is null or c.teacher_id is distinct from t.id or t.id is distinct from app.my_b2c_teacher_id()
   or not exists(select 1 from public.teachers s join public.profiles p on p.id=s.user_id
     where s.id=t.source_teacher_id and s.user_id=auth.uid() and s.is_active and p.is_active and p.role in('teacher','academic_manager'))
 then raise exception 'Forbidden' using errcode='42501'; end if;
 if m.status='cancelled' or c.status not in('active','planned','paused')
   or (m.starts_at at time zone 'Asia/Ho_Chi_Minh')::date<>(clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date
   or (m.ends_at at time zone 'Asia/Ho_Chi_Minh')::date<>(m.starts_at at time zone 'Asia/Ho_Chi_Minh')::date
   or (btrim(m.teacher_name)<>'' and btrim(m.teacher_name)<>btrim(t.full_name))
 then raise exception 'Invalid meeting assignment or date' using errcode='22023'; end if;
 if m.teaching_session_id is not null then
   if not public.can_check_b2c_session(m.teaching_session_id) then raise exception 'Forbidden' using errcode='42501'; end if;
   return m.teaching_session_id;
 end if;
 if clock_timestamp()>m.ends_at then raise exception 'Session already ended' using errcode='22023'; end if;
 if exists(select 1 from public.b2c_teaching_sessions where teacher_id=t.id and starts_at<m.ends_at and ends_at>m.starts_at)
 then raise exception 'Teacher has an overlapping session' using errcode='22023'; end if;
 insert into public.b2c_teaching_sessions(class_id,teacher_id,starts_at,ends_at,hourly_rate,created_by)
 values(m.class_id,t.id,m.starts_at,m.ends_at,t.hourly_rate,auth.uid())
 on conflict(class_id,starts_at) do nothing returning id into v_id;
 if v_id is null then raise exception 'Schedule changed; reload' using errcode='40001'; end if;
 return v_id;
end $$;
revoke all on function public.prepare_b2c_meeting_checkin(uuid) from public,anon;
grant execute on function public.prepare_b2c_meeting_checkin(uuid) to authenticated;

-- Explicit per-session price snapshot; changing a teacher default never reprices history.
create function public.price_b2c_teaching_session(p_id uuid,p_rate numeric) returns void
language plpgsql security definer set search_path='' as $$
declare s public.b2c_teaching_sessions;
begin
 if not coalesce(app.is_manager(),false) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_rate is null or p_rate<0 or p_rate>999999999999 or p_rate<>trunc(p_rate) then raise exception 'Invalid rate' using errcode='22023'; end if;
 select * into s from public.b2c_teaching_sessions where id=p_id for update;
 if s.id is null then raise exception 'Session not found' using errcode='22023'; end if;
 if s.hourly_rate is not null then
   if s.hourly_rate=p_rate then return; end if;
   raise exception 'Session already priced' using errcode='40001';
 end if;
 update public.b2c_teaching_sessions set hourly_rate=p_rate where id=p_id;
 insert into public.b2c_class_history(class_id,action,before_data,after_data,actor_id,actor_name)
 values(s.class_id,'price_teaching_session',jsonb_build_object('id',s.id,'hourly_rate',null),jsonb_build_object('id',s.id,'hourly_rate',p_rate),auth.uid(),(select full_name from public.profiles where id=auth.uid()));
end $$;
revoke all on function public.price_b2c_teaching_session(uuid,numeric) from public,anon;
grant execute on function public.price_b2c_teaching_session(uuid,numeric) to authenticated;

create or replace function public.get_b2c_teaching_page(p_month date,p_page integer default 0,p_mine boolean default false) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r jsonb; v_pending bigint;
begin
 if not app.has_b2c_permission('check_teaching') and not app.has_b2c_permission('view_pay') then raise exception 'Forbidden' using errcode='42501'; end if;
 r:=app.get_b2c_teaching_page(p_month,p_page,p_mine);
 if app.has_b2c_permission('view_pay') then
   select count(*) into v_pending from public.b2c_teaching_sessions s
   where s.starts_at>=date_trunc('month',p_month::timestamp) at time zone 'Asia/Ho_Chi_Minh'
   and s.starts_at<(date_trunc('month',p_month::timestamp)+interval '1 month') at time zone 'Asia/Ho_Chi_Minh'
   and s.hourly_rate is null and s.check_out_at is not null
   and ((not p_mine and app.is_manager()) or public.can_check_b2c_session(s.id));
   r:=r||jsonb_build_object('pending_price_count',v_pending);
 else
   r:=(r-'hours'-'salary')||jsonb_build_object('hours',null,'salary',null,'rows',(select coalesce(jsonb_agg(x-array['hourly_rate','salary','teaching_hours']),'[]') from jsonb_array_elements(r->'rows') x));
 end if;
 return r;
end $$;
notify pgrst,'reload schema';

create or replace function public.create_b2c_teaching_session(p_class_id uuid,p_teacher_id uuid,p_starts_at timestamptz,p_ends_at timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_rate numeric; v_id uuid;
begin
  if not app.is_manager() then raise exception 'Forbidden' using errcode='42501'; end if;
  perform 1 from public.b2c_teachers where id=p_teacher_id for update;
  select b.hourly_rate into v_rate from public.b2c_teachers b join public.teachers t on t.id=b.source_teacher_id
    join public.profiles p on p.id=t.user_id where b.id=p_teacher_id and t.is_active and p.is_active and p.role in ('teacher','academic_manager');
  if not found then raise exception 'Teacher needs an active account' using errcode='22023'; end if;
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

