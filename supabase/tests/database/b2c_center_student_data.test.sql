-- Fixtures only. Run inside an enclosing rollback transaction.
insert into auth.users(id) values('ac230006-0000-4000-8000-000000000001');
insert into public.profiles(id,role,full_name,is_active) values('ac230006-0000-4000-8000-000000000001','teacher','TEST CENTER DATA TEACHER',true);
insert into public.teachers(id,user_id) values('ac230006-0000-4000-8000-000000000002','ac230006-0000-4000-8000-000000000001');
insert into public.b2c_teachers(id,full_name,source_teacher_id) values('ac230006-0000-4000-8000-000000000003','TEST CENTER DATA TEACHER','ac230006-0000-4000-8000-000000000002');
insert into public.b2c_classes(id,name,program_slug,teacher_name) values('ac230006-0000-4000-8000-000000000004','TEST CENTER DATA CLASS','tieng-anh','OTHER TEACHER');
insert into public.b2c_students(id,source_key,full_name) values('ac230006-0000-4000-8000-000000000005','TEST-CENTER-DATA','TEST CENTER DATA STUDENT');
insert into public.b2c_enrollments(id,source_key,class_id,student_id,status) values('ac230006-0000-4000-8000-000000000006','TEST-CENTER-DATA','ac230006-0000-4000-8000-000000000004','ac230006-0000-4000-8000-000000000005','studying');
select set_config('request.jwt.claims','{"sub":"ac230006-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 assert not public.has_b2c_permission('manage_center_student_data'), 'Defaults off for other B2C teachers';
 begin perform public.read_center_b2c_student_data(); raise exception 'Ungrant read allowed'; exception when insufficient_privilege then null; end;
 begin perform public.save_center_b2c_student_data('{}'); raise exception 'Ungrant write allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.b2c_teacher_permissions(teacher_id,permissions,updated_by) values('ac230006-0000-4000-8000-000000000003',array['manage_center_student_data'],'ac230006-0000-4000-8000-000000000001');
set local role authenticated;
do $$ declare r jsonb; payload jsonb; begin
 assert public.has_b2c_permission('manage_center_student_data'), 'Explicit opt-in enabled';
 assert not public.has_b2c_permission('edit_tuition','ac230006-0000-4000-8000-000000000004'), 'No tuition escalation';
 r:=public.read_center_b2c_student_data('TEST CENTER DATA STUDENT',0)->'rows'->0;
 assert r->>'enrollment_id'='ac230006-0000-4000-8000-000000000006', 'Can complete data outside assigned classes';
 payload:=r||jsonb_build_object('phone','0901234567','customer_source','tiktok','referrer_name','','salesperson','TEST CLOSER','enrollment_date','2026-10-01','learning_start_date','2026-10-02','tuition_end_date','2026-12-01');
 perform public.save_center_b2c_student_data(payload);
 r:=public.read_center_b2c_student_data('TEST CENTER DATA STUDENT',0)->'rows'->0;
 assert r->>'phone'='0901234567' and r->>'customer_source'='tiktok' and r->>'salesperson'='TEST CLOSER' and r->>'tuition_end_date'='2026-12-01', 'All requested fields updated';
 begin perform public.save_center_b2c_student_data(payload||'{"phone":"901234567"}'); raise exception 'Nine digit phone accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.save_center_b2c_student_data(payload||'{"customer_source":"referral","referrer_name":""}'); raise exception 'Missing referrer accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.save_center_b2c_student_data(payload||'{"student_updated_at":"2000-01-01T00:00:00Z"}'); raise exception 'Stale snapshot accepted'; exception when serialization_failure then null; end;
 -- Completing source alone must not force invented missing phone, closer or dates.
 perform public.save_center_b2c_student_data(r||jsonb_build_object('phone','','customer_source','facebook','referrer_name','','salesperson','','enrollment_date','','learning_start_date','','tuition_end_date',''));
 r:=public.read_center_b2c_student_data('TEST CENTER DATA STUDENT',0)->'rows'->0;
 assert r->>'phone' is null and r->>'enrollment_date' is null and r->>'customer_source'='facebook', 'Unknown values may remain empty';
 assert (select count(*)=0 from public.b2c_students where id='ac230006-0000-4000-8000-000000000005'), 'No raw student table access added';
end $$;
reset role;
update public.b2c_teacher_permissions set permissions='{}' where teacher_id='ac230006-0000-4000-8000-000000000003';
set local role authenticated;
do $$ begin
 begin perform public.read_center_b2c_student_data(); raise exception 'Revoked read allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'ok: opt-in data completion, source, phone, closer, dates, validation, unknown values, stale writes and revocation';
