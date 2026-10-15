-- Integration tests run inside the enclosing rollback transaction.
insert into auth.users(id) values ('8b000000-0000-4000-8000-000000000001'),('8b000000-0000-4000-8000-000000000002'),('8b000000-0000-4000-8000-000000000003');
insert into public.profiles(id,role,full_name,is_active) values
('8b000000-0000-4000-8000-000000000001','teacher','TEST PERMISSION TEACHER',true),
('8b000000-0000-4000-8000-000000000002','super_admin','TEST PERMISSION ADMIN',true),
('8b000000-0000-4000-8000-000000000003','teacher','TEST PERMISSION OTHER',true);
insert into public.teachers(id,user_id) values ('8b000000-0000-4000-8000-000000000004','8b000000-0000-4000-8000-000000000001');
insert into public.b2c_teachers(id,full_name,source_teacher_id,hourly_rate) values ('8b000000-0000-4000-8000-000000000005','TEST PERMISSION TEACHER','8b000000-0000-4000-8000-000000000004',100000);
insert into public.b2c_classes(id,name,program_slug,teacher_name) values
('8b000000-0000-4000-8000-000000000010','TEST OWN CLASS','tieng-anh','TEST PERMISSION TEACHER'),
('8b000000-0000-4000-8000-000000000011','TEST FOREIGN CLASS','tieng-anh','NO MATCH');
insert into public.b2c_students(id,source_key,full_name,phone) values ('8b000000-0000-4000-8000-000000000020','TEST-PERMISSIONS-STUDENT','TEST STUDENT','0901234567');
insert into public.b2c_enrollments(id,source_key,class_id,student_id,status) values ('8b000000-0000-4000-8000-000000000030','TEST-PERMISSIONS-ENROLLMENT','8b000000-0000-4000-8000-000000000010','8b000000-0000-4000-8000-000000000020','studying');
insert into public.b2c_class_meetings(id,request_id,class_id,starts_at,ends_at,created_by,updated_by) values ('8b000000-0000-4000-8000-000000000040',gen_random_uuid(),'8b000000-0000-4000-8000-000000000010','2026-01-01T10:00:00+07','2026-01-01T11:00:00+07','8b000000-0000-4000-8000-000000000001','8b000000-0000-4000-8000-000000000001');
insert into public.b2c_teaching_sessions(id,class_id,teacher_id,starts_at,ends_at,hourly_rate,created_by,check_in_at,check_out_at,check_in_photo,check_out_photo) values('8b000000-0000-4000-8000-000000000050','8b000000-0000-4000-8000-000000000010','8b000000-0000-4000-8000-000000000005','2026-01-02T10:00:00+07','2026-01-02T11:00:00+07',100000,'8b000000-0000-4000-8000-000000000001','2026-01-02T10:00:00+07','2026-01-02T11:00:00+07','TEST-PERMISSION-IN','TEST-PERMISSION-OUT');
select set_config('request.jwt.claims','{"sub":"8b000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 assert public.get_my_b2c_permissions() @> array['view_classes','view_students','view_schedule','view_comments','check_teaching','view_pay'], 'Existing permissions retained';
 assert not public.has_b2c_permission('mark_attendance'), 'New write permission defaults off';
 assert (public.read_my_b2c_classes()->>'total')::integer=1, 'Own class visible';
 assert not public.has_b2c_permission('view_classes','8b000000-0000-4000-8000-000000000011'), 'Foreign class denied';
 assert not public.has_b2c_permission('unknown'), 'Unknown permission denied';
 begin perform public.save_b2c_teacher_permissions('8b000000-0000-4000-8000-000000000005','8b000000-0000-4000-8000-000000000004',array['mark_attendance'],null); raise exception 'Teacher self escalation allowed'; exception when insufficient_privilege then null; end;
 begin perform public.read_b2c_permission_admin(); raise exception 'Teacher can inspect admin permissions'; exception when insufficient_privilege then null; end;
 begin perform public.write_b2c_class_workspace('add_comment',jsonb_build_object('class_id','8b000000-0000-4000-8000-000000000010','enrollment_id','8b000000-0000-4000-8000-000000000030','request_id',gen_random_uuid(),'content','TEST')); raise exception 'Ungrant write allowed'; exception when insufficient_privilege then null; end;
end $$;
select 'ok: defaults, assignment, unknown permission and self escalation';
reset role;
select set_config('request.jwt.claims','{"sub":"8b000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin perform public.save_b2c_teacher_permissions('8b000000-0000-4000-8000-000000000005','8b000000-0000-4000-8000-000000000004',array['invented'],null); raise exception 'Unknown grant accepted'; exception when raise_exception then if sqlerrm='Unknown grant accepted' then raise; end if; end;
 begin perform public.save_b2c_teacher_permissions('8b000000-0000-4000-8000-000000000005','8b000000-0000-4000-8000-000000000004',array['write_comments'],null); raise exception 'Missing dependency accepted'; exception when raise_exception then if sqlerrm='Missing dependency accepted' then raise; end if; end;
end $$;
select public.save_b2c_teacher_permissions('8b000000-0000-4000-8000-000000000005','8b000000-0000-4000-8000-000000000004',array['view_classes','view_students','view_schedule','view_comments','write_comments','mark_attendance','check_teaching','view_pay','create_classes','edit_classes','edit_schedule','edit_students','view_tuition','collect_tuition','edit_tuition'],null);
do $$ begin
 begin perform public.save_b2c_teacher_permissions('8b000000-0000-4000-8000-000000000005','8b000000-0000-4000-8000-000000000004',array[]::text[],null); raise exception 'Stale save accepted'; exception when serialization_failure then null; end;
end $$;
select 'ok: admin grants validated and stale saves rejected';
reset role;
select set_config('request.jwt.claims','{"sub":"8b000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ declare p uuid; c uuid; r jsonb; v jsonb; begin
 assert public.has_b2c_permission('mark_attendance','8b000000-0000-4000-8000-000000000010'), 'Granted attendance available';
 perform public.write_b2c_class_workspace('save_attendance',jsonb_build_object('class_id','8b000000-0000-4000-8000-000000000010','enrollment_id','8b000000-0000-4000-8000-000000000030','meeting_id','8b000000-0000-4000-8000-000000000040','request_id',gen_random_uuid(),'status','present','note','TEST','expected_updated_at',null));
 perform public.write_b2c_class_workspace('add_comment',jsonb_build_object('class_id','8b000000-0000-4000-8000-000000000010','enrollment_id','8b000000-0000-4000-8000-000000000030','request_id',gen_random_uuid(),'content','TEST PERMITTED COMMENT'));
 r:=public.read_teacher_b2c_workspace('8b000000-0000-4000-8000-000000000010','students');
 assert not (r->'rows'->0 ?| array['paid_amount','balance','total_due','unit_price']), 'Student view excludes finance';
 p:=public.save_b2c_tuition_package('8b000000-0000-4000-8000-000000000030',10,100000,0,'');
 perform public.record_b2c_tuition_receipt(p,gen_random_uuid(),'2026-01-01',100000,'cash','TEST');
 assert (public.read_b2c_permitted_receipts(p)->>'total')::integer=1, 'Receipt accessible';
 begin perform public.record_b2c_tuition_receipt(p,gen_random_uuid(),'2026-01-01',10000000,'cash','TEST'); raise exception 'Overpayment allowed'; exception when invalid_parameter_value then null; end;
 begin perform public.read_teacher_b2c_workspace('8b000000-0000-4000-8000-000000000011','tuition'); raise exception 'Foreign tuition allowed'; exception when insufficient_privilege then null; end;
 begin perform public.save_teacher_b2c_student('8b000000-0000-4000-8000-000000000011','8b000000-0000-4000-8000-000000000030','{}'); raise exception 'Foreign student edit allowed'; exception when insufficient_privilege then null; end;
 v:=public.read_teacher_b2c_student_edit('8b000000-0000-4000-8000-000000000010','8b000000-0000-4000-8000-000000000030');
 perform public.save_teacher_b2c_student('8b000000-0000-4000-8000-000000000010','8b000000-0000-4000-8000-000000000030',v||'{"full_name":"TEST UPDATED STUDENT","phone":"0901234567","status":"studying","withdrawal_reason":"","enrollment_date":"2026-01-01"}'::jsonb);
 c:=public.save_teacher_b2c_class(null,'{"name":"TEST CREATED CLASS","program_slug":"tieng-anh","capacity":15,"campus":"","delivery_mode":"offline","start_date":"","status":"planned","notes":""}',gen_random_uuid(),null);
 assert public.has_b2c_permission('edit_classes',c), 'Created class is assigned to self';
 assert (select count(*) from public.b2c_teacher_permissions)=0, 'Teacher cannot read permission table';
 begin update public.b2c_teacher_permissions set permissions=array['edit_tuition']; raise exception 'Direct permission write allowed'; exception when insufficient_privilege then null; end;
end $$;
select 'ok: attendance/comments, scoped finance and profile writes, class creation and direct-table protection';
reset role;
-- A shared student cannot have their global identity edited from just one class.
insert into public.b2c_enrollments(source_key,class_id,student_id,status) values('TEST-PERMISSIONS-SHARED','8b000000-0000-4000-8000-000000000011','8b000000-0000-4000-8000-000000000020','studying');
set local role authenticated;
do $$ declare v jsonb; begin
 v:=public.read_teacher_b2c_student_edit('8b000000-0000-4000-8000-000000000010','8b000000-0000-4000-8000-000000000030');
 assert not (v->>'can_edit_profile')::boolean, 'Shared identity is read only';
 begin perform public.save_teacher_b2c_student('8b000000-0000-4000-8000-000000000010','8b000000-0000-4000-8000-000000000030',v||'{"full_name":"TEST FOREIGN PROFILE CHANGE","phone":"0901234567","status":"studying","withdrawal_reason":"","enrollment_date":"2026-01-01"}'::jsonb); raise exception 'Shared identity changed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.b2c_teacher_permissions set permissions=array['check_teaching'] where teacher_id='8b000000-0000-4000-8000-000000000005';
set local role authenticated;
do $$ declare r jsonb; begin
 r:=public.get_b2c_teaching_page('2026-01-01',0,true);
 assert (r->>'total')::integer=1, 'Can check own sessions without pay access';
 assert r->>'salary' is null and r->>'hours' is null, 'Pay aggregate redacted';
 assert not (r->'rows'->0 ?| array['salary','teaching_hours','hourly_rate']), 'Pay fields redacted';
 assert (select count(*) from public.b2c_teaching_sessions)=0, 'Raw salary table stays closed';
 assert public.can_check_b2c_session('8b000000-0000-4000-8000-000000000050'), 'Own session visibility';
end $$;
reset role;
update public.b2c_teacher_permissions set permissions=array['view_pay'] where teacher_id='8b000000-0000-4000-8000-000000000005';
set local role authenticated;
do $$ declare r jsonb; begin
 r:=public.get_b2c_teaching_page('2026-01-01',0,true);
 assert (r->>'salary')::numeric=100000, 'Own pay readable without check-in permission';
 begin perform public.check_b2c_teaching_session('8b000000-0000-4000-8000-000000000050','in','TEST'); raise exception 'Pay read granted check-in'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.b2c_teacher_permissions set permissions=array['view_classes','view_tuition','collect_tuition'] where teacher_id='8b000000-0000-4000-8000-000000000005';
set local role authenticated;
do $$ declare p uuid; begin
 p:=(public.read_teacher_b2c_workspace('8b000000-0000-4000-8000-000000000010','tuition')->'rows'->0->>'package_id')::uuid;
 perform public.record_b2c_tuition_receipt(p,gen_random_uuid(),'2026-01-01',100000,'cash','TEST');
 begin perform public.save_b2c_tuition_package('8b000000-0000-4000-8000-000000000030',10,100000,0,''); raise exception 'Collect granted package edits'; exception when insufficient_privilege then null; end;
 begin perform public.read_teacher_b2c_workspace('8b000000-0000-4000-8000-000000000010','tuition',0,'','8b000000-0000-4000-8000-000000000040'); raise exception 'Meeting leaked without schedule permission'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'ok: shared student protection, payroll redaction and separate check/pay/collect/edit rights';
do $$ begin
 assert exists(select 1 from public.b2c_teacher_permission_history where teacher_id='8b000000-0000-4000-8000-000000000005' and actor_id='8b000000-0000-4000-8000-000000000002'), 'Real actor audit';
end $$;
select set_config('request.jwt.claims','{"sub":"8b000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.save_b2c_teacher_permissions('8b000000-0000-4000-8000-000000000005','8b000000-0000-4000-8000-000000000004',array[]::text[],(select updated_at from public.b2c_teacher_permissions where teacher_id='8b000000-0000-4000-8000-000000000005'));
reset role;
select set_config('request.jwt.claims','{"sub":"8b000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 assert public.get_my_b2c_permissions()='{}'::text[], 'All permissions revoked';
 assert (public.read_my_b2c_classes()->>'total')::integer=0, 'Class list revoked';
 assert jsonb_array_length(public.read_my_b2c_today()->'rows')=0, 'Today revoked';
 begin perform public.read_teacher_b2c_workspace('8b000000-0000-4000-8000-000000000010','tuition'); raise exception 'Revoked tuition allowed'; exception when insufficient_privilege then null; end;
 begin perform public.check_b2c_teaching_session('8b000000-0000-4000-8000-000000000040','in','TEST'); raise exception 'Revoked check-in allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'ok: revocation affects class list, today, finance and check-in';
