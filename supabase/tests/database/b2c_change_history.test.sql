begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(24);
insert into auth.users(id,aud,role,email,created_at,updated_at) values
('50000000-0000-4000-8000-000000000010','authenticated','authenticated','history-manager@example.test',now(),now()),
('50000000-0000-4000-8000-000000000011','authenticated','authenticated','history-admin@example.test',now(),now()),
('50000000-0000-4000-8000-000000000012','authenticated','authenticated','history-teacher@example.test',now(),now());
insert into public.profiles(id,role,full_name,is_active) values
('50000000-0000-4000-8000-000000000010','academic_manager','TEST HISTORY MANAGER',true),
('50000000-0000-4000-8000-000000000011','super_admin','TEST HISTORY ADMIN',true),
('50000000-0000-4000-8000-000000000012','teacher','TEST HISTORY TEACHER',true);
insert into public.b2c_students(id,source_key,full_name) values('50000000-0000-4000-8000-000000000001','test-history-student','TEST HISTORY STUDENT');
insert into public.b2c_classes(id,program_slug,name) values('50000000-0000-4000-8000-000000000002','tieng-anh','TEST HISTORY CLASS');
insert into public.b2c_enrollments(id,source_key,class_id,student_id) values('50000000-0000-4000-8000-000000000003','test-history-enrollment','50000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000001');
select ok((select relrowsecurity from pg_class where oid='public.b2c_change_history'::regclass),'History RLS enabled');
select ok(not has_function_privilege('authenticated','app.capture_b2c_change()','EXECUTE'),'Trigger function cannot be called as app RPC');
select is((select count(*)::integer from public.b2c_change_history where enrollment_id='50000000-0000-4000-8000-000000000003'),1,'Enrollment creation recorded');
select ok((select actor_id is null from public.b2c_change_history where enrollment_id='50000000-0000-4000-8000-000000000003'),'No invented actor for SQL outside a login');
select set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000010","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.save_b2c_tuition_package('50000000-0000-4000-8000-000000000003',10,100000,0,'')$$,'Manager creates tuition without direct log permissions');
select lives_ok($$select public.save_b2c_tuition_package_with_reason('50000000-0000-4000-8000-000000000003',12,110000,20000,'TEST PROMO','Adjust package',1000000,0)$$,'Manager changes tuition with required reason');
select lives_ok($$select public.save_b2c_tuition_package('50000000-0000-4000-8000-000000000003',12,110000,20000,'TEST PROMO')$$,'No-op save succeeds');
select lives_ok($$update public.b2c_enrollments set status='on_hold' where id='50000000-0000-4000-8000-000000000003'$$,'Manager changes status');
select lives_ok($$select public.record_b2c_tuition_receipt((select id from public.b2c_tuition_packages where enrollment_id='50000000-0000-4000-8000-000000000003'),'50000000-0000-4000-8000-000000000004','2026-10-14',100000,'cash','DECLARED COLLECTOR')$$,'Receipt creation recorded');
select lives_ok($$select public.record_b2c_tuition_receipt((select id from public.b2c_tuition_packages where enrollment_id='50000000-0000-4000-8000-000000000003'),'50000000-0000-4000-8000-000000000004','2026-10-14',100000,'cash','DECLARED COLLECTOR')$$,'Receipt retry succeeds');
select is((select count(*)::integer from public.b2c_change_history),0,'Academic manager cannot read audit history');
select throws_ok($$insert into public.b2c_change_history(entity_type,entity_id,operation,after_data) values('enrollment','50000000-0000-4000-8000-000000000003','UPDATE','{}')$$,'42501',null,'Cannot forge events by direct insert');
select set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000011","role":"authenticated"}',true);
select is((select count(*)::integer from public.b2c_change_history where enrollment_id='50000000-0000-4000-8000-000000000003'),5,'Exactly five real events; no duplicates for no-op/retry');
select is((select before_data->>'unit_price' from public.b2c_change_history where enrollment_id='50000000-0000-4000-8000-000000000003' and entity_type='tuition_package' and operation='UPDATE'),'100000','Previous tuition captured');
select is((select after_data->>'unit_price' from public.b2c_change_history where enrollment_id='50000000-0000-4000-8000-000000000003' and entity_type='tuition_package' and operation='UPDATE'),'110000','New tuition captured');
select is((select before_data->>'status' from public.b2c_change_history where enrollment_id='50000000-0000-4000-8000-000000000003' and entity_type='enrollment' and operation='UPDATE'),'studying','Previous enrollment status captured');
select is((select after_data->>'status' from public.b2c_change_history where enrollment_id='50000000-0000-4000-8000-000000000003' and entity_type='enrollment' and operation='UPDATE'),'on_hold','New enrollment status captured');
select is((select actor_id from public.b2c_change_history where enrollment_id='50000000-0000-4000-8000-000000000003' and entity_type='tuition_receipt'),'50000000-0000-4000-8000-000000000010'::uuid,'Actor is actual login, not declared collector');
select is((select actor_name from public.b2c_change_history where enrollment_id='50000000-0000-4000-8000-000000000003' and entity_type='tuition_receipt'),'TEST HISTORY MANAGER','Actor name snapshotted');
select throws_ok($$update public.b2c_change_history set actor_name='FORGED'$$,'42501',null,'Super admin cannot rewrite history through app role');
select throws_ok($$delete from public.b2c_change_history$$,'42501',null,'Super admin cannot erase history through app role');
reset role;
alter table public.b2c_change_history add constraint history_test_failure check(operation <> 'UPDATE') not valid;
select set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000010","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$update public.b2c_enrollments set status='completed' where id='50000000-0000-4000-8000-000000000003'$$,'23514',null,'Business mutation rolls back if its audit cannot be recorded');
select is((select status from public.b2c_enrollments where id='50000000-0000-4000-8000-000000000003'),'on_hold','Status remains unchanged after failed audit');
select set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000012","role":"authenticated"}',true);
select is((select count(*)::integer from public.b2c_change_history),0,'Teacher cannot read history');
reset role;
select * from finish();
rollback;
