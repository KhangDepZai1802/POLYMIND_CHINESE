create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id,aud,role,email,created_at,updated_at) values
 ('17100000-0000-4000-8000-000000000010','authenticated','authenticated','lifecycle-manager@example.test',now(),now()),
 ('17100000-0000-4000-8000-000000000011','authenticated','authenticated','lifecycle-teacher@example.test',now(),now());
insert into public.profiles(id,role,full_name,is_active) values
 ('17100000-0000-4000-8000-000000000010','academic_manager','TEST-LIFECYCLE-MANAGER',true),
 ('17100000-0000-4000-8000-000000000011','teacher','TEST-LIFECYCLE-TEACHER',true);
insert into public.b2c_classes(id,program_slug,name,capacity,enrolled_count,status) values
 ('17100000-0000-4000-8000-000000000001','tieng-anh','TEST-LC-OLD',2,1,'active'),
 ('17100000-0000-4000-8000-000000000002','tieng-anh','TEST-LC-NEW',2,0,'active'),
 ('17100000-0000-4000-8000-000000000003','tieng-anh','TEST-LC-FULL',1,1,'active'),
 ('17100000-0000-4000-8000-000000000004','tieng-anh','TEST-LC-CLOSED',2,0,'completed');
insert into public.b2c_students(id,source_key,full_name) values
 ('17100000-0000-4000-8000-000000000020','test-lc-student','TEST-LC-STUDENT'),
 ('17100000-0000-4000-8000-000000000021','test-lc-other','TEST-LC-OTHER');
insert into public.b2c_enrollments(id,source_key,class_id,student_id,status,enrollment_date,learning_start_date,tuition_end_date,registered_sessions,notes) values
 ('17100000-0000-4000-8000-000000000030','test-lc-old','17100000-0000-4000-8000-000000000001','17100000-0000-4000-8000-000000000020','studying','2026-01-01','2026-01-01','2027-01-01',24,'TEST-ORIGINAL-NOTE'),
 ('17100000-0000-4000-8000-000000000031','test-lc-full','17100000-0000-4000-8000-000000000003','17100000-0000-4000-8000-000000000021','studying','2026-01-01',null,null,null,null);
insert into public.b2c_tuition_packages(id,enrollment_id,sessions,unit_price,created_by) values
 ('17100000-0000-4000-8000-000000000040','17100000-0000-4000-8000-000000000030',24,100000,'17100000-0000-4000-8000-000000000010');
insert into public.b2c_tuition_receipts(package_id,request_id,paid_date,amount,method,collector_name,created_by) values
 ('17100000-0000-4000-8000-000000000040','17100000-0000-4000-8000-000000000041','2026-01-01',100000,'cash','TEST','17100000-0000-4000-8000-000000000010');
select ok((select relrowsecurity from pg_class where oid='public.b2c_enrollment_events'::regclass),'Lifecycle event table has RLS');
select ok(not has_function_privilege('anon','public.write_b2c_enrollment_lifecycle(jsonb)','EXECUTE'),'Anon cannot write lifecycle');
select set_config('request.jwt.claims','{"sub":"17100000-0000-4000-8000-000000000010","role":"authenticated"}',true);
set local role authenticated;
select set_config('test.lc', jsonb_build_object('request_id','17100000-0000-4000-8000-000000000050','enrollment_id','17100000-0000-4000-8000-000000000030','action','hold','effective_date','2026-10-17','expected_return_date','2026-11-01','target_class_id','','reason','TEST-HOLD','expected_updated_at',(select updated_at from public.b2c_enrollments where id='17100000-0000-4000-8000-000000000030'))::text,true);
select throws_ok($$update public.b2c_enrollments set status='on_hold' where id='17100000-0000-4000-8000-000000000030'$$,'22023',null,'Direct hold without event rejected');
select throws_ok($$select public.write_b2c_enrollment_lifecycle(current_setting('test.lc')::jsonb||'{"reason":" "}')$$,'22023',null,'Reason required');
select throws_ok($$select public.write_b2c_enrollment_lifecycle(current_setting('test.lc')::jsonb||'{"effective_date":"2099-01-01"}')$$,'22023',null,'Future effective date rejected');
select throws_ok($$select public.write_b2c_enrollment_lifecycle(current_setting('test.lc')::jsonb||'{"expected_return_date":"2026-01-01"}')$$,'22023',null,'Return date cannot precede hold');
select lives_ok($$select public.write_b2c_enrollment_lifecycle(current_setting('test.lc')::jsonb)$$,'Manager records hold');
select is((select status from public.b2c_enrollments where id='17100000-0000-4000-8000-000000000030'),'on_hold','Enrollment is held');
select is((select tuition_end_date from public.b2c_enrollments where id='17100000-0000-4000-8000-000000000030'),date '2027-01-01','Hold does not extend tuition');
select is((select enrolled_count from public.b2c_classes where id='17100000-0000-4000-8000-000000000001'),1,'Hold retains seat');
select lives_ok($$select public.write_b2c_enrollment_lifecycle(current_setting('test.lc')::jsonb)$$,'Exact retry succeeds');
select is((select count(*)::integer from public.b2c_enrollment_events where student_id='17100000-0000-4000-8000-000000000020'),1,'Retry creates no extra event');
select throws_ok($$select public.write_b2c_enrollment_lifecycle(current_setting('test.lc')::jsonb||'{"reason":"different"}')$$,'22023',null,'Changed retry rejected');
select throws_ok($$update public.b2c_enrollments set status='studying' where id='17100000-0000-4000-8000-000000000030'$$,'22023',null,'Direct resume without history blocked');
select set_config('test.lc',(current_setting('test.lc')::jsonb||jsonb_build_object('request_id','17100000-0000-4000-8000-000000000051','action','resume','expected_return_date','','expected_updated_at',(select updated_at from public.b2c_enrollments where id='17100000-0000-4000-8000-000000000030')))::text,true);
select lives_ok($$select public.write_b2c_enrollment_lifecycle(current_setting('test.lc')::jsonb)$$,'Resume recorded');
select is((select status from public.b2c_enrollments where id='17100000-0000-4000-8000-000000000030'),'studying','Enrollment studying after resume');
select set_config('test.lc',(current_setting('test.lc')::jsonb||jsonb_build_object('request_id','17100000-0000-4000-8000-000000000052','action','transfer','target_class_id','17100000-0000-4000-8000-000000000002','expected_updated_at',(select updated_at from public.b2c_enrollments where id='17100000-0000-4000-8000-000000000030')))::text,true);
select throws_ok($$select public.write_b2c_enrollment_lifecycle(current_setting('test.lc')::jsonb||'{"expected_updated_at":"2020-01-01T00:00:00Z"}')$$,'40001',null,'Stale version rejected');
select throws_ok($$select public.write_b2c_enrollment_lifecycle(current_setting('test.lc')::jsonb||'{"target_class_id":"17100000-0000-4000-8000-000000000001"}')$$,'22023',null,'Same-class transfer rejected');
select throws_ok($$select public.write_b2c_enrollment_lifecycle(current_setting('test.lc')::jsonb||'{"target_class_id":"17100000-0000-4000-8000-000000000003"}')$$,'22023',null,'Full class rejected');
select throws_ok($$select public.write_b2c_enrollment_lifecycle(current_setting('test.lc')::jsonb||'{"target_class_id":"17100000-0000-4000-8000-000000000004"}')$$,'22023',null,'Closed class rejected');
select lives_ok($$select public.write_b2c_enrollment_lifecycle(current_setting('test.lc')::jsonb)$$,'Transfer succeeds');
select is((select status from public.b2c_enrollments where id='17100000-0000-4000-8000-000000000030'),'transferred','Old enrollment preserved and closed');
select is((select enrolled_count from public.b2c_classes where id='17100000-0000-4000-8000-000000000001'),0,'Old class count decremented');
select is((select enrolled_count from public.b2c_classes where id='17100000-0000-4000-8000-000000000002'),1,'New class count incremented');
select is((select count(*)::integer from public.b2c_enrollments where student_id='17100000-0000-4000-8000-000000000020'),2,'Transfer creates new enrollment without deleting old');
select is((select count(*)::integer from public.b2c_tuition_packages where enrollment_id=(select result_enrollment_id from public.b2c_enrollment_events where request_id='17100000-0000-4000-8000-000000000052')),0,'No tuition copied to destination');
select is((select amount::integer from public.b2c_tuition_receipts where request_id='17100000-0000-4000-8000-000000000041'),100000,'Receipt untouched');
select is((select notes from public.b2c_enrollments where id='17100000-0000-4000-8000-000000000030'),'TEST-ORIGINAL-NOTE','Original notes preserved');
select throws_ok($$update public.b2c_enrollments set status='studying' where id='17100000-0000-4000-8000-000000000030'$$,'22023',null,'Transferred enrollment cannot reopen');
select is((public.read_b2c_enrollment_lifecycle('17100000-0000-4000-8000-000000000030')->>'total')::integer,3,'Manager reads complete student history');
select is((select actor_id from public.b2c_enrollment_events where request_id='17100000-0000-4000-8000-000000000052'),'17100000-0000-4000-8000-000000000010'::uuid,'Actual actor captured');
select throws_ok($$delete from public.b2c_enrollment_events where student_id='17100000-0000-4000-8000-000000000020'$$,'42501',null,'Manager cannot delete history');
select throws_ok($$update public.b2c_enrollment_events set reason='changed'$$,'42501',null,'Manager cannot rewrite history');
select set_config('test.lc',(current_setting('test.lc')::jsonb||jsonb_build_object('request_id','17100000-0000-4000-8000-000000000053','enrollment_id',(select result_enrollment_id from public.b2c_enrollment_events where request_id='17100000-0000-4000-8000-000000000052'),'target_class_id','17100000-0000-4000-8000-000000000001','expected_updated_at',(select updated_at from public.b2c_enrollments where source_key='transfer:17100000-0000-4000-8000-000000000052')))::text,true);
select lives_ok($$select public.write_b2c_enrollment_lifecycle(current_setting('test.lc')::jsonb)$$,'Student can transfer back with a separate enrollment');
select is((select count(*)::integer from public.b2c_enrollments where class_id='17100000-0000-4000-8000-000000000001' and student_id='17100000-0000-4000-8000-000000000020'),2,'Returning preserves both class enrollments');
reset role;
alter table public.b2c_enrollment_events add constraint test_lc_failure check(reason<>'TEST-FAIL-EVENT') not valid;
set local role authenticated;
select set_config('test.lc',(current_setting('test.lc')::jsonb||jsonb_build_object('request_id','17100000-0000-4000-8000-000000000054','enrollment_id',(select result_enrollment_id from public.b2c_enrollment_events where request_id='17100000-0000-4000-8000-000000000053'),'target_class_id','17100000-0000-4000-8000-000000000002','reason','TEST-FAIL-EVENT','expected_updated_at',(select updated_at from public.b2c_enrollments where source_key='transfer:17100000-0000-4000-8000-000000000053')))::text,true);
select throws_ok($$select public.write_b2c_enrollment_lifecycle(current_setting('test.lc')::jsonb)$$,'23514',null,'Event failure rolls back transfer');
select is((select count(*)::integer from public.b2c_enrollments where source_key='transfer:17100000-0000-4000-8000-000000000054'),0,'Failed event leaves no destination enrollment');
select is((select status from public.b2c_enrollments where source_key='transfer:17100000-0000-4000-8000-000000000053'),'studying','Failed event leaves source studying');
select set_config('request.jwt.claims','{"sub":"17100000-0000-4000-8000-000000000011","role":"authenticated"}',true);
select is((select count(*)::integer from public.b2c_enrollment_events),0,'Teacher cannot read event history');
select throws_ok($$select public.read_b2c_enrollment_lifecycle('17100000-0000-4000-8000-000000000030')$$,'42501',null,'Teacher cannot invoke manager history read');
select throws_ok($$select public.write_b2c_enrollment_lifecycle(current_setting('test.lc')::jsonb)$$,'42501',null,'Teacher cannot transfer');
reset role;
select * from finish();
