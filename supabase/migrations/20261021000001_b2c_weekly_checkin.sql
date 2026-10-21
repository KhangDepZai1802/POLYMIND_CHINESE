-- Weekly plans appear without writes. Materialize only today's assigned slot
-- when the teacher opens check-in; dated meetings (including cancellation) win.
create function app.b2c_weekly_slot(p_days text,p_time text,p_date date)
returns table(starts_at timestamptz,ends_at timestamptz)
language plpgsql immutable set search_path='' as $$
declare d text:=case extract(isodow from p_date)::int when 7 then 'CN' else 'T'||(extract(isodow from p_date)::int+1)::text end;
 segment text; times text[]; a time; b time;
begin
 if not (upper(coalesce(p_days,'')) ~ ('\m'||d||'\M')) then return; end if;
 segment:=coalesce(p_time,'');
 if upper(segment) ~ '\m(T[2-7]|CN)\M' then
   select x into segment from regexp_split_to_table(segment,'[;\n]') x where upper(x) ~ ('\m'||d||'\M') limit 1;
 end if;
 select array_agg(lpad(m[1],2,'0')||':'||m[2]) into times from regexp_matches(coalesce(segment,''),'([0-9]{1,2})\s*[:hHgG]\s*([0-9]{2})','g') m;
 if cardinality(times) is distinct from 2 or times[1]!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or times[2]!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' then return; end if;
 a:=times[1]::time; b:=times[2]::time;
 if b<=a or b-a>interval '12 hours' then return; end if;
 return query select (p_date+a) at time zone 'Asia/Ho_Chi_Minh',(p_date+b) at time zone 'Asia/Ho_Chi_Minh';
end $$;
revoke all on function app.b2c_weekly_slot(text,text,date) from public,anon,authenticated;

create function app.b2c_checkin_open(p_start timestamptz,p_end timestamptz,p_now timestamptz)
returns boolean language sql immutable set search_path='' as $$
 select coalesce(p_now>=p_start-interval '15 minutes' and p_now<p_end
 and (p_now at time zone 'Asia/Ho_Chi_Minh')::date=(p_start at time zone 'Asia/Ho_Chi_Minh')::date,false)
$$;
revoke all on function app.b2c_checkin_open(timestamptz,timestamptz,timestamptz) from public,anon,authenticated;

alter function public.read_b2c_checkin_meetings() set schema app;
revoke all on function app.read_b2c_checkin_meetings() from public,anon,authenticated;
create function public.read_b2c_checkin_meetings() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare dated jsonb; weekly jsonb; d date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
 dated:=app.read_b2c_checkin_meetings(); -- validates capability, active account and identity
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'class_id',c.id,'source','weekly','class_name',c.name,
 'starts_at',w.starts_at,'ends_at',w.ends_at,'teaching_session_id',null,'check_in_at',null,'check_out_at',null,
 'can_start',app.b2c_checkin_open(w.starts_at,w.ends_at,now())) order by w.starts_at),'[]'::jsonb) into weekly
 from public.b2c_classes c cross join lateral app.b2c_weekly_slot(c.weekdays_text,c.time_text,d) w
 where c.teacher_id=app.my_b2c_teacher_id() and c.status='active' and (c.start_date is null or c.start_date<=d)
 and not exists(select 1 from public.b2c_class_meetings m where m.class_id=c.id and (m.starts_at at time zone 'Asia/Ho_Chi_Minh')::date=d);
 return (select coalesce(jsonb_agg(x order by (x->>'starts_at')::timestamptz,x->>'id'),'[]'::jsonb) from jsonb_array_elements(dated||weekly) x);
end $$;
revoke all on function public.read_b2c_checkin_meetings() from public,anon;
grant execute on function public.read_b2c_checkin_meetings() to authenticated;

create function public.prepare_b2c_weekly_checkin(p_class_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.b2c_classes; t public.b2c_teachers; w record; m public.b2c_class_meetings;
 d date:=(clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
 if not coalesce(app.has_b2c_permission('check_teaching'),false) then raise exception 'Forbidden' using errcode='42501'; end if;
 select * into t from public.b2c_teachers where id=app.my_b2c_teacher_id() for update;
 select * into c from public.b2c_classes where id=p_class_id for update;
 if t.id is null or c.id is null or c.teacher_id is distinct from t.id then raise exception 'Forbidden' using errcode='42501'; end if;
 -- A concurrent retry or explicit dated override uses the dated meeting only.
 select * into m from public.b2c_class_meetings where class_id=c.id and (starts_at at time zone 'Asia/Ho_Chi_Minh')::date=d order by starts_at limit 1;
 if m.id is not null then return public.prepare_b2c_meeting_checkin(m.id); end if;
 if c.status<>'active' or c.start_date>d then raise exception 'Class is not active today' using errcode='22023'; end if;
 select * into w from app.b2c_weekly_slot(c.weekdays_text,c.time_text,d);
 if w.starts_at is null or not app.b2c_checkin_open(w.starts_at,w.ends_at,clock_timestamp()) then raise exception 'Check-in opens 15 minutes before class and closes at class end' using errcode='22023'; end if;
 insert into public.b2c_class_meetings(request_id,class_id,starts_at,ends_at,teacher_name,created_by,updated_by)
 values(gen_random_uuid(),c.id,w.starts_at,w.ends_at,t.full_name,auth.uid(),auth.uid()) returning * into m;
 return public.prepare_b2c_meeting_checkin(m.id);
end $$;
revoke all on function public.prepare_b2c_weekly_checkin(uuid) from public,anon;
grant execute on function public.prepare_b2c_weekly_checkin(uuid) to authenticated;

create or replace function public.check_b2c_teaching_session(p_id uuid,p_kind text,p_photo text) returns void
language plpgsql security definer set search_path='' as $$
declare s public.b2c_teaching_sessions;
begin
 if not coalesce(app.has_b2c_permission('check_teaching'),false) or not public.can_check_b2c_session(p_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 select * into s from public.b2c_teaching_sessions where id=p_id for update;
 if exists(select 1 from public.b2c_class_meetings m where m.teaching_session_id=p_id and m.status='cancelled') then raise exception 'Meeting cancelled' using errcode='22023'; end if;
 -- Preserve successful-photo retries, even after the time window closes.
 if p_kind='in' and s.check_in_photo is distinct from p_photo
 and not app.b2c_checkin_open(s.starts_at,s.ends_at,clock_timestamp()) then
 raise exception 'Check-in opens 15 minutes before class and closes at class end' using errcode='22023'; end if;
 perform app.check_b2c_teaching_session(p_id,p_kind,p_photo);
end $$;
notify pgrst,'reload schema';
