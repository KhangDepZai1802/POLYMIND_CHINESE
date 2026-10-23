begin;

create or replace function public.read_my_b2c_today() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare base jsonb;
begin
 if not app.has_b2c_permission('view_classes') or not app.has_b2c_permission('view_schedule') then
  return jsonb_build_object('rows','[]'::jsonb,'override_class_ids','[]'::jsonb);
 end if;
 base:=app.read_my_b2c_today();
 return jsonb_set(base,'{rows}',coalesce((
  select jsonb_agg(r||jsonb_build_object(
   'teaching_session_id',m.teaching_session_id,
   'check_in_at',s.check_in_at,
   'check_out_at',s.check_out_at,
   'student_count',(select count(*) from public.b2c_enrollments e where e.class_id=m.class_id and e.status in('studying','on_hold','awaiting_renewal','overdue')),
   'attendance_marked',(select count(*) from public.b2c_student_attendance a where a.meeting_id=m.id)
  ) order by (r->>'starts_at')::timestamptz,r->>'id')
  from jsonb_array_elements(base->'rows') r
  join public.b2c_class_meetings m on m.id=(r->>'id')::uuid
  left join public.b2c_teaching_sessions s on s.id=m.teaching_session_id
 ),'[]'::jsonb));
end $$;

notify pgrst,'reload schema';
commit;
