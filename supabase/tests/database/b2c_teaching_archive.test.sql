-- Caller owns enclosing transaction and rolls everything back.
insert into auth.users(id) values('ac260002-0000-4000-8000-000000000001'),('ac260002-0000-4000-8000-000000000002');
insert into public.profiles(id,role,full_name,is_active) values
 ('ac260002-0000-4000-8000-000000000001','super_admin','TEST ARCHIVE ADMIN',true),
 ('ac260002-0000-4000-8000-000000000002','teacher','TEST ARCHIVE TEACHER',true);
insert into public.teachers(id,user_id) values('ac260002-0000-4000-8000-000000000003','ac260002-0000-4000-8000-000000000002');
insert into public.b2c_teachers(id,full_name,source_teacher_id) values('ac260002-0000-4000-8000-000000000004','TEST ARCHIVE TEACHER','ac260002-0000-4000-8000-000000000003');
insert into public.b2c_classes(id,name,program_slug,teacher_id) values('ac260002-0000-4000-8000-000000000005','TEST ARCHIVE PAYROLL','tieng-anh','ac260002-0000-4000-8000-000000000004');
insert into public.b2c_teaching_sessions(id,class_id,teacher_id,starts_at,ends_at,hourly_rate,created_by,check_in_at,check_out_at,check_in_photo,check_out_photo)
 values('ac260002-0000-4000-8000-000000000006','ac260002-0000-4000-8000-000000000005','ac260002-0000-4000-8000-000000000004','2026-10-01T11:00Z','2026-10-01T12:30Z',100000,'ac260002-0000-4000-8000-000000000001','2026-10-01T11:00Z','2026-10-01T12:31Z','archive-fixture-in.jpg','archive-fixture-out.jpg');
insert into public.b2c_teaching_sessions(id,class_id,teacher_id,starts_at,ends_at,hourly_rate,created_by,check_in_at,check_out_at,check_in_photo,check_out_photo)
 values('ac260002-0000-4000-8000-000000000007','ac260002-0000-4000-8000-000000000005','ac260002-0000-4000-8000-000000000004','2026-10-02T11:00Z','2026-10-02T12:30Z',null,'ac260002-0000-4000-8000-000000000001','2026-10-02T11:00Z','2026-10-02T12:31Z','archive-unpriced-in.jpg','archive-unpriced-out.jpg');
select set_config('request.jwt.claims','{"sub":"ac260002-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 assert public.can_check_b2c_session('ac260002-0000-4000-8000-000000000006');
 begin perform public.archive_b2c_teaching_session('ac260002-0000-4000-8000-000000000006','test'); raise exception 'Teacher archived payroll'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"ac260002-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ declare old jsonb; newer jsonb; begin
 old:=public.get_b2c_teaching_page('2026-10-01',0,false);
 begin perform public.archive_b2c_teaching_session('ac260002-0000-4000-8000-000000000006',' '); raise exception 'Blank reason accepted'; exception when invalid_parameter_value then null; end;
 perform public.archive_b2c_teaching_session('ac260002-0000-4000-8000-000000000006','duplicate payroll');
 perform public.archive_b2c_teaching_session('ac260002-0000-4000-8000-000000000006','retry');
 newer:=public.get_b2c_teaching_page('2026-10-01',0,false);
 assert (old->>'total')::int-(newer->>'total')::int=1;
 assert (old->>'hours')::numeric-(newer->>'hours')::numeric=1.5;
 assert (old->>'salary')::numeric-(newer->>'salary')::numeric=150000;
 assert not exists(select 1 from jsonb_array_elements(newer->'rows') r where r->>'id'='ac260002-0000-4000-8000-000000000006');
 assert exists(select 1 from public.b2c_teaching_sessions where id='ac260002-0000-4000-8000-000000000006' and archived_by=auth.uid() and archive_reason='duplicate payroll' and check_in_photo='archive-fixture-in.jpg' and check_out_photo='archive-fixture-out.jpg');
 assert (select count(*)=1 from public.b2c_class_history where class_id='ac260002-0000-4000-8000-000000000005' and action='archive_teaching_session' and actor_id=auth.uid());
 assert exists(select 1 from public.b2c_class_meetings where teaching_session_id='ac260002-0000-4000-8000-000000000006' and status<>'cancelled');
 begin perform public.price_b2c_teaching_session('ac260002-0000-4000-8000-000000000006',999); raise exception 'Archived payroll repriced'; exception when invalid_parameter_value or serialization_failure then null; end;
 old:=newer;
 perform public.archive_b2c_teaching_session('ac260002-0000-4000-8000-000000000007','unpriced test session');
 newer:=public.get_b2c_teaching_page('2026-10-01',0,false);
 assert (old->>'pending_price_count')::int-(newer->>'pending_price_count')::int=1, 'Pending-price banner excludes archived sessions';
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"ac260002-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 assert not public.can_check_b2c_session('ac260002-0000-4000-8000-000000000006');
 begin perform public.check_b2c_teaching_session_with_location('ac260002-0000-4000-8000-000000000006','in','archive-fixture-in.jpg',10,106,8); raise exception 'Archived check-in allowed'; exception when insufficient_privilege then null; end;
 assert not exists(select 1 from jsonb_array_elements(public.get_b2c_teaching_page('2026-10-01',0,true)->'rows') r where r->>'id'='ac260002-0000-4000-8000-000000000006');
end $$;
reset role;
select 'ok: admin-only archive; totals and teacher list exclude archive; photos, meeting and audit preserved; retries/check-in guards';
