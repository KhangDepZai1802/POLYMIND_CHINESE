-- Caller owns the transaction and must roll it back, including all fixtures.
insert into auth.users(id) values
 ('dc230001-0000-4000-8000-000000000001'),
 ('dc230001-0000-4000-8000-000000000002');
insert into public.profiles(id,role,full_name,is_active) values
 ('dc230001-0000-4000-8000-000000000001','super_admin','TEST TUITION ARCHIVE ADMIN',true),
 ('dc230001-0000-4000-8000-000000000002','teacher','TEST TUITION ARCHIVE TEACHER',true);
insert into public.teachers(id,user_id) values
 ('dc230001-0000-4000-8000-000000000003','dc230001-0000-4000-8000-000000000002');
insert into public.b2c_teachers(id,full_name,source_teacher_id) values
 ('dc230001-0000-4000-8000-000000000004','TEST TUITION ARCHIVE TEACHER','dc230001-0000-4000-8000-000000000003');
insert into public.b2c_classes(id,name,program_slug) values
 ('dc230001-0000-4000-8000-000000000005','TEST TUITION ARCHIVE CLASS','tieng-anh');
insert into public.b2c_students(id,source_key,full_name) values
 ('dc230001-0000-4000-8000-000000000011','TEST-TUITION-ARCHIVE-CURRENT','TEST TUITION ARCHIVE CURRENT'),
 ('dc230001-0000-4000-8000-000000000012','TEST-TUITION-ARCHIVE-OLD','TEST TUITION ARCHIVE OLD'),
 ('dc230001-0000-4000-8000-000000000013','TEST-TUITION-ARCHIVE-LEFT','TEST TUITION ARCHIVE LEFT');
insert into public.b2c_enrollments(id,source_key,class_id,student_id,status) values
 ('dc230001-0000-4000-8000-000000000021','TEST-TUITION-ARCHIVE-CURRENT','dc230001-0000-4000-8000-000000000005','dc230001-0000-4000-8000-000000000011','studying'),
 ('dc230001-0000-4000-8000-000000000022','TEST-TUITION-ARCHIVE-OLD','dc230001-0000-4000-8000-000000000005','dc230001-0000-4000-8000-000000000012','studying'),
 ('dc230001-0000-4000-8000-000000000023','TEST-TUITION-ARCHIVE-LEFT','dc230001-0000-4000-8000-000000000005','dc230001-0000-4000-8000-000000000013','withdrawn');

select set_config('request.jwt.claims','{"sub":"dc230001-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.save_b2c_teacher_permissions(
 'dc230001-0000-4000-8000-000000000004','dc230001-0000-4000-8000-000000000003',
 array['view_classes','view_tuition','edit_tuition','collect_tuition','manage_center_tuition'],null);
do $$ declare v_package uuid; v_row jsonb; begin
 v_package:=public.save_b2c_tuition_package_with_reason('dc230001-0000-4000-8000-000000000022',10,100000,0,'','',null,0);
 perform public.record_b2c_tuition_receipt(v_package,'dc230001-0000-4000-8000-000000000031',current_date,200000,'cash','TEST TUITION ARCHIVE ADMIN');
 perform public.archive_b2c_center_record('student','dc230001-0000-4000-8000-000000000012','TEST archive profile while preserving receivables');
 v_row:=public.get_b2c_tuition_page('TEST TUITION ARCHIVE OLD',0)->'rows'->0;
 assert v_row->>'student_archived_at' is not null, 'Admin receives student archive state';
 assert (v_row->>'total_due')::numeric=1000000 and (v_row->>'paid_amount')::numeric=200000 and (v_row->>'balance')::numeric=800000, 'Archived receivables are unchanged';
 assert public.get_b2c_tuition_page('TEST TUITION ARCHIVE CURRENT',0)->'rows'->0->'student_archived_at'='null'::jsonb, 'Current profile explicitly returns null';
 assert (public.get_b2c_tuition_page('TEST TUITION ARCHIVE',0)->>'total')::integer=3, 'All financial history remains available';
end $$;
reset role;
-- Save the exact admin projection for cross-role comparison within the same transaction.
create temporary table tuition_archive_admin_snapshot as
 select public.get_b2c_tuition_page('TEST TUITION ARCHIVE',0) as data;
grant select on tuition_archive_admin_snapshot to authenticated;

select set_config('request.jwt.claims','{"sub":"dc230001-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ declare v_teacher jsonb; v_admin jsonb; v_rows jsonb; v_row jsonb; begin
 v_teacher:=public.read_center_b2c_tuition_page('TEST TUITION ARCHIVE',0);
 select data into v_admin from pg_temp.tuition_archive_admin_snapshot;
 select jsonb_agg(r-array['class_id','enrollment_date','tuition_end_date','status'] order by r->>'student_code',r->>'enrollment_id')
 into v_rows from jsonb_array_elements(v_teacher->'rows') r;
 assert jsonb_set(v_teacher,'{rows}',v_rows)=v_admin, 'Admin and teacher share every row, archive flag and financial amount';
 v_row:=public.read_center_b2c_tuition_page('TEST TUITION ARCHIVE LEFT',0)->'rows'->0;
 assert v_row->>'status'='withdrawn' and v_row->'student_archived_at'='null'::jsonb, 'Enrollment withdrawal is separate from student archive';
 assert v_row->>'package_id' is null, 'No package is synthesized for historical enrollment';
 begin perform public.get_b2c_tuition_page(); raise exception 'Teacher called manager RPC'; exception when insufficient_privilege then null; end;
 begin perform public.read_center_b2c_tuition_page('',-1); raise exception 'Invalid page accepted'; exception when invalid_parameter_value then null; end;
end $$;
reset role;

update public.b2c_teacher_permissions set permissions=array['view_classes'] where teacher_id='dc230001-0000-4000-8000-000000000004';
set local role authenticated;
do $$ begin
 begin perform public.read_center_b2c_tuition_page(); raise exception 'Revoked teacher read allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.get_b2c_tuition_page(); raise exception 'Anonymous manager read allowed'; exception when insufficient_privilege then null; end;
 begin perform public.read_center_b2c_tuition_page(); raise exception 'Anonymous teacher read allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'ok: archive metadata, enrollment status, financial history, admin/teacher equality, invalid input, revoked and anonymous denial';
