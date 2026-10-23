-- Execute within a rollback transaction; never populate actual student fees.
insert into auth.users(id) values('ac230003-0000-4000-8000-000000000001'),('ac230003-0000-4000-8000-000000000002');
insert into public.profiles(id,role,full_name,is_active) values
 ('ac230003-0000-4000-8000-000000000001','teacher','TEST CENTER TUITION TEACHER',true),
 ('ac230003-0000-4000-8000-000000000002','super_admin','TEST CENTER TUITION ADMIN',true);
insert into public.teachers(id,user_id) values('ac230003-0000-4000-8000-000000000003','ac230003-0000-4000-8000-000000000001');
insert into public.b2c_teachers(id,full_name,source_teacher_id) values('ac230003-0000-4000-8000-000000000004','TEST CENTER TUITION TEACHER','ac230003-0000-4000-8000-000000000003');
insert into public.b2c_classes(id,name,program_slug,teacher_name) values('ac230003-0000-4000-8000-000000000005','TEST CENTER TUITION CLASS','tieng-anh','OTHER TEACHER');
insert into public.b2c_students(id,source_key,full_name,phone) values('ac230003-0000-4000-8000-000000000006','TEST-CENTER-TUITION','TEST CENTER TUITION STUDENT','0901234567');
insert into public.b2c_enrollments(id,source_key,class_id,student_id,status) values('ac230003-0000-4000-8000-000000000007','TEST-CENTER-TUITION','ac230003-0000-4000-8000-000000000005','ac230003-0000-4000-8000-000000000006','studying');
select set_config('request.jwt.claims','{"sub":"ac230003-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 assert not public.has_b2c_permission('manage_center_tuition'), 'Global permission defaults off';
 begin perform public.read_center_b2c_tuition_page(); raise exception 'Ungrant read allowed'; exception when insufficient_privilege then null; end;
 begin perform public.save_b2c_tuition_package_with_reason('ac230003-0000-4000-8000-000000000007',10,100000,0,'','',null,0); raise exception 'Ungrant write allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"ac230003-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.save_b2c_teacher_permissions('ac230003-0000-4000-8000-000000000004','ac230003-0000-4000-8000-000000000003',array['view_classes','view_tuition','edit_tuition','collect_tuition','manage_center_tuition'],null);
reset role;
select set_config('request.jwt.claims','{"sub":"ac230003-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ declare p uuid; r uuid; data jsonb; begin
 assert public.has_b2c_permission('edit_tuition','ac230003-0000-4000-8000-000000000005'), 'Global tuition works outside assigned classes';
 assert not public.has_b2c_permission('view_students','ac230003-0000-4000-8000-000000000005'), 'No broader student permission';
 assert not public.has_b2c_permission('edit_classes','ac230003-0000-4000-8000-000000000005'), 'No class editing permission';
 data:=public.read_center_b2c_tuition_page('TEST CENTER TUITION STUDENT',0);
 assert (data->>'total')::int=1 and data->'rows'->0->>'class_id'='ac230003-0000-4000-8000-000000000005', 'Limited projection includes unconfigured enrollment';
 p:=public.save_b2c_tuition_package_with_reason('ac230003-0000-4000-8000-000000000007',10,100000,0,'','',null,0);
 r:=public.record_b2c_tuition_receipt(p,'ac230003-0000-4000-8000-000000000008',current_date,200000,'cash','TEST CENTER TUITION TEACHER');
 assert public.record_b2c_tuition_receipt(p,'ac230003-0000-4000-8000-000000000008',current_date,200000,'cash','TEST CENTER TUITION TEACHER')=r, 'Receipt retry does not duplicate';
 assert (public.read_b2c_permitted_receipts(p,0)->>'total')::int=1, 'Teacher can read receipt history';
 data:=public.read_center_b2c_tuition_page('TEST CENTER TUITION STUDENT',0)->'rows'->0;
 assert (data->>'sessions')::int=10 and (data->>'total_due')::numeric=1000000 and (data->>'paid_amount')::numeric=200000 and (data->>'balance')::numeric=800000, 'Sessions and money shown correctly';
 begin perform public.correct_b2c_tuition('{}'::jsonb); raise exception 'Teacher correction allowed'; exception when insufficient_privilege then null; end;
 begin perform public.read_center_b2c_tuition_page('',-1); raise exception 'Invalid page allowed'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
do $$ begin
 assert (select created_by='ac230003-0000-4000-8000-000000000001' and paid_date=current_date from public.b2c_tuition_receipts where request_id='ac230003-0000-4000-8000-000000000008'), 'Receipt actual actor and payment date retained';
end $$;
update public.b2c_teacher_permissions set permissions=array['view_classes','view_tuition','edit_tuition','collect_tuition'] where teacher_id='ac230003-0000-4000-8000-000000000004';
set local role authenticated;
do $$ begin
 assert not public.has_b2c_permission('edit_tuition','ac230003-0000-4000-8000-000000000005'), 'Revoking global scope retains class restrictions';
 begin perform public.read_center_b2c_tuition_page(); raise exception 'Revoked reader allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'ok: center tuition permission, projection, package, receipt, retry, attribution and revocation';
