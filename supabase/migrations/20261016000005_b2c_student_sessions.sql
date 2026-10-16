-- Enrich the existing paginated readers; retain their authorization and fields.
do $migration$
declare v_name text; v_sql text; v_add text;
begin
 v_add := $fragment$select f.*,
 case when app.has_b2c_permission('mark_attendance',p_class_id) then (
  select jsonb_build_object(
   'attended',count(*) filter(where a.status in ('present','late','makeup')),
   'absent',count(*) filter(where a.status='absent'),
   'excused',count(*) filter(where a.status='excused'),
   'makeup',count(*) filter(where a.status='makeup'),
   'remaining',case when f.registered_sessions is null then null else
    f.registered_sessions-count(*) filter(where a.status in ('present','late','makeup')) end)
  from public.b2c_student_attendance a
  join public.b2c_class_meetings m on m.id=a.meeting_id
  where a.enrollment_id=f.enrollment_id and m.class_id=p_class_id
   and m.status<>'cancelled' and m.ends_at<=now()
 ) else null end as session_summary,$fragment$;
 foreach v_name in array array['read_b2c_class_workspace','read_teacher_b2c_workspace'] loop
  select pg_get_functiondef(to_regprocedure('public.'||v_name||'(uuid,text,integer,text,uuid)')) into v_sql;
  if v_sql is null or strpos(v_sql,'select f.*,')=0 then
   raise exception 'Unexpected workspace reader definition: %',v_name;
  end if;
  execute replace(v_sql,'select f.*,',v_add);
 end loop;
end;
$migration$;
