-- Run within a caller-owned transaction, always rolled back.
insert into auth.users(id) values('ac260001-0000-4000-8000-000000000001');
insert into public.profiles(id,role,full_name,is_active) values('ac260001-0000-4000-8000-000000000001','teacher','TEST DELETE TEACHER',true);
insert into public.teachers(id,user_id) values('ac260001-0000-4000-8000-000000000002','ac260001-0000-4000-8000-000000000001');
insert into public.b2c_teachers(id,full_name,source_teacher_id) values('ac260001-0000-4000-8000-000000000003','TEST DELETE TEACHER','ac260001-0000-4000-8000-000000000002');
insert into public.b2c_classes(id,name,program_slug) values('ac260001-0000-4000-8000-000000000004','TEST DELETE CLASS','tieng-anh');
insert into public.b2c_students(id,source_key,full_name) values('ac260001-0000-4000-8000-000000000005','TEST-DELETE','TEST DELETE STUDENT');
insert into public.b2c_enrollments(id,source_key,class_id,student_id,status) values('ac260001-0000-4000-8000-000000000006','TEST-DELETE','ac260001-0000-4000-8000-000000000004','ac260001-0000-4000-8000-000000000005','studying');
insert into public.b2c_parents(id,full_name) values('ac260001-0000-4000-8000-000000000007','TEST DELETE PARENT');
insert into public.b2c_student_parents(parent_id,student_id) values('ac260001-0000-4000-8000-000000000007','ac260001-0000-4000-8000-000000000005');
select set_config('request.jwt.claims','{"sub":"ac260001-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 assert not public.has_b2c_permission('delete_center_records');
 begin perform public.archive_b2c_center_record('parent','ac260001-0000-4000-8000-000000000007','test'); raise exception 'Ungrant delete allowed'; exception when insufficient_privilege then null; end;
 begin perform public.correct_b2c_tuition('{}'); raise exception 'Ungrant correction allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.b2c_teacher_permissions(teacher_id,permissions,updated_by) values('ac260001-0000-4000-8000-000000000003',array['delete_center_records','manage_center_student_data','manage_center_tuition','view_tuition','edit_tuition','collect_tuition'],'ac260001-0000-4000-8000-000000000001');
set local role authenticated;
do $$ declare pkg uuid; r jsonb; begin
 assert public.has_b2c_permission('delete_center_records');
 assert (public.read_teacher_b2c_parents_page('TEST DELETE PARENT',0)->>'total')::int=1;
 begin perform public.archive_b2c_center_record('parent','ac260001-0000-4000-8000-000000000007',' '); raise exception 'Blank reason accepted'; exception when invalid_parameter_value then null; end;
 perform public.archive_b2c_center_record('parent','ac260001-0000-4000-8000-000000000007','duplicate parent');
 perform public.archive_b2c_center_record('parent','ac260001-0000-4000-8000-000000000007','retry');
 assert (public.read_teacher_b2c_parents_page('TEST DELETE PARENT',0)->>'total')::int=0;
 pkg:=public.save_b2c_tuition_package_with_reason('ac260001-0000-4000-8000-000000000006',10,100000,0,'','',null,0);
 perform public.record_b2c_tuition_receipt(pkg,'ac260001-0000-4000-8000-000000000008','2026-10-01',100000,'cash','TEST');
 begin perform public.archive_b2c_center_record('package',pkg,'test'); raise exception 'Paid package archived'; exception when invalid_parameter_value then null; end;
 perform public.correct_b2c_tuition(jsonb_build_object('request_id','ac260001-0000-4000-8000-000000000009','package_id',pkg,'receipt_id',(public.read_b2c_permitted_receipts(pkg,0)->'receipts'->0->>'id'),'kind','cancel','reason','wrong receipt','amount',100000,'effective_date','2026-10-26','method','cash','reduce_fee',false,'expected_due',1000000,'expected_paid',100000));
 assert (public.read_b2c_tuition_corrections(pkg,0)->>'total')::int=1;
 perform public.archive_b2c_center_record('package',pkg,'wrong package');
 r:=public.read_center_b2c_tuition_page('TEST DELETE STUDENT',0)->'rows'->0;
 assert r->>'package_id' is null, 'Archived package excluded';
 begin perform public.record_b2c_tuition_receipt(pkg,'ac260001-0000-4000-8000-000000000010','2026-10-01',1000,'cash','TEST'); raise exception 'Archived package accepts receipt'; exception when no_data_found or invalid_parameter_value then null; end;
 assert public.save_b2c_tuition_package_with_reason('ac260001-0000-4000-8000-000000000006',5,200000,0,'','',null,0)<>pkg, 'Recreate without replacing financial history';
 assert (public.read_center_b2c_student_data('TEST DELETE STUDENT',0)->>'students')::int=1;
 perform public.archive_b2c_center_record('student','ac260001-0000-4000-8000-000000000005','duplicate student');
 assert (public.read_center_b2c_student_data('TEST DELETE STUDENT',0)->>'students')::int=0;
 assert (public.read_center_b2c_tuition_page('TEST DELETE STUDENT',0)->>'total')::int=1, 'Student archive must preserve receivables';
end $$;
reset role;
do $$ begin
 assert (select count(*)=3 from public.b2c_record_archives where actor_id='ac260001-0000-4000-8000-000000000001');
 assert (select count(*)=1 from public.b2c_student_parents where parent_id='ac260001-0000-4000-8000-000000000007'), 'Relationship preserved';
 assert (select count(*)=1 from public.b2c_enrollments where id='ac260001-0000-4000-8000-000000000006'), 'Enrollment preserved';
 assert (select count(*)=2 from public.b2c_tuition_packages where enrollment_id='ac260001-0000-4000-8000-000000000006');
 assert (select count(*)=1 from public.b2c_tuition_receipts where request_id='ac260001-0000-4000-8000-000000000008' and cancelled_at is not null and amount=100000);
end $$;
update public.teachers set is_active=false where id='ac260001-0000-4000-8000-000000000002';
set local role authenticated;
do $$ begin
 assert not public.has_b2c_permission('delete_center_records');
 begin perform public.archive_b2c_center_record('parent','ac260001-0000-4000-8000-000000000007','retry'); raise exception 'Inactive account allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'ok: delete permission, archive filtering, audit, receipts, recreate, history retention, inactive denial';
